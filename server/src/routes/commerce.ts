import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Booking } from "../models/Booking.js";
import { Ticket } from "../models/Ticket.js";
import { Order } from "../models/Order.js";
import { Event } from "../models/Event.js";
import { CheckIn } from "../models/CheckIn.js";
import { Refund } from "../models/Refund.js";
import { env } from "../config/env.js";
import {
  requireAuth,
  requireOrganizer,
  requireApproved,
  requireVerified,
} from "../middleware/session.js";
import {
  asyncRoute as run,
  HttpError,
  ok,
  id,
  pagination,
  pageInfo,
} from "../utils/http.js";
import { checkoutSchema, cartSchema } from "../validators/schemas.js";
import {
  checkout,
  priceCart,
  confirmBooking,
  toPaise,
} from "../services/bookings.js";
import { validSignature, verifiedPayment } from "../services/payments.js";
export const commerce = Router();
commerce.use(requireAuth);
commerce.post(
  "/bookings/quote",
  run(async (req, res) => {
    const quote = await priceCart(cartSchema.parse(req.body), req.user!._id);
    ok(res, {
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      platformFee: quote.platformFee,
      total: quote.total,
      items: quote.items,
    });
  }),
);
commerce.post(
  "/bookings/checkout",
  requireVerified,
  run(async (req, res) => {
    const booking = await checkout(
      checkoutSchema.parse(req.body),
      req.user!._id,
    );
    ok(
      res,
      {
        bookingId: booking.bookingId,
        razorpayOrderId: booking.paymentOrderId,
        amount: booking.total,
        confirmed: booking.status === "CONFIRMED",
        currency: "INR",
        razorpayKeyId: env.RAZORPAY_KEY_ID,
        expiresAt: booking.expiresAt,
      },
      booking.status === "CONFIRMED"
        ? "Tickets confirmed"
        : "Checkout reserved for 15 minutes",
      201,
    );
  }),
);
commerce.post(
  "/bookings/verify-payment",
  requireVerified,
  run(async (req, res) => {
    const input = z
      .object({
        bookingId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpayOrderId: z.string().min(1),
        razorpaySignature: z.string().length(64),
      })
      .parse(req.body);
    const booking = await Booking.findOne({
      bookingId: input.bookingId,
      user: req.user!._id,
    });
    if (!booking) throw new HttpError(404, "Booking not found");
    if (
      booking.paymentOrderId !== input.razorpayOrderId ||
      !validSignature(
        `${booking.paymentOrderId}|${input.razorpayPaymentId}`,
        input.razorpaySignature,
        env.RAZORPAY_KEY_SECRET,
      )
    )
      throw new HttpError(400, "Payment signature is invalid");
    await verifiedPayment(
      booking.paymentOrderId!,
      input.razorpayPaymentId,
      toPaise(booking.total),
    );
    ok(
      res,
      { booking: await confirmBooking(booking._id, input.razorpayPaymentId) },
      "Payment verified and tickets issued",
    );
  }),
);
commerce.get(
  "/bookings/my-bookings",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter = { user: req.user!._id };
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("event", "title slug coverImage startDate endDate city venue")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);
    ok(res, { bookings, pagination: pageInfo(total, page, limit) });
  }),
);
commerce.get(
  "/tickets",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter: any = { user: req.user!._id };
    if (req.query.status)
      filter.status = z
        .enum(["VALID", "USED", "CANCELLED", "EXPIRED"])
        .parse(req.query.status);
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate({ path: "event", populate: { path: "venue" } })
        .populate("ticketType")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);
    ok(res, { tickets, pagination: pageInfo(total, page, limit) });
  }),
);
commerce.get(
  "/orders",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter = { user: req.user!._id };
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("event", "title slug startDate")
        .populate("booking")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    ok(res, { orders, pagination: pageInfo(total, page, limit) });
  }),
);
commerce.post(
  "/checkin/scan-qr",
  requireOrganizer,
  requireApproved,
  run(async (req, res) => {
    const input = z
      .object({ eventId: id, ticketId: z.string().trim().min(1).max(150) })
      .parse(req.body);
    const event = await Event.findById(input.eventId);
    if (
      !event ||
      (req.user!.role !== "ADMIN" && !event.organizer.equals(req.user!._id))
    )
      throw new HttpError(403, "You cannot check in attendees for this event");
    if (
      !["PUBLISHED", "SOLD_OUT"].includes(event.status) ||
      event.endDate < new Date() ||
      event.startDate.getTime() - Date.now() > 12 * 3600000
    )
      throw new HttpError(
        409,
        "Check-in opens 12 hours before the event and closes at its end",
      );
    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
        const ticket = await Ticket.findOne({
          event: event._id,
          $or: [
            { ticketNumber: input.ticketId },
            { qrVerificationId: input.ticketId },
          ],
        }).session(session);
        if (!ticket)
          throw new HttpError(404, "Ticket not found for this event");
        if (
          await Refund.exists({
            booking: ticket.booking,
            status: { $in: ["REQUESTED", "APPROVED", "PROCESSED"] },
          }).session(session)
        )
          throw new HttpError(
            409,
            "This ticket has an active refund request; entry denied",
          );
        if (
          !(await Booking.exists({
            _id: ticket.booking,
            status: "CONFIRMED",
            paymentStatus: "COMPLETED",
          }).session(session))
        )
          throw new HttpError(409, "This booking is not paid and confirmed");
        const used = await Ticket.findOneAndUpdate(
          { _id: ticket._id, status: "VALID" },
          {
            status: "USED",
            checkedInAt: new Date(),
            checkedInBy: req.user!._id,
          },
          { new: true, session },
        ).populate("ticketType");
        if (!used)
          throw new HttpError(
            409,
            `Ticket is ${ticket.status.toLowerCase()}; entry denied`,
          );
        await CheckIn.create(
          [{ ticket: ticket._id, event: event._id, organizer: req.user!._id }],
          { session },
        );
        const remaining = await Ticket.countDocuments({
          booking: ticket.booking,
          status: "VALID",
        }).session(session);
        if (!remaining)
          await Booking.updateOne(
            { _id: ticket.booking },
            { checkedIn: true, checkedInAt: new Date() },
            { session },
          );
        result = {
          ticketNumber: used.ticketNumber,
          attendeeName: used.attendeeName,
          ticketType: (used.ticketType as any).name,
          checkedInAt: used.checkedInAt,
        };
      });
    } finally {
      await session.endSession();
    }
    ok(res, result, "Entry confirmed");
  }),
);
