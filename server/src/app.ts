import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { auth } from './routes/auth.js';
import { events } from './routes/events.js';
import { commerce } from './routes/commerce.js';
import { community } from './routes/community.js';
import { workspaces } from './routes/workspaces.js';
import { admin } from './routes/admin.js';
import { uploads } from './routes/uploads.js';
import { Booking } from './models/Booking.js';
import { asyncRoute as run, HttpError, ok } from './utils/http.js';
import { validSignature, verifiedPayment } from './services/payments.js';
import { confirmBooking, toPaise } from './services/bookings.js';
import { maintenance } from './jobs/maintenance.js';
const app = express();
app.disable('x-powered-by'); app.set('trust proxy', env.TRUST_PROXY); app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '256kb' }), run(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !validSignature(req.body, String(req.headers['x-razorpay-signature'] || ''), env.RAZORPAY_WEBHOOK_SECRET)) throw new HttpError(400, 'Invalid webhook signature');
  const payload = JSON.parse(req.body.toString());
  if (payload.event === 'payment.captured') {
    const payment = payload.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id) throw new HttpError(400, 'Invalid payment event');
    const booking = await Booking.findOne({ paymentOrderId: payment.order_id });
    if (booking) { await verifiedPayment(booking.paymentOrderId!, payment.id, toPaise(booking.total)); await confirmBooking(booking._id, payment.id); }
  }
  ok(res);
}));
app.use(express.json({ limit: '256kb' }));
app.use('/api', rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { message: 'Too many requests. Try again shortly.' } } }));
app.get('/api/v1/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ success: mongoose.connection.readyState === 1, message: mongoose.connection.readyState === 1 ? 'Ready' : 'Database unavailable' }));
app.post('/api/v1/jobs/run', run(async (req, res) => { if (!env.JOB_SECRET || req.headers.authorization !== `Bearer ${env.JOB_SECRET}`) throw new HttpError(401, 'Unauthorized'); ok(res, await maintenance()); }));
app.use('/api/v1/auth', auth); app.use('/api/v1', events); app.use('/api/v1/admin', admin); app.use('/api/v1/uploads', uploads);
app.use('/api/v1', community); app.use('/api/v1', commerce); app.use('/api/v1', workspaces);
app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')));
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof ZodError || error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'MulterError' ? 400 : error.code === 11000 ? 409 : error.statusCode || 500;
  const message = error instanceof ZodError ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : error.code === 11000 ? 'This record already exists' : status >= 500 ? 'The service could not complete this request. Please retry.' : error.message;
  if (status >= 500) console.error('Request failed:', error.name, error.code || status);
  res.status(status).json({ success: false, message, error: { code: typeof error.code === 'string' ? error.code : 'REQUEST_FAILED', message }, ...(error instanceof ZodError ? { errors: error.flatten().fieldErrors } : {}) });
});
export default app;
