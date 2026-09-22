import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth, requireAdmin } from '../middleware/session.js';
import { asyncRoute as run, HttpError, ok, id, text, pagination, pageInfo, escapeRegex } from '../utils/http.js';
import { User } from '../models/User.js';
import { OrganizerProfile } from '../models/OrganizerProfile.js';
import { Event } from '../models/Event.js';
import { Category } from '../models/Category.js';
import { Venue } from '../models/Venue.js';
import { Booking } from '../models/Booking.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Refund } from '../models/Refund.js';
import { Payout } from '../models/Payout.js';
import { Coupon } from '../models/Coupon.js';
import { Review } from '../models/Review.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { PlatformSetting } from '../models/PlatformSetting.js';
import { Article } from '../models/Article.js';
import { notify } from '../services/notifications.js';
import { processRefund } from '../services/finance.js';
import { env } from '../config/env.js';
export const admin = Router(); admin.use(requireAuth, requireAdmin);
const audit = async (req: any, action: string, entity: string, entityId: string, metadata: any = {}) => AuditLog.create({ actor: req.user._id, actorEmail: req.user.email, action, entity, entityId, metadata, ipAddress: req.ip });
admin.get('/stats', run(async (_req, res) => {
  const [totalUsers, totalOrganizers, totalEvents, pendingEvents, publishedEvents, totals, recentUsers, recentEvents, daily, refunds, payouts] = await Promise.all([
    User.countDocuments({ role: 'USER' }), User.countDocuments({ role: 'ORGANIZER' }), Event.countDocuments(), Event.countDocuments({ status: 'PENDING_REVIEW' }), Event.countDocuments({ status: 'PUBLISHED' }),
    Booking.aggregate([{ $match: { paymentStatus: 'COMPLETED' } }, { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } }]),
    User.find().sort({ createdAt: -1 }).limit(5), Event.find({ status: 'PENDING_REVIEW' }).populate('organizer', 'name email').sort({ createdAt: 1 }).limit(5),
    Booking.aggregate([{ $match: { paymentStatus: 'COMPLETED' } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: '$total' }, bookings: { $sum: 1 } } }, { $sort: { _id: 1 } }]), Refund.countDocuments({ status: 'REQUESTED' }), Payout.countDocuments({ status: 'REQUESTED' })
  ]); ok(res, { stats: { totalUsers, totalOrganizers, totalEvents, pendingEvents, publishedEvents, totalRevenue: totals[0]?.revenue || 0, totalBookings: totals[0]?.count || 0, refunds, payouts }, recentUsers, recentEvents, daily });
}));
admin.put('/users/:id/status', run(async (req, res) => { const userId = id.parse(req.params.id); const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body); if (userId === req.user!._id.toString()) throw new HttpError(409, 'You cannot disable your own account'); const user = await User.findOneAndUpdate({ _id: userId, role: { $ne: 'ADMIN' } }, { isActive, $inc: { tokenVersion: 1 } }, { new: true }); if (!user) throw new HttpError(404, 'User not found or protected administrator'); await audit(req, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'User', userId); ok(res, { user }); }));
admin.put('/organizers/:id/status', run(async (req, res) => { const { status, reason } = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']), reason: text }).parse(req.body); const profile = await OrganizerProfile.findByIdAndUpdate(id.parse(req.params.id), { status }, { new: true }); if (!profile) throw new HttpError(404, 'Organizer not found'); await notify(profile.user, 'ORGANIZER', `Organizer profile ${status.toLowerCase()}`, reason, `organizer:${profile._id}:${Date.now()}`); await audit(req, `ORGANIZER_${status}`, 'OrganizerProfile', profile._id.toString(), { reason }); ok(res, { profile }); }));
admin.put('/events/:id/moderate', run(async (req, res) => {
  const { status, reason } = z.object({ status: z.enum(['PUBLISHED', 'REJECTED', 'CANCELLED']), reason: text }).parse(req.body);
  const event = await Event.findById(id.parse(req.params.id)); if (!event) throw new HttpError(404, 'Event not found');
  if (status === 'PUBLISHED' && !await OrganizerProfile.exists({ user: event.organizer, status: 'APPROVED' }) && !await User.exists({ _id: event.organizer, role: 'ADMIN' })) throw new HttpError(409, 'Approve organizer profile before publishing');
  if (status !== 'CANCELLED' && event.status !== 'PENDING_REVIEW') throw new HttpError(409, 'Only submitted events can be moderated');
  event.status = status; event.moderationReason = reason; await event.save();
  await notify(event.organizer, 'EVENT', `Event ${status.toLowerCase()}`, `${event.title}: ${reason}`, `event:${event._id}:${Date.now()}`);
  await audit(req, `EVENT_${status}`, 'Event', event._id.toString(), { reason }); ok(res, { event });
}));
admin.put('/events/:id/curation', run(async (req, res) => { const input = z.object({ featured: z.boolean(), trending: z.boolean() }).parse(req.body); const event = await Event.findByIdAndUpdate(id.parse(req.params.id), input, { new: true }); await audit(req, 'EVENT_CURATED', 'Event', String(req.params.id), input); ok(res, { event }); }));
admin.post('/categories', run(async (req, res) => { const input = z.object({ name: text.max(100), description: z.string().max(1000).default('') }).parse(req.body); const category = await Category.create({ ...input, slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }); await audit(req, 'CATEGORY_CREATED', 'Category', category._id.toString()); ok(res, { category }, 'Category created', 201); }));
admin.put('/categories/:id', run(async (req, res) => { const input = z.object({ isActive: z.boolean() }).parse(req.body); const category = await Category.findByIdAndUpdate(id.parse(req.params.id), input, { new: true }); await audit(req, 'CATEGORY_UPDATED', 'Category', String(req.params.id), input); ok(res, { category }); }));
admin.put('/reviews/:id/moderate', run(async (req, res) => {
  const { isVerified } = z.object({ isVerified: z.boolean() }).parse(req.body); const session = await mongoose.startSession();
  try { await session.withTransaction(async () => { const review = await Review.findByIdAndUpdate(id.parse(req.params.id), { isVerified }, { session }); if (!review) throw new HttpError(404, 'Review not found'); const reviews = await Review.find({ event: review.event, isVerified: true }).session(session); await Event.updateOne({ _id: review.event }, { rating: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0, reviewCount: reviews.length }, { session }); }); } finally { await session.endSession(); }
  await audit(req, 'REVIEW_MODERATED', 'Review', String(req.params.id), { isVerified }); ok(res);
}));
admin.put('/refunds/:id/status', run(async (req, res) => { const { status, notes } = z.object({ status: z.enum(['APPROVED', 'REJECTED']), notes: text }).parse(req.body); const refund = await Refund.findOneAndUpdate({ _id: id.parse(req.params.id), status: 'REQUESTED' }, { status, notes, processedBy: req.user!._id }, { new: true }); if (!refund) throw new HttpError(409, 'Refund already reviewed'); await audit(req, `REFUND_${status}`, 'Refund', refund._id.toString(), { notes }); await notify(refund.user, 'REFUND', `Refund ${status.toLowerCase()}`, notes, `refund:${refund._id}:${status}`); ok(res, { refund }); }));
admin.post('/refunds/:id/process', run(async (req, res) => { const refund = await processRefund(id.parse(req.params.id)); await audit(req, 'REFUND_PROVIDER_CHECKED', 'Refund', String(req.params.id)); ok(res, { refund }, refund?.status === 'PROCESSED' ? 'Provider confirmed refund' : 'Refund pending provider confirmation'); }));
admin.put('/payouts/:id/status', run(async (req, res) => {
  const { status, notes, referenceId } = z.object({ status: z.enum(['PROCESSING', 'REJECTED', 'COMPLETED']), notes: text, referenceId: z.string().max(100).optional() }).parse(req.body);
  const payout = await Payout.findById(id.parse(req.params.id)); if (!payout || !['REQUESTED', 'PROCESSING'].includes(payout.status)) throw new HttpError(409, 'Payout is not awaiting processing');
  if (status === 'COMPLETED') {
    if (!referenceId?.startsWith('pout_') || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new HttpError(400, 'Provide the RazorpayX payout reference and configured credentials');
    const response = await fetch(`https://api.razorpay.com/v1/payouts/${encodeURIComponent(referenceId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}` } });
    if (!response.ok) throw new HttpError(502, 'Could not verify payout with provider'); const remote = await response.json() as any;
    if (remote.status !== 'processed' || remote.amount !== Math.round(payout.amount * 100) || remote.currency !== 'INR' || remote.notes?.eventraPayout !== payout._id.toString()) throw new HttpError(409, 'Payout amount, status or Eventra reference does not match');
    if (await Payout.exists({ referenceId, _id: { $ne: payout._id } })) throw new HttpError(409, 'Provider payout already linked'); payout.processedAt = new Date(); payout.referenceId = referenceId;
  }
  payout.status = status; payout.notes = notes; await payout.save(); await audit(req, `PAYOUT_${status}`, 'Payout', payout._id.toString(), { referenceId }); await notify(payout.organizer, 'PAYOUT', `Payout ${status.toLowerCase()}`, notes, `payout:${payout._id}:${status}`); ok(res, { payout });
}));
admin.post('/notifications', run(async (req, res) => { const input = z.object({ user: id, title: text.max(150), message: text.max(2000) }).parse(req.body); const user = await User.findById(input.user); if (!user) throw new HttpError(404, 'Recipient not found'); await notify(user._id, 'SYSTEM', input.title, input.message, `system:${new mongoose.Types.ObjectId()}`); await audit(req, 'NOTIFICATION_SENT', 'User', input.user); ok(res, {}, 'Notification sent'); }));
admin.get('/settings', run(async (_req, res) => ok(res, { settings: await PlatformSetting.find(), integrations: { payments: !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET, uploads: !!env.CLOUDINARY_API_SECRET, email: !!env.EMAIL_HOST, webhooks: !!env.RAZORPAY_WEBHOOK_SECRET } })));
admin.put('/settings', run(async (req, res) => { const value = z.object({ taxPercent: z.number().min(0).max(30), platformFeePercent: z.number().min(0).max(20) }).parse(req.body); await PlatformSetting.updateOne({ key: 'pricing' }, { value, updatedBy: req.user!._id }, { upsert: true }); await audit(req, 'SETTINGS_CHANGED', 'PlatformSetting', 'pricing', value); ok(res, {}, 'Pricing settings saved'); }));
admin.post('/resources', run(async (req, res) => { const input = z.object({ title: text, excerpt: text, content: z.string().min(100).max(50000), author: text, category: text, published: z.boolean(), image: z.string().url().optional() }).parse(req.body); const article = await Article.create({ ...input, slug: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`, readingMinutes: Math.ceil(input.content.split(/\s+/).length / 200) }); await audit(req, 'ARTICLE_CREATED', 'Article', article._id.toString()); ok(res, { article }); }));
admin.get('/:resource', run(async (req, res) => {
  const models: Record<string, any> = { users: User, organizers: OrganizerProfile, events: Event, categories: Category, venues: Venue, bookings: Booking, orders: Order, payments: Payment, refunds: Refund, payouts: Payout, coupons: Coupon, reviews: Review, notifications: Notification, 'audit-logs': AuditLog, resources: Article };
  const resource = String(req.params.resource); const model = models[resource]; if (!model) throw new HttpError(404, 'Resource not found');
  const { page, limit } = pagination(req); const filter: any = {}; if (req.query.status) filter.status = z.string().max(40).parse(req.query.status);
  if (req.query.q) { const regex = new RegExp(escapeRegex(z.string().max(100).parse(req.query.q)), 'i'); const fields: Record<string, string[]> = { users: ['name', 'email'], events: ['title', 'city'], organizers: ['organizationName'], categories: ['name'], venues: ['name', 'city'], bookings: ['bookingId', 'attendeeEmail'], coupons: ['code', 'name'] }; if (fields[resource]) filter.$or = fields[resource].map(key => ({ [key]: regex })); }
  let query = model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  if (['bookings', 'orders', 'reviews'].includes(resource)) query = query.populate('event', 'title slug');
  if (resource === 'organizers') query = query.populate('user', 'name email');
  if (resource === 'events') query = query.populate('organizer', 'name email');
  if (['refunds', 'payments'].includes(resource)) query = query.populate('booking', 'bookingId');
  if (resource === 'payouts') query = query.populate('organizer', 'name email');
  ok(res, { items: await query, pagination: pageInfo(await model.countDocuments(filter), page, limit) });
}));
