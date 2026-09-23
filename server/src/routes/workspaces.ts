import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  requireAuth,
  requireOrganizer,
  requireApproved,
} from "../middleware/session.js";
import {
  asyncRoute as run,
  ok,
  id,
  text,
  HttpError,
  pagination,
  pageInfo,
} from "../utils/http.js";
import { Event } from "../models/Event.js";
import { Booking } from "../models/Booking.js";
import { Order } from "../models/Order.js";
import { Ticket } from "../models/Ticket.js";
import { Coupon } from "../models/Coupon.js";
import { Review } from "../models/Review.js";
import { Refund } from "../models/Refund.js";
import { Payout } from "../models/Payout.js";
import { OrganizerProfile } from "../models/OrganizerProfile.js";
import { EventDraft } from "../models/EventDraft.js";
import { balance } from "../services/finance.js";
import { notify } from "../services/notifications.js";
export const workspaces = Router();
workspaces.use(requireAuth);
workspaces.get(
  "/refunds",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter = { user: req.user!._id };
    ok(res, {
      refunds: await Refund.find(filter)
        .populate("booking")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      pagination: pageInfo(await Refund.countDocuments(filter), page, limit),
    });
  }),
);
workspaces.post(
  "/refunds/request",
  run(async (req, res) => {
    const input = z
      .object({ bookingId: id, reason: text.min(10).max(2000) })
      .parse(req.body);
    const booking = await Booking.findOne({
      _id: input.bookingId,
      user: req.user!._id,
      paymentStatus: "COMPLETED",
    });
    if (!booking) throw new HttpError(404, "Completed booking not found");
    if (booking.total === 0)
      throw new HttpError(409, "Free tickets have no payment to refund");
    const event = await Event.findById(booking.event);
    if (
      !event ||
      (event.status !== "CANCELLED" &&
        event.startDate.getTime() - Date.now() < 86400000) ||
      (await Ticket.exists({ booking: booking._id, status: "USED" }))
    )
      throw new HttpError(
        409,
        "Refund eligibility requires unused tickets and at least 24 hours before the event, unless cancelled",
      );
    const refund = await Refund.create({
      booking: booking._id,
      user: req.user!._id,
      amount: booking.total,
      reason: input.reason,
    });
    ok(res, { refund }, "Refund request submitted", 201);
  }),
);
workspaces.use("/organizers", requireOrganizer);
workspaces.get(
  "/organizers/event-draft",
  run(async (req, res) => {
    ok(res, { draft: await EventDraft.findOne({ organizer: req.user!._id }) });
  }),
);
workspaces.put(
  "/organizers/event-draft",
  run(async (req, res) => {
    const input = z
      .object({
        form: z
          .record(z.unknown())
          .refine(
            (v) => JSON.stringify(v).length <= 60000,
            "Draft is too large",
          ),
        step: z.number().int().min(0).max(7),
      })
      .parse(req.body);
    const draft = await EventDraft.findOneAndUpdate(
      { organizer: req.user!._id },
      { $set: input },
      { upsert: true, new: true },
    );
    ok(res, { draft }, "Draft progress saved");
  }),
);
workspaces.delete(
  "/organizers/event-draft",
  run(async (req, res) => {
    await EventDraft.deleteOne({ organizer: req.user!._id });
    ok(res, {}, "Draft cleared");
  }),
);
workspaces.get(
  "/organizers/profile",
  run(async (req, res) =>
    ok(res, {
      profile: await OrganizerProfile.findOne({ user: req.user!._id }),
    }),
  ),
);
workspaces.put(
  "/organizers/profile",
  run(async (req, res) => {
    const input = z
      .object({
        organizationName: text.max(150),
        bio: z.string().max(5000),
        website: z.string().url().or(z.literal("")),
        logo: z.string().url().or(z.literal("")),
        socialLinks: z
          .object({
            instagram: z.string().url().or(z.literal("")).optional(),
            linkedin: z.string().url().or(z.literal("")).optional(),
          })
          .optional(),
        payoutDetails: z
          .object({
            accountHolderName: text.optional(),
            accountNumber: z.string().max(30).optional(),
            ifscCode: z.string().max(20).optional(),
            bankName: text.optional(),
            upiId: z.string().max(100).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    const profile = await OrganizerProfile.findOneAndUpdate(
      { user: req.user!._id },
      { $set: input, $setOnInsert: { status: "PENDING", user: req.user!._id } },
      { new: true, upsert: true, runValidators: true },
    );
    ok(res, { profile }, "Organizer profile saved");
  }),
);
workspaces.get(
  "/organizers/stats",
  run(async (req, res) => {
    const events = await Event.find({ organizer: req.user!._id }).sort({
      createdAt: -1,
    });
    const eventIds = events.map((e) => e._id);
    const bookings = await Booking.find({
      event: { $in: eventIds },
      paymentStatus: "COMPLETED",
    });
    const attendance = await Ticket.countDocuments({
      event: { $in: eventIds },
      status: "USED",
    });
    const daily = await Booking.aggregate([
      { $match: { event: { $in: eventIds }, paymentStatus: "COMPLETED" } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%d",
              timezone: "Asia/Kolkata",
            },
          },
          revenue: { $sum: "$total" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    ok(res, {
      stats: {
        totalEvents: events.length,
        publishedEvents: events.filter((e) => e.status === "PUBLISHED").length,
        totalTicketsSold: events.reduce((s, e) => s + e.soldTickets, 0),
        totalRevenue: bookings.reduce((s, b) => s + b.total, 0),
        views: events.reduce((s, e) => s + e.views, 0),
        attendance,
      },
      daily,
      recentEvents: events.slice(0, 5),
    });
  }),
);
workspaces.get(
  "/organizers/payouts",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter = { organizer: req.user!._id };
    ok(res, {
      balance: await balance(req.user!._id),
      payouts: await Payout.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      pagination: pageInfo(await Payout.countDocuments(filter), page, limit),
    });
  }),
);
workspaces.post(
  "/organizers/payouts/request",
  requireApproved,
  run(async (req, res) => {
    const { amount } = z
      .object({
        amount: z
          .number()
          .positive()
          .max(10000000)
          .refine((n) => Number.isInteger(n * 100), "At most two decimals"),
      })
      .parse(req.body);
    const session = await mongoose.startSession();
    let payout: any;
    try {
      await session.withTransaction(async () => {
        // Shared organizer document serializes concurrent payout allocations.
        const profile = await OrganizerProfile.findOneAndUpdate(
          { user: req.user!._id },
          { $inc: { payoutRevision: 1 } },
          { session, new: true },
        );
        if (!profile?.payoutDetails?.accountNumber)
          throw new HttpError(400, "Complete your payout bank details first");
        const funds = await balance(req.user!._id, session);
        if (amount > funds.available)
          throw new HttpError(409, "Amount exceeds available settled balance");
        [payout] = await Payout.create(
          [{ organizer: req.user!._id, amount, status: "REQUESTED" }],
          { session },
        );
        await notify(
          req.user!._id,
          "PAYOUT",
          "Payout requested",
          `₹${amount} requested for review.`,
          `payout:${payout._id}:requested`,
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    ok(res, { payout }, "Payout requested", 201);
  }),
);
workspaces.get(
  "/organizers/:resource",
  run(async (req, res) => {
    const resource = z
      .enum(["events", "orders", "attendees", "coupons", "reviews"])
      .parse(req.params.resource);
    const { page, limit } = pagination(req);
    const owned = await Event.find({ organizer: req.user!._id }).select("_id");
    const eventFilter = { event: { $in: owned.map((e) => e._id) } };
    const models: Record<string, any> = {
      events: Event,
      orders: Order,
      attendees: Ticket,
      coupons: Coupon,
      reviews: Review,
    };
    const filter: any = ["events", "coupons"].includes(resource)
      ? { organizer: req.user!._id }
      : eventFilter;
    if (req.query.eventId && resource === "attendees") {
      const eventId = id.parse(req.query.eventId);
      if (!owned.some((e) => e._id.toString() === eventId))
        throw new HttpError(403, "Event ownership required");
      filter.event = eventId;
    }
    let query = models[resource]
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (["orders", "attendees", "reviews"].includes(resource))
      query = query.populate("event", "title slug");
    if (resource === "attendees") query = query.populate("ticketType", "name");
    ok(res, {
      [resource]: await query,
      pagination: pageInfo(
        await models[resource].countDocuments(filter),
        page,
        limit,
      ),
    });
  }),
);
