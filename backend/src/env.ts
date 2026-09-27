import { z } from 'zod';

// Everything a feature will need later is optional, so the scaffold boots with no .env at all.
// Each becomes required when its feature lands.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url().optional(),
  EMAILJS_SERVICE_ID: z.string().min(1).optional(),
  EMAILJS_TEMPLATE_ID: z.string().min(1).optional(),
  EMAILJS_PUBLIC_KEY: z.string().min(1).optional(),
  EMAILJS_PRIVATE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

// An unset variable arrives as "": a blank line in .env, or a `${VAR:-}` default in compose.
function dropEmptyValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const entries = Object.entries(source).filter(
    ([, value]) => value !== undefined && value.trim() !== '',
  );
  return Object.fromEntries(entries);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(dropEmptyValues(source));

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}
