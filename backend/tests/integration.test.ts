import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Only the HMAC of a code reaches the database, so capturing the mail is the only way to learn it.
const mailbox = vi.hoisted(() => ({ sent: [] as { to: string; code: string }[] }));

vi.mock('../src/mail/index.js', () => ({
  createMailer: () => ({
    sendOtp: (email: { to: string; code: string; expiryMinutes: number }) => {
      mailbox.sent.push({ to: email.to, code: email.code });
      return Promise.resolve();
    },
  }),
}));

import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { OTP_MAX_ATTEMPTS } from '../src/services/otp.js';

const PASSWORD = 'Passw0rd123';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const hasTestDatabase = testDatabaseUrl !== undefined && testDatabaseUrl.trim() !== '';

// Parsing each body keeps `any` out of the tests and asserts the contract the mobile app relies on.
const sessionBody = z.object({
  token: z.string().min(1),
  user: z.object({ id: z.string(), email: z.string(), profileCompleted: z.boolean() }),
});

const errorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
});

const meBody = z.object({
  user: z.object({ id: z.string(), email: z.string(), profileCompleted: z.boolean() }),
  profile: z
    .object({
      fullName: z.string(),
      mobile: z.string(),
      address: z.string(),
      businessName: z.string().nullable(),
    })
    .nullable(),
  selectedTaskCount: z.number(),
});

const catalogueBody = z.object({
  categories: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      tasks: z.array(z.object({ id: z.number(), name: z.string(), description: z.string() })),
    }),
  ),
});

const selectedTasksBody = z.object({
  tasks: z.array(z.object({ id: z.number(), categoryId: z.number(), name: z.string() })),
});

const profileBody = z.object({
  profile: z.object({
    fullName: z.string(),
    mobile: z.string(),
    address: z.string(),
    businessName: z.string().nullable(),
  }),
});

const app = createApp();
const request = (): supertest.Agent => supertest(app);

function notTheCode(actual: string): string {
  return actual === '000000' ? '111111' : '000000';
}

function lastCode(): string {
  return mailbox.sent.at(-1)?.code ?? '';
}

async function register(email: string): Promise<void> {
  await request().post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
}

async function registerAndVerify(email: string): Promise<string> {
  await register(email);
  const verified = await request()
    .post('/api/auth/verify-otp')
    .send({ email, code: lastCode() })
    .expect(200);
  return sessionBody.parse(verified.body).token;
}

/** Moves the stored cooldown into the past instead of making the test wait thirty seconds. */
async function expireResendCooldown(): Promise<void> {
  await prisma.emailOtp.updateMany({ data: { lastSentAt: new Date(Date.now() - 31_000) } });
}

