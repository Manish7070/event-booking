import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';
import { OrganizerProfile } from '../models/OrganizerProfile.js';
import { requireAuth } from '../middleware/session.js';
import { registerSchema, password, profileSchema } from '../validators/schemas.js';
import { asyncRoute as run, ok, email, HttpError } from '../utils/http.js';
import { queueEmail } from '../services/notifications.js';
export const auth = Router();
const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const issue = (user: IUser) => jwt.sign({ id: user._id.toString(), version: user.tokenVersion }, env.JWT_SECRET, { expiresIn: '8h', issuer: 'eventra', audience: 'eventra-client' });
auth.use(rateLimit({ windowMs: 15 * 60000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { message: 'Too many authentication requests. Try again later.' } } }));
auth.post('/register', run(async (req, res) => {
  const input = registerSchema.parse(req.body); const token = crypto.randomBytes(32).toString('hex');
  const session = await mongoose.startSession(); let user!: IUser;
  try { await session.withTransaction(async () => {
    if (await User.exists({ email: input.email }).session(session)) throw new HttpError(409, 'Email already registered');
    [user] = await User.create([{ ...input, password: await bcrypt.hash(input.password, 12), isVerified: false, verificationToken: hash(token), verificationExpiry: new Date(Date.now() + 86400000) }], { session });
    if (input.role === 'ORGANIZER') await OrganizerProfile.create([{ user: user._id, organizationName: input.organizationName, status: 'PENDING' }], { session });
    await queueEmail(`verify:${token}`, input.email, 'Verify your Eventra email', `${env.CLIENT_URL}/verify-email?token=${token}`, session);
  }); } finally { await session.endSession(); }
  ok(res, { user, token: issue(user) }, 'Account created. Check your email to verify your address.', 201);
}));
auth.post('/login', run(async (req, res) => {
  const input = z.object({ email, password: z.string().min(1).max(72) }).parse(req.body);
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user || !user.isActive || !await bcrypt.compare(input.password, user.password!)) throw new HttpError(401, 'Invalid email or password');
  ok(res, { user, token: issue(user) });
}));
auth.get('/me', requireAuth, run(async (req, res) => ok(res, { user: req.user, organizerProfile: req.user!.role === 'ORGANIZER' ? await OrganizerProfile.findOne({ user: req.user!._id }) : null })));
auth.post('/logout', requireAuth, run(async (req, res) => { await User.updateOne({ _id: req.user!._id }, { $inc: { tokenVersion: 1 } }); ok(res, {}, 'Signed out'); }));
auth.put('/profile', requireAuth, run(async (req, res) => { const user = await User.findByIdAndUpdate(req.user!._id, profileSchema.parse(req.body), { new: true, runValidators: true }); ok(res, { user }); }));
auth.post('/change-password', requireAuth, run(async (req, res) => {
  const input = z.object({ currentPassword: z.string().max(72), password }).parse(req.body);
  const user = await User.findById(req.user!._id).select('+password');
  if (!await bcrypt.compare(input.currentPassword, user!.password!)) throw new HttpError(400, 'Current password is incorrect');
  user!.password = await bcrypt.hash(input.password, 12); user!.tokenVersion += 1; await user!.save(); ok(res, { token: issue(user!), user }, 'Password changed; other sessions revoked');
}));
auth.post('/forgot-password', run(async (req, res) => {
  const input = z.object({ email }).parse(req.body); const user = await User.findOne({ email: input.email });
  if (user) { const token = crypto.randomBytes(32).toString('hex'); await User.updateOne({ _id: user._id }, { resetToken: hash(token), resetTokenExpiry: new Date(Date.now() + 3600000) }); await queueEmail(`reset:${token}`, user.email, 'Reset your Eventra password', `${env.CLIENT_URL}/reset-password?token=${token}`); }
  ok(res, {}, 'If this account exists, a reset link will be emailed.');
}));
auth.post('/reset-password', run(async (req, res) => {
  const input = z.object({ token: z.string().length(64), password }).parse(req.body);
  const user = await User.findOneAndUpdate({ resetToken: hash(input.token), resetTokenExpiry: { $gt: new Date() } }, { $set: { password: await bcrypt.hash(input.password, 12) }, $unset: { resetToken: 1, resetTokenExpiry: 1 }, $inc: { tokenVersion: 1 } });
  if (!user) throw new HttpError(400, 'Reset link is invalid or expired'); ok(res, {}, 'Password reset. Sign in with your new password.');
}));
auth.post('/verify-email', run(async (req, res) => {
  const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
  const user = await User.findOneAndUpdate({ verificationToken: hash(token), verificationExpiry: { $gt: new Date() } }, { $set: { isVerified: true }, $unset: { verificationToken: 1, verificationExpiry: 1 } });
  if (!user) throw new HttpError(400, 'Verification link is invalid or expired'); ok(res, {}, 'Email verified');
}));
auth.post('/resend-verification', requireAuth, run(async (req, res) => {
  if (!req.user!.isVerified) { const token = crypto.randomBytes(32).toString('hex'); await User.updateOne({ _id: req.user!._id }, { verificationToken: hash(token), verificationExpiry: new Date(Date.now() + 86400000) }); await queueEmail(`verify:${token}`, req.user!.email, 'Verify your email', `${env.CLIENT_URL}/verify-email?token=${token}`); }
  ok(res, {}, 'Verification email queued');
}));
