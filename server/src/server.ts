import { env } from './config/env.js';
import { connectDB } from './config/database.js';
import mongoose from 'mongoose';
import app from './app.js';
async function start() {
  await connectDB(); const server = app.listen(env.PORT, () => console.log(`Eventra API listening on ${env.PORT}`));
  const shutdown = () => { server.close(() => { mongoose.disconnect().then(() => process.exit(0)).catch(() => process.exit(1)); }); setTimeout(() => process.exit(1), 10000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
start().catch(() => { console.error('Startup failed. Check required environment and MongoDB connectivity.'); process.exit(1); });
