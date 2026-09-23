import crypto from "crypto";
import mongoose, { ClientSession, Types } from "mongoose";
import { z } from "zod";
import { Booking } from "../models/Booking.js";
import { Event } from "../models/Event.js";
import { TicketType } from "../models/TicketType.js";
import { Coupon } from "../models/Coupon.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { Ticket } from "../models/Ticket.js";
import { PlatformSetting } from "../models/PlatformSetting.js";
import { checkoutSchema, cartSchema } from "../validators/schemas.js";
import { HttpError } from "../utils/http.js";
import { gateway } from "./payments.js";
import { notify } from "./notifications.js";
export const toPaise = (value: number) => Math.round(value * 100);
export const toRupees = (value: number) => value / 100;
export const reference = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
export async function priceCart(
  input: z.infer<typeof cartSchema>,
  user: Types.ObjectId,
  session?: ClientSession,
) {
  const event = await Event.findOne({
    _id: input.eventId,
    status: { $in: ["PUBLISHED", "SOLD_OUT"] },
    startDate: { $gt: new Date() },
  }).session(session || null);
  if (!event)
    throw new HttpError(409, "This event is not available for booking");
  const items = [];
  let subtotalPaise = 0;
  for (const item of input.items) {
    const tier = await TicketType.findOne({
      _id: item.ticketTypeId,
      event: event._id,
      isActive: true,
    }).session(session || null);
    if (!tier) throw new HttpError(400, "Invalid ticket type");
    if (
      (tier.saleStartDate && tier.saleStartDate > new Date()) ||
      (tier.saleEndDate && tier.saleEndDate <= new Date())
    )
      throw new HttpError(409, "Ticket sales are closed for this tier");
    const previous = await Booking.find({
      user,
      event: event._id,
      status: { $in: ["PENDING", "CONFIRMED"] },
    }).session(session || null);
    const purchased = previous.reduce(
      (sum, b) =>
        sum +
        b.tickets
          .filter((t) => t.ticketType.toString() === item.ticketTypeId)
          .reduce((s, t) => s + t.quantity, 0),
      0,
    );
    if (item.quantity + purchased > tier.maxPerBooking)
      throw new HttpError(
        409,
        `${tier.name}: maximum ${tier.maxPerBooking} tickets per customer, including pending orders`,
      );
    if (
      tier.totalQuantity - tier.soldQuantity - (tier.reservedQuantity || 0) <
      item.quantity
    )
      throw new HttpError(409, `${tier.name}: not enough tickets remaining`);
    subtotalPaise += toPaise(tier.price) * item.quantity;
    items.push({
      ticketType: tier._id,
      name: tier.name,
      price: tier.price,
      quantity: item.quantity,
    });
  }
  let discountPaise = 0;
  let coupon = null;
  if (input.couponCode) {
    coupon = await Coupon.findOne({
      code: input.couponCode.toUpperCase(),
      isActive: true,
    }).session(session || null);
    if (
      !coupon ||
      (coupon.expiryDate && coupon.expiryDate <= new Date()) ||
      (coupon.startsAt && coupon.startsAt > new Date())
    )
      throw new HttpError(400, "Coupon is invalid or expired");
    if (
      (coupon.event && !coupon.event.equals(event._id)) ||
      (coupon.organizer && !coupon.organizer.equals(event.organizer))
    )
      throw new HttpError(400, "Coupon does not apply to this event");
    if (subtotalPaise < toPaise(coupon.minimumOrder))
      throw new HttpError(400, `Minimum order is ₹${coupon.minimumOrder}`);
    if (
      coupon.usageLimit &&
      coupon.usedCount + (coupon.reservedCount || 0) >= coupon.usageLimit
    )
      throw new HttpError(409, "Coupon usage limit reached");
    const used = await Booking.countDocuments({
      user,
      coupon: coupon._id,
      status: { $in: ["PENDING", "CONFIRMED", "REFUNDED"] },
    }).session(session || null);
    if (used >= coupon.perUserLimit)
      throw new HttpError(409, "You have already used or reserved this coupon");
    discountPaise =
      coupon.discountType === "PERCENTAGE"
        ? Math.round((subtotalPaise * coupon.discountValue) / 100)
        : toPaise(coupon.discountValue);
    if (coupon.maximumDiscount != null)
      discountPaise = Math.min(discountPaise, toPaise(coupon.maximumDiscount));
    discountPaise = Math.min(discountPaise, subtotalPaise);
  }
  const setting = await PlatformSetting.findOne({ key: "pricing" }).session(
    session || null,
  );
  const rates = setting?.value || { taxPercent: 18, platformFeePercent: 2 };
  const taxPaise = Math.round(
    ((subtotalPaise - discountPaise) * Number(rates.taxPercent)) / 100,
  );
  const feePaise = Math.round(
    (subtotalPaise * Number(rates.platformFeePercent)) / 100,
  );
  return {
    event,
    items,
    coupon,
    subtotal: toRupees(subtotalPaise),
    discount: toRupees(discountPaise),
    tax: toRupees(taxPaise),
    platformFee: toRupees(feePaise),
    total: toRupees(subtotalPaise - discountPaise + taxPaise + feePaise),
  };
}
export async function releaseBooking(bookingId: Types.ObjectId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: "PENDING", reservationReleased: false },
        {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          reservationReleased: true,
        },
        { new: true, session },
      );
      if (!booking) return;
      for (const item of booking.tickets)
        await TicketType.updateOne(
          { _id: item.ticketType },
          { $inc: { reservedQuantity: -item.quantity } },
          { session },
        );
      if (booking.coupon)
        await Coupon.updateOne(
          { _id: booking.coupon },
          { $inc: { reservedCount: -1 } },
          { session },
        );
      await Order.updateOne(
        { booking: booking._id },
        { bookingStatus: "CANCELLED", paymentStatus: "FAILED" },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}
