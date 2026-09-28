import { z } from 'zod';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
});

export class ApiError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly details: Record<string, string | number>;

  constructor(args: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    details?: Record<string, string | number>;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.fields = args.fields ?? {};
    this.details = args.details ?? {};
  }
}

// A stored token that the server no longer accepts: the session layer registers a handler here so
// one rejected request signs the user out instead of stranding a screen on a retry that cannot work.
const TOKEN_ERROR_CODES = ['TOKEN_MISSING', 'TOKEN_INVALID', 'TOKEN_REVOKED'];

let onTokenRejected: (() => void) | null = null;

export function setTokenRejectedHandler(handler: () => void): void {
  onTokenRejected = handler;
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({ code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' });
}

export function detailNumber(error: ApiError, key: string): number | null {
  const value = error.details[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function detailString(error: ApiError, key: string): string | null {
  const value = error.details[key];
  return typeof value === 'string' ? value : null;
}

function errorFromResponse(payload: unknown, status: number): ApiError {
  const parsed = errorBodySchema.safeParse(payload);
  if (!parsed.success) {
    return new ApiError({
      code: 'UNEXPECTED_STATUS',
      message: `The server returned an error (${status}). Please try again.`,
    });
  }
  const { code, message, fields, details } = parsed.data.error;
  return new ApiError({ code, message, fields, details });
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method: 'GET' | 'POST' | 'PUT'; body?: unknown; token?: string },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: `Cannot reach PadosiPro at ${BASE_URL}. Check your connection and try again.`,
    });
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = errorFromResponse(payload, response.status);
    if (TOKEN_ERROR_CODES.includes(error.code)) onTokenRejected?.();
    throw error;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      code: 'UNEXPECTED_RESPONSE',
      message: 'The server sent a response we did not understand.',
    });
  }

  return parsed.data;
}
