import { z } from 'zod';

const emailjsVars = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
] as const;

// z.coerce.boolean() treats the string "false" as true, so match the two literals instead.
const boolFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1),
    DB_SSL: boolFromString,

    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().min(1).default('7d'),
    OTP_PEPPER: z.string().min(16),

    MAIL_DRIVER: z.enum(['emailjs', 'console']).default('console'),
    EMAILJS_SERVICE_ID: z.string().min(1).optional(),
    EMAILJS_TEMPLATE_ID: z.string().min(1).optional(),
    EMAILJS_PUBLIC_KEY: z.string().min(1).optional(),
    EMAILJS_PRIVATE_KEY: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MAIL_DRIVER !== 'emailjs') return;
    for (const key of emailjsVars) {
      if (value[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required when MAIL_DRIVER=emailjs' });
      }
    }
  });

export type Config = z.infer<typeof configSchema>;

// An unset variable arrives as "": a blank line in .env, or a `${VAR:-}` default in compose.
function dropEmptyValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const entries = Object.entries(source).filter(
    ([, value]) => value !== undefined && value.trim() !== '',
  );
  return Object.fromEntries(entries);
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(dropEmptyValues(source));

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '_root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}\nSee backend/.env.example.`);
  }

  return parsed.data;
}

let cached: Config | undefined;

// Memoised rather than loaded at import so a test can import this file without a full environment.
export function config(): Config {
  cached ??= loadConfig();
  return cached;
}
