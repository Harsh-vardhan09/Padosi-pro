// Unit tests never touch a database or send mail, but importing the app loads config, so give it a
// valid environment. Real values come from .env at runtime, never from here.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-16';
process.env.OTP_PEPPER ??= 'test-otp-pepper-at-least-16';
process.env.MAIL_DRIVER = 'console';
