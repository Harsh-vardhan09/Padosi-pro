import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const { DATABASE_URL, DB_SSL } = config();

// Prisma 7 talks to Postgres through a JS driver adapter instead of a Rust engine.
// Supabase serves a chain Node will not verify by default; traffic is still encrypted.
const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  ...(DB_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const prisma = new PrismaClient({ adapter });
