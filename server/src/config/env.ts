import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).regex(/^mongodb(\+srv)?:\/\//), JWT_SECRET: z.string().min(32), CLIENT_URL: z.string().url().default('http://localhost:5173'),
  RAZORPAY_KEY_ID: z.string().default(''), RAZORPAY_KEY_SECRET: z.string().default(''), RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''), CLOUDINARY_API_KEY: z.string().default(''), CLOUDINARY_API_SECRET: z.string().default(''),
  EMAIL_HOST: z.string().default(''), EMAIL_PORT: z.coerce.number().default(587), EMAIL_USER: z.string().default(''), EMAIL_PASS: z.string().default(''), EMAIL_FROM: z.string().default(''),
  JOB_SECRET: z.string().default(''), TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});
export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && (!env.MONGODB_URI.startsWith('mongodb+srv://') || env.JOB_SECRET.length < 32)) throw new Error('Production requires Atlas and a JOB_SECRET of at least 32 characters.');
