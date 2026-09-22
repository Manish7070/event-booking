import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { Booking } from '../models/Booking.js';
import { Event } from '../models/Event.js';
import { Ticket } from '../models/Ticket.js';
import { Coupon } from '../models/Coupon.js';
import { EmailJob } from '../models/EmailJob.js';
import { notify } from '../services/notifications.js';
import { releaseBooking, confirmBooking, toPaise } from '../services/bookings.js';
import { gateway } from '../services/payments.js';
export async function maintenance() {
  let released = 0, reconciled = 0, sent = 0;
  const pending = await Booking.find({ status: 'PENDING', expiresAt: { $lt: new Date() } }).limit(100);
  for (const booking of pending) {
    if (booking.paymentOrderId) {
      // A provider outage never releases potentially paid stock.
      const payments = await gateway().orders.fetchPayments(booking.paymentOrderId);
      const captured = payments.items.find(p => p.status === 'captured' && Number(p.amount) === toPaise(booking.total) && p.currency === 'INR');
      if (captured) { await confirmBooking(booking._id, captured.id); reconciled++; continue; }
    }
    await releaseBooking(booking._id); released++;
  }
  const upcoming = await Event.find({ status: { $in: ['PUBLISHED', 'SOLD_OUT'] }, startDate: { $gt: new Date(), $lt: new Date(Date.now() + 86400000) } }).limit(100);
  for (const event of upcoming) {
    const bookings = await Booking.find({ event: event._id, status: 'CONFIRMED' });
    for (const booking of bookings) await notify(booking.user, 'REMINDER', `${event.title} is coming up`, 'Your event starts within 24 hours. Open My Tickets for your entry passes.', `reminder:${booking._id}`);
  }
  const ended = await Event.find({ status: { $in: ['PUBLISHED', 'SOLD_OUT'] }, endDate: { $lt: new Date() } }).select('_id');
  await Ticket.updateMany({ event: { $in: ended.map(e => e._id) }, status: 'VALID' }, { status: 'EXPIRED' });
  await Event.updateMany({ _id: { $in: ended.map(e => e._id) } }, { status: 'COMPLETED' });
  await Coupon.updateMany({ expiryDate: { $lt: new Date() }, isActive: true }, { isActive: false });
  if (env.EMAIL_HOST && env.EMAIL_FROM) {
    const transport = nodemailer.createTransport({ host: env.EMAIL_HOST, port: env.EMAIL_PORT, secure: env.EMAIL_PORT === 465, auth: env.EMAIL_USER ? { user: env.EMAIL_USER, pass: env.EMAIL_PASS } : undefined });
    await EmailJob.updateMany({ status: 'SENDING', updatedAt: { $lt: new Date(Date.now() - 10 * 60000) } }, { status: 'PENDING' });
    for (let i = 0; i < 50; i++) {
      const job = await EmailJob.findOneAndUpdate({ status: { $in: ['PENDING', 'FAILED'] }, attempts: { $lt: 5 }, nextAttempt: { $lte: new Date() } }, { status: 'SENDING', $inc: { attempts: 1 } }, { new: true }); if (!job) break;
      try { await transport.sendMail({ from: env.EMAIL_FROM, to: job.to, subject: job.subject || undefined, text: job.text || undefined, messageId: `<${job._id}@eventra>` }); job.status = 'SENT'; job.sentAt = new Date(); sent++; }
      catch { job.status = 'FAILED'; job.nextAttempt = new Date(Date.now() + 2 ** job.attempts * 60000); }
      await job.save();
    }
  }
  return { released, reconciled, sent };
}
