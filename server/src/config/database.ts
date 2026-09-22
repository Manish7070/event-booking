import mongoose from 'mongoose';
import { env } from './env.js';
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose;
  return mongoose.connect(env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000, autoIndex: env.NODE_ENV !== 'production' });
};
