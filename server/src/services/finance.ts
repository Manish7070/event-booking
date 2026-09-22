import mongoose, { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Event } from '../models/Event.js';
import { Payout } from '../models/Payout.js';
import { Refund } from '../models/Refund.js';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { Order } from '../models/Order.js';
import { TicketType } from '../models/TicketType.js';
import { gateway } from './payments.js';
import { toPaise, toRupees } from './bookings.js';
import { HttpError } from '../utils/http.js';
import { notify } from './notifications.js';
export async function balance(organizer: Types.ObjectId) {
  const events = await Event.find({ organizer, endDate: { $lt: new Date(Date.now() - 7 * 86400000) } }).select('_id');
  const bookings = await Booking.find({ event: { $in: events.map(e => e._id) }, paymentStatus: 'COMPLETED' });
  const refunds = await Refund.find({ booking: { $in: bookings.map(b => b._id) }, status: { $in: ['REQUESTED', 'APPROVED', 'PROCESSED'] } });
  const blocked = new Set(refunds.map(r => r.booking.toString()));
  const earned = bookings.filter(b => !blocked.has(b._id.toString())).reduce((s, b) => s + toPaise(b.subtotal) - toPaise(b.discount), 0);
  const payouts = await Payout.find({ organizer, status: { $in: ['REQUESTED', 'PROCESSING', 'COMPLETED'] } });
  const allocated = payouts.reduce((s, p) => s + toPaise(p.amount), 0);
  return { earned: toRupees(earned), allocated: toRupees(allocated), available: toRupees(Math.max(0, earned - allocated)) };
}
export async function processRefund(refundId: string) {
  const refund = await Refund.findById(refundId); if (!refund) throw new HttpError(404, 'Refund not found');
  if (refund.status === 'PROCESSED') return refund;
  if (refund.status !== 'APPROVED') throw new HttpError(409, 'Refund must be approved first');
  const booking = await Booking.findById(refund.booking); if (!booking?.paymentId) throw new HttpError(409, 'Captured payment reference missing');
  const provider = gateway();
  // Reconcile an ambiguous previous provider response before issuing another refund.
  let providerRefund: any = refund.providerRefundId ? await provider.refunds.fetch(refund.providerRefundId) : null;
  if (!providerRefund) {
    const previous = await provider.payments.fetchMultipleRefund(booking.paymentId, { count: 100 });
    providerRefund = previous.items.find((r: any) => r.notes?.eventraRefund === refundId);
    if (!providerRefund) providerRefund = await provider.payments.refund(booking.paymentId, { amount: toPaise(refund.amount), notes: { eventraRefund: refundId }, receipt: refundId });
    refund.providerRefundId = providerRefund.id; await refund.save();
  }
  if (providerRefund.status !== 'processed') return refund;
  if (Number(providerRefund.amount) !== toPaise(refund.amount) || providerRefund.payment_id !== booking.paymentId) throw new HttpError(409, 'Provider refund does not match');
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const changed = await Refund.findOneAndUpdate({ _id: refund._id, status: 'APPROVED' }, { status: 'PROCESSED', processedAt: new Date() }, { session }); if (!changed) return;
    await Booking.updateOne({ _id: booking._id }, { status: 'REFUNDED', paymentStatus: 'REFUNDED', ticketStatus: 'CANCELLED' }, { session });
    await Order.updateOne({ booking: booking._id }, { bookingStatus: 'REFUNDED', paymentStatus: 'REFUNDED' }, { session });
    await Payment.updateOne({ booking: booking._id }, { status: 'REFUNDED' }, { session });
    await Ticket.updateMany({ booking: booking._id }, { status: 'CANCELLED' }, { session });
    for (const t of booking.tickets) await TicketType.updateOne({ _id: t.ticketType }, { $inc: { soldQuantity: -t.quantity } }, { session });
    await Event.updateOne({ _id: booking.event }, { $inc: { soldTickets: -booking.tickets.reduce((s, t) => s + t.quantity, 0) } }, { session });
    await notify(booking.user, 'REFUND', 'Refund processed', `₹${refund.amount} refunded for ${booking.bookingId}.`, `refund:${refund._id}:processed`, session);
  }); } finally { await session.endSession(); }
  return Refund.findById(refundId);
}
