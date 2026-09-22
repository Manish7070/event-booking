import { ClientSession, Types } from 'mongoose';
import { Notification } from '../models/Notification.js';
import { EmailJob } from '../models/EmailJob.js';
import { User } from '../models/User.js';
export async function notify(user: Types.ObjectId, type: string, title: string, message: string, key: string, session?: ClientSession) {
  await Notification.updateOne({ 'data.key': key, user }, { $setOnInsert: { user, type, title, message, data: { key } } }, { upsert: true, session });
  const account = await User.findById(user).session(session || null);
  if (account?.preferences?.notifications !== false && account) await queueEmail(key, account.email, title, message, session);
}
export async function queueEmail(key: string, to: string, subject: string, text: string, session?: ClientSession) {
  await EmailJob.updateOne({ key }, { $setOnInsert: { key, to, subject, text } }, { upsert: true, session });
}
