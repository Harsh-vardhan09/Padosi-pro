import 'dotenv/config';

process.env.NODE_ENV = 'test';

// Tests own the database connection outright rather than inheriting half of it from .env. Integration
// runs against TEST_DATABASE_URL; every other run gets a placeholder that is never dialled, so a
// stray test cannot reach real data — and a Supabase DB_SSL=true cannot reach a plaintext test server.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL =
  testDatabaseUrl !== undefined && testDatabaseUrl.trim() !== ''
    ? testDatabaseUrl
    : 'postgres://test:test@localhost:5432/test';
process.env.DB_SSL = process.env.TEST_DB_SSL ?? 'false';

process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-16';
process.env.OTP_PEPPER ??= 'test-otp-pepper-at-least-16';
process.env.MAIL_DRIVER = 'console';
