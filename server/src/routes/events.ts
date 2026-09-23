import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Event } from "../models/Event.js";
import { Category } from "../models/Category.js";
import { Venue } from "../models/Venue.js";
import { TicketType } from "../models/TicketType.js";
import { Review } from "../models/Review.js";
import { Article } from "../models/Article.js";
import {
  requireAuth,
  requireOrganizer,
  requireApproved,
} from "../middleware/session.js";
import {
  asyncRoute as run,
  ok,
  HttpError,
  id,
  pagination,
  pageInfo,
  escapeRegex,
} from "../utils/http.js";
import { eventSchema, venueSchema } from "../validators/schemas.js";
export const events = Router();
const publicFilter = {
  status: { $in: ["PUBLISHED", "SOLD_OUT"] },
  visibility: "PUBLIC",
};
events.get(
  "/events",
  run(async (req, res) => {
    const input = z
      .object({
        q: z.string().max(120).optional(),
        category: z.string().max(120).optional(),
        city: z.string().max(100).optional(),
        venue: id.optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        minPrice: z.coerce.number().min(0).optional(),
        maxPrice: z.coerce.number().min(0).optional(),
        eventType: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]).optional(),
        available: z.enum(["true", "false"]).optional(),
        sort: z
          .enum([
            "newest",
            "relevance",
            "date_asc",
            "date_desc",
            "price_asc",
            "price_desc",
            "popular",
          ])
          .default("date_asc"),
        featured: z.enum(["true", "false"]).optional(),
        trending: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);
    const { page, limit } = pagination(req);
    const filter: any = {
      ...publicFilter,
      startDate: { $gte: input.startDate || new Date() },
    };
    if (input.endDate) filter.startDate.$lte = input.endDate;
    if (input.category) {
      const category = await Category.findOne(
        mongoose.isValidObjectId(input.category)
          ? { _id: input.category }
          : { slug: input.category },
      );
      filter.category = category?._id || null;
    }
    if (input.city)
      filter.city = new RegExp(`^${escapeRegex(input.city)}$`, "i");
    if (input.venue) filter.venue = input.venue;
    if (input.q) {
      const regex = new RegExp(escapeRegex(input.q), "i");
      const [venues, categories] = await Promise.all([
        Venue.find({ name: regex }).select("_id").limit(100),
        Category.find({ name: regex }).select("_id").limit(100),
      ]);
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
        { city: regex },
        { venue: { $in: venues.map((v) => v._id) } },
        { category: { $in: categories.map((c) => c._id) } },
      ];
    }
    if (input.minPrice !== undefined || input.maxPrice !== undefined)
      filter.minPrice = {
        ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
        ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
      };
    if (input.featured === "true") filter.featured = true;
    if (input.trending === "true") filter.trending = true;
    if (input.eventType) filter.eventType = input.eventType;
    if (input.available === "true")
      filter.$expr = { $lt: ["$soldTickets", "$totalTickets"] };
    const sorts: Record<string, any> = {
      newest: { createdAt: -1 },
      relevance: { featured: -1, startDate: 1 },
      date_asc: { startDate: 1 },
      date_desc: { startDate: -1 },
      price_asc: { minPrice: 1 },
      price_desc: { minPrice: -1 },
      popular: { soldTickets: -1, views: -1 },
    };
    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate("category", "name slug color")
        .populate("venue", "name city")
        .populate("organizer", "name avatar")
        .sort(sorts[input.sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter),
    ]);
    ok(res, { events: items, pagination: pageInfo(total, page, limit) });
  }),
);
events.get(
  "/discovery",
  run(async (_req, res) => {
    const filter = { ...publicFilter, startDate: { $gt: new Date() } };
    const [categories, cities, reviews, featured, trending, upcoming] =
      await Promise.all([
        Category.find({ isActive: true }).sort({ name: 1 }),
        Event.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$city",
              count: { $sum: 1 },
              image: { $first: "$coverImage" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 12 },
        ]),
        Review.find({ isVerified: true })
          .populate("user", "name avatar")
          .populate("event", "title slug")
          .sort({ createdAt: -1 })
          .limit(3),
        Event.find({ ...filter, featured: true })
          .populate("category venue")
          .sort({ startDate: 1 })
          .limit(4),
        Event.find({ ...filter, trending: true })
          .populate("category venue")
          .sort({ soldTickets: -1 })
          .limit(4),
        Event.find(filter)
          .populate("category venue")
          .sort({ startDate: 1 })
          .limit(8),
      ]);
    ok(res, { categories, cities, reviews, featured, trending, upcoming });
  }),
);
events.get(
  "/events/:slug",
  run(async (req, res) => {
    const event = await Event.findOne({
      status: { $in: ["PUBLISHED", "SOLD_OUT"] },
      visibility: { $in: ["PUBLIC", "UNLISTED"] },
      slug: req.params.slug,
    })
      .populate("category venue")
      .populate("organizer", "name avatar");
    if (!event) throw new HttpError(404, "Event not found");
    await Event.updateOne({ _id: event._id }, { $inc: { views: 1 } });
    const ticketTypes = await TicketType.find({
      event: event._id,
      isActive: true,
    }).sort({ price: 1 });
    const similar = await Event.find({
      ...publicFilter,
      category: event.category._id,
      _id: { $ne: event._id },
      startDate: { $gt: new Date() },
    })
      .populate("category venue")
      .limit(3);
    ok(res, { event, ticketTypes, similar });
  }),
);
events.get(
  "/categories",
  run(async (_req, res) =>
    ok(res, {
      categories: await Category.find({ isActive: true }).sort({ name: 1 }),
    }),
  ),
);
events.get(
  "/venues",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const filter: any = { isActive: true };
    if (req.query.q)
      filter.name = new RegExp(
        escapeRegex(z.string().max(100).parse(req.query.q)),
        "i",
      );
    const [venues, total] = await Promise.all([
      Venue.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Venue.countDocuments(filter),
    ]);
    ok(res, { venues, pagination: pageInfo(total, page, limit) });
  }),
);
events.get(
  "/venues/:slug",
  run(async (req, res) => {
    const venue = await Venue.findOne({
      slug: req.params.slug,
      isActive: true,
    });
    if (!venue) throw new HttpError(404, "Venue not found");
    const list = await Event.find({
      ...publicFilter,
      venue: venue._id,
      startDate: { $gt: new Date() },
    })
      .populate("category venue")
      .limit(12);
    ok(res, { venue, events: list });
  }),
);
events.post(
  "/venues",
  requireAuth,
  requireOrganizer,
  run(async (req, res) => {
    const input = venueSchema.parse(req.body);
    const venue = await Venue.create({
      ...input,
      slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
    });
    ok(res, { venue }, "Venue created", 201);
  }),
);
events.get(
  "/resources",
  run(async (req, res) => {
    const { page, limit } = pagination(req);
    const [articles, total] = await Promise.all([
      Article.find({ published: true })
        .select("-content")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Article.countDocuments({ published: true }),
    ]);
    ok(res, { articles, pagination: pageInfo(total, page, limit) });
  }),
);
events.get(
  "/resources/:slug",
  run(async (req, res) => {
    const article = await Article.findOne({
      slug: req.params.slug,
      published: true,
    });
    if (!article) throw new HttpError(404, "Article not found");
    ok(res, {
      article,
      related: await Article.find({
        published: true,
        _id: { $ne: article._id },
      })
        .select("-content")
        .limit(3),
    });
  }),
);
events.post(
  "/events",
  requireAuth,
  requireOrganizer,
  run(async (req, res) => {
    const input = eventSchema.parse(req.body);
    const session = await mongoose.startSession();
    let event: any;
    try {
      await session.withTransaction(async () => {
        const venue = await Venue.findOne({
          _id: input.venue,
          isActive: true,
        }).session(session);
        if (
          !venue ||
          !(await Category.exists({
            _id: input.category,
            isActive: true,
          }).session(session))
        )
          throw new HttpError(400, "Choose a valid venue and category");
        if (input.status === "PENDING_REVIEW" && input.startDate <= new Date())
          throw new HttpError(400, "Choose a future date");
        [event] = await Event.create(
          [
            {
              ...input,
              city: venue.city,
              organizer: req.user!._id,
              slug: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new mongoose.Types.ObjectId()}`,
              minPrice: Math.min(...input.tickets.map((t) => t.price)),
              maxPrice: Math.max(...input.tickets.map((t) => t.price)),
              totalTickets: input.tickets.reduce(
                (s, t) => s + t.totalQuantity,
                0,
              ),
            },
          ],
          { session },
        );
        await TicketType.insertMany(
          input.tickets.map((t) => ({
            ...t,
            _id: undefined,
            event: event._id,
          })),
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    ok(res, { event }, "Event saved", 201);
  }),
);
events.put(
  "/events/:id",
  requireAuth,
  requireOrganizer,
  run(async (req, res) => {
    const input = eventSchema.parse(req.body);
    const eventId = id.parse(req.params.id);
    const session = await mongoose.startSession();
    let event: any;
    try {
      await session.withTransaction(async () => {
        event = await Event.findById(eventId).session(session);
        if (
          !event ||
          (req.user!.role !== "ADMIN" && !event.organizer.equals(req.user!._id))
        )
          throw new HttpError(403, "Event ownership required");
        const tiers = await TicketType.find({ event: eventId }).session(
          session,
        );
        if (tiers.some((t) => t.soldQuantity > 0 || t.reservedQuantity > 0))
          throw new HttpError(
            409,
            "Events with sales or reservations cannot be edited. Contact administration.",
          );
        const venue = await Venue.findById(input.venue).session(session);
        if (
          !venue ||
          !(await Category.exists({ _id: input.category }).session(session))
        )
          throw new HttpError(400, "Invalid venue/category");
        Object.assign(event, input, {
          city: venue.city,
          status: input.status,
          minPrice: Math.min(...input.tickets.map((t) => t.price)),
          maxPrice: Math.max(...input.tickets.map((t) => t.price)),
          totalTickets: input.tickets.reduce((s, t) => s + t.totalQuantity, 0),
        });
        await event.save({ session });
        await TicketType.deleteMany({ event: eventId }).session(session);
        await TicketType.insertMany(
          input.tickets.map((t) => ({ ...t, _id: undefined, event: eventId })),
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    ok(res, { event }, "Changes saved for review");
  }),
);
events.get(
  "/organizers/events/:id",
  requireAuth,
  requireOrganizer,
  run(async (req, res) => {
    const event = await Event.findById(id.parse(req.params.id));
    if (
      !event ||
      (req.user!.role !== "ADMIN" && !event.organizer.equals(req.user!._id))
    )
      throw new HttpError(403, "Event ownership required");
    ok(res, { event, tickets: await TicketType.find({ event: event._id }) });
  }),
);
events.post(
  "/events/:id/submit",
  requireAuth,
  requireOrganizer,
  requireApproved,
  run(async (req, res) => {
    const event = await Event.findOneAndUpdate(
      {
        _id: id.parse(req.params.id),
        organizer: req.user!._id,
        status: { $in: ["DRAFT", "REJECTED"] },
        startDate: { $gt: new Date() },
      },
      { status: "PENDING_REVIEW" },
      { new: true },
    );
    if (!event) throw new HttpError(409, "Event cannot be submitted");
    ok(res, { event });
  }),
);