export async function checkout(
  input: z.infer<typeof checkoutSchema>,
  user: Types.ObjectId,
) {
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const existing = await Booking.findOne({
    user,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new HttpError(
        409,
        "Checkout key was already used for a different request",
      );
    if (existing.status === "CONFIRMED") return existing;
    if (existing.status === "PENDING" && existing.total === 0)
      return (await confirmBooking(existing._id, `free_${existing._id}`))!;
    if (existing.status !== "PENDING" || !existing.paymentOrderId)
      throw new HttpError(
        409,
        "Checkout already processed or initializing. Check your orders.",
      );
    return existing;
  }
  const session = await mongoose.startSession();
  let bookingId!: Types.ObjectId;
  try {
    await session.withTransaction(async () => {
      const quote = await priceCart(input, user, session);
      if (quote.total > 0 && quote.total < 1)
        throw new HttpError(
          400,
          "This checkout requires a payable amount of at least ₹1",
        );
      for (const item of quote.items) {
        const result = await TicketType.updateOne(
          {
            _id: item.ticketType,
            $expr: {
              $gte: [
                {
                  $subtract: [
                    "$totalQuantity",
                    {
                      $add: [
                        "$soldQuantity",
                        { $ifNull: ["$reservedQuantity", 0] },
                      ],
                    },
                  ],
                },
                item.quantity,
              ],
            },
          },
          { $inc: { reservedQuantity: item.quantity } },
          { session },
        );
        if (result.modifiedCount !== 1)
          throw new HttpError(
            409,
            "Tickets just sold out. Refresh availability.",
          );
      }
      if (quote.coupon)
        await Coupon.updateOne(
          { _id: quote.coupon._id },
          { $inc: { reservedCount: 1 } },
          { session },
        );
      const [booking] = await Booking.create(
        [
          {
            bookingId: reference("EVT"),
            user,
            event: quote.event._id,
            tickets: quote.items,
            attendeeName: input.attendeeName,
            attendeeEmail: input.attendeeEmail,
            attendeePhone: input.attendeePhone,
            subtotal: quote.subtotal,
            discount: quote.discount,
            tax: quote.tax,
            platformFee: quote.platformFee,
            total: quote.total,
            coupon: quote.coupon?._id,
            couponCode: quote.coupon?.code,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            expiresAt: new Date(Date.now() + 15 * 60000),
            qrCodeData: "INDIVIDUAL_TICKETS_ONLY",
          },
        ],
        { session },
      );
      bookingId = booking._id;
      await Order.create(
        [
          {
            orderNumber: reference("ORD"),
            user,
            booking: booking._id,
            event: quote.event._id,
            amount: quote.subtotal,
            discount: quote.discount,
            tax: quote.tax,
            platformFee: quote.platformFee,
            finalAmount: quote.total,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  const booking = await Booking.findById(bookingId);
  if (booking!.total === 0)
    return (await confirmBooking(bookingId, `free_${bookingId}`))!;
  try {
    const provider = gateway();
    const order = await provider.orders.create({
      amount: toPaise(booking!.total),
      currency: "INR",
      receipt: bookingId.toString(),
      notes: { bookingId: bookingId.toString() },
    });
    booking!.paymentOrderId = order.id;
    await booking!.save();
  } catch {
    await releaseBooking(bookingId);
    throw new HttpError(
      502,
      "Payment provider could not create an order. No payment was confirmed.",
    );
  }
  return booking!;
}
// Called only after provider capture and amount verification, including signed webhooks.
export async function confirmBooking(
  bookingId: Types.ObjectId,
  paymentId: string,
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new HttpError(404, "Booking not found");
      if (booking.paymentStatus === "COMPLETED") {
        if (booking.paymentId !== paymentId)
          throw new HttpError(409, "Different payment already confirmed");
        return;
      }
      if (booking.status !== "PENDING" || booking.reservationReleased)
        throw new HttpError(
          409,
          "Reservation expired. Contact support with your payment ID.",
          "LATE_PAYMENT",
        );
      const event = await Event.findById(booking.event).session(session);
      if (!event || !["PUBLISHED", "SOLD_OUT"].includes(event.status))
        throw new HttpError(
          409,
          "Event is no longer available. Contact support for your captured payment.",
        );
      booking.status = "CONFIRMED";
      booking.paymentStatus = "COMPLETED";
      booking.paymentId = paymentId;
      await booking.save({ session });
      await Order.updateOne(
        { booking: booking._id },
        { paymentStatus: "COMPLETED", bookingStatus: "CONFIRMED" },
        { session },
      );
      await Payment.create(
        [
          {
            booking: booking._id,
            user: booking.user,
            amount: booking.total,
            gateway: booking.total === 0 ? "free" : "razorpay",
            paymentMethod: booking.total === 0 ? "free" : "razorpay",
            currency: "INR",
            status: "COMPLETED",
            razorpayOrderId: booking.paymentOrderId,
            razorpayPaymentId: booking.total === 0 ? undefined : paymentId,
            transactionId: paymentId,
          },
        ],
        { session },
      );
      let count = 0;
      const tickets = [];
      for (const item of booking.tickets) {
        const changed = await TicketType.updateOne(
          { _id: item.ticketType, reservedQuantity: { $gte: item.quantity } },
          {
            $inc: {
              reservedQuantity: -item.quantity,
              soldQuantity: item.quantity,
            },
          },
          { session },
        );
        if (!changed.modifiedCount)
          throw new HttpError(
            409,
            "Inventory reservation requires reconciliation",
          );
        count += item.quantity;
        for (let i = 0; i < item.quantity; i++)
          tickets.push({
            ticketNumber: reference("TCK"),
            qrVerificationId: crypto.randomBytes(32).toString("hex"),
            booking: booking._id,
            event: booking.event,
            ticketType: item.ticketType,
            user: booking.user,
            attendeeName: booking.attendeeName,
            attendeeEmail: booking.attendeeEmail,
            price: item.price,
            status: "VALID",
          });
      }
      await Ticket.insertMany(tickets, { session });
      await Event.updateOne(
        { _id: booking.event },
        { $inc: { soldTickets: count } },
        { session },
      );
      if (booking.coupon)
        await Coupon.updateOne(
          { _id: booking.coupon },
          { $inc: { reservedCount: -1, usedCount: 1 } },
          { session },
        );
      await notify(
        booking.user,
        "BOOKING",
        "Your tickets are confirmed",
        `${booking.bookingId}: ${count} tickets for ${event.title}. Open My Tickets to view each unique entry pass.`,
        `booking:${booking._id}`,
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  return Booking.findById(bookingId);
}