describe.skipIf(!hasTestDatabase)('register → verify → login → profile → tasks', () => {
  beforeAll(async () => {
    if ((await prisma.task.count()) === 0) {
      throw new Error(
        'The test database has no task catalogue. Run `npm run db:seed` against TEST_DATABASE_URL.',
      );
    }
  });

  beforeEach(async () => {
    mailbox.sent.length = 0;
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('carries a new user from registration to a saved task selection', async () => {
    const email = 'owner@padosipro.test';

    const registered = await request()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    expect(registered.body).toMatchObject({ email, otpSent: true });

    expect(mailbox.sent).toHaveLength(1);
    expect(mailbox.sent[0]?.to).toBe(email);

    const code = lastCode();
    expect(code).toMatch(/^[0-9]{6}$/);

    const stored = await prisma.emailOtp.findFirst({ select: { codeHash: true } });
    expect(stored?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.codeHash).not.toBe(code);

    const early = await request()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(403);
    expect(errorBody.parse(early.body).error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(early.body).not.toHaveProperty('token');

    const wrong = await request()
      .post('/api/auth/verify-otp')
      .send({ email, code: notTheCode(code) })
      .expect(400);
    const wrongError = errorBody.parse(wrong.body).error;
    expect(wrongError.code).toBe('OTP_INVALID');
    expect(wrongError.details?.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - 1);

    const verified = await request()
      .post('/api/auth/verify-otp')
      .send({ email, code })
      .expect(200);
    expect(sessionBody.parse(verified.body).user).toMatchObject({
      email,
      profileCompleted: false,
    });

    const reused = await request().post('/api/auth/verify-otp').send({ email, code }).expect(409);
    expect(errorBody.parse(reused.body).error.code).toBe('OTP_ALREADY_USED');

    const loggedIn = await request()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const auth = `Bearer ${sessionBody.parse(loggedIn.body).token}`;

    const before = await request().get('/api/me').set('Authorization', auth).expect(200);
    expect(meBody.parse(before.body).profile).toBeNull();

    const badProfile = await request()
      .put('/api/profile')
      .set('Authorization', auth)
      .send({ fullName: 'A', mobile: '12345', address: 'short' })
      .expect(400);
    expect(errorBody.parse(badProfile.body).error.fields).toMatchObject({
      fullName: expect.any(String),
      mobile: expect.any(String),
      address: expect.any(String),
    });

    const savedProfile = await request()
      .put('/api/profile')
      .set('Authorization', auth)
      .send({
        fullName: 'Harsh Patel',
        mobile: '098765 43210',
        address: '12 Green Street, Pune 411001',
      })
      .expect(200);
    expect(profileBody.parse(savedProfile.body).profile).toMatchObject({
      fullName: 'Harsh Patel',
      mobile: '+919876543210',
      businessName: null,
    });

    const catalogue = await request().get('/api/tasks').set('Authorization', auth).expect(200);
    const { categories } = catalogueBody.parse(catalogue.body);
    expect(categories.length).toBeGreaterThan(0);

    const chosen = categories
      .flatMap((category) => category.tasks)
      .slice(0, 2)
      .map((task) => task.id);

    const saved = await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: chosen })
      .expect(200);
    // Saved tasks come back in catalogue order (category, then name), which is how `chosen` was
    // built — the mobile home screen groups on that order.
    expect(selectedTasksBody.parse(saved.body).tasks.map((task) => task.id)).toEqual(chosen);

    const after = await request().get('/api/me').set('Authorization', auth).expect(200);
    const me = meBody.parse(after.body);
    expect(me.user.profileCompleted).toBe(true);
    expect(me.selectedTaskCount).toBe(chosen.length);
    expect(me.profile?.mobile).toBe('+919876543210');
  });

  it('locks the code after five wrong attempts, even when the next one is correct', async () => {
    const email = 'locked@padosipro.test';
    await register(email);
    const code = lastCode();

    for (let attempt = 1; attempt <= OTP_MAX_ATTEMPTS; attempt += 1) {
      const response = await request()
        .post('/api/auth/verify-otp')
        .send({ email, code: notTheCode(code) })
        .expect(400);
      expect(errorBody.parse(response.body).error.details?.attemptsLeft).toBe(
        OTP_MAX_ATTEMPTS - attempt,
      );
    }

    const locked = await request().post('/api/auth/verify-otp').send({ email, code }).expect(429);
    expect(errorBody.parse(locked.body).error.code).toBe('OTP_LOCKED');
  });

  it('holds the resend cooldown, then issues a code that clears the attempts', async () => {
    const email = 'resend@padosipro.test';
    await register(email);
    const firstCode = lastCode();

    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      await request()
        .post('/api/auth/verify-otp')
        .send({ email, code: notTheCode(firstCode) })
        .expect(400);
    }

    const tooSoon = await request().post('/api/auth/resend-otp').send({ email }).expect(429);
    const cooldown = errorBody.parse(tooSoon.body).error;
    expect(cooldown.code).toBe('OTP_COOLDOWN');
    expect(cooldown.details?.retryAfterSeconds).toBeGreaterThan(0);
    expect(mailbox.sent).toHaveLength(1);

    await expireResendCooldown();

    const resent = await request().post('/api/auth/resend-otp').send({ email }).expect(200);
    expect(resent.body).toMatchObject({ otpSent: true });
    expect(mailbox.sent).toHaveLength(2);

    // The account was one attempt from locked; the fresh code still works, so attempts were reset.
    const verified = await request()
      .post('/api/auth/verify-otp')
      .send({ email, code: lastCode() })
      .expect(200);
    expect(sessionBody.parse(verified.body).user.email).toBe(email);
  });

  it('answers an unknown email and a wrong password identically', async () => {
    const unknown = await request()
      .post('/api/auth/login')
      .send({ email: 'nobody@padosipro.test', password: PASSWORD })
      .expect(401);

    const email = 'known@padosipro.test';
    await registerAndVerify(email);

    const wrongPassword = await request()
      .post('/api/auth/login')
      .send({ email, password: 'Different9' })
      .expect(401);

    expect(errorBody.parse(wrongPassword.body)).toEqual(errorBody.parse(unknown.body));
  });

  it('refuses a second registration once the email is verified', async () => {
    const email = 'taken@padosipro.test';
    await registerAndVerify(email);

    const again = await request()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(409);
    expect(errorBody.parse(again.body).error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a token that logout has revoked', async () => {
    const token = await registerAndVerify('logout@padosipro.test');
    const auth = `Bearer ${token}`;

    await request().get('/api/me').set('Authorization', auth).expect(200);
    await request().post('/api/auth/logout').set('Authorization', auth).expect(200);

    const revoked = await request().get('/api/me').set('Authorization', auth).expect(401);
    expect(errorBody.parse(revoked.body).error.code).toBe('TOKEN_REVOKED');
  });

  it('validates a task selection and then replaces it wholesale', async () => {
    const token = await registerAndVerify('tasks@padosipro.test');
    const auth = `Bearer ${token}`;

    const catalogue = await request().get('/api/tasks').set('Authorization', auth).expect(200);
    const ids = catalogueBody
      .parse(catalogue.body)
      .categories.flatMap((category) => category.tasks)
      .map((task) => task.id);

    const [first, second, third] = ids;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(third).toBeDefined();

    const empty = await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: [] })
      .expect(400);
    expect(errorBody.parse(empty.body).error.fields?.taskIds).toBeDefined();

    const duplicated = await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: [first, first] })
      .expect(400);
    expect(errorBody.parse(duplicated.body).error.code).toBe('DUPLICATE_TASK_IDS');

    const unknown = await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: [first, 999_999] })
      .expect(400);
    expect(errorBody.parse(unknown.body).error.code).toBe('UNKNOWN_TASK_IDS');

    await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: [first, second] })
      .expect(200);

    // A selection replaces the previous one rather than adding to it.
    const replaced = await request()
      .put('/api/me/tasks')
      .set('Authorization', auth)
      .send({ taskIds: [third] })
      .expect(200);
    expect(selectedTasksBody.parse(replaced.body).tasks.map((task) => task.id)).toEqual([third]);

    const listed = await request().get('/api/me/tasks').set('Authorization', auth).expect(200);
    expect(selectedTasksBody.parse(listed.body).tasks.map((task) => task.id)).toEqual([third]);
  });

  it('refuses every authenticated route without a token', async () => {
    for (const path of ['/api/me', '/api/me/tasks', '/api/tasks']) {
      const response = await request().get(path).expect(401);
      expect(errorBody.parse(response.body).error.code).toBe('TOKEN_MISSING');
    }
  });
});
