import jwt from 'jsonwebtoken';
import { unauthorized } from './errors.js';

export type AccessTokenPayload = {
  sub: string;
  tv: number;
};

export function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  expiresIn: string,
): string {
  // config.ts already checks the shape (e.g. 15m, 7d); jsonwebtoken types it as a narrow literal.
  const ttl = expiresIn as NonNullable<jwt.SignOptions['expiresIn']>;
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw unauthorized('TOKEN_INVALID', 'Your session has expired. Please log in again.');
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('sub' in decoded) ||
    typeof decoded.sub !== 'string' ||
    !('tv' in decoded) ||
    typeof decoded.tv !== 'number'
  ) {
    throw unauthorized('TOKEN_INVALID', 'Your session has expired. Please log in again.');
  }

  return { sub: decoded.sub, tv: decoded.tv };
}
