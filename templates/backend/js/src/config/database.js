import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    dbName: env.dbName
  });

  console.log(`MongoDB connected: ${env.dbName}`);
}
