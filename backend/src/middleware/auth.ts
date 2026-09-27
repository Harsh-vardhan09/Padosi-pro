import type { Request, RequestHandler } from 'express';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import * as users from '../repositories/users.js';
import type { UserRecord } from '../repositories/users.js';

function bearerToken(header: string | undefined): string {
  if (header === undefined || !header.startsWith('Bearer ')) {
    throw unauthorized('TOKEN_MISSING', 'Please log in to continue.');
  }
  return header.slice('Bearer '.length).trim();
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const payload = verifyAccessToken(bearerToken(req.headers.authorization), config().JWT_SECRET);
    const user = await users.findById(payload.sub);

    if (user === null) {
      throw unauthorized('TOKEN_INVALID', 'Your session has expired. Please log in again.');
    }

    // A logout (or any token_version bump) leaves older tokens valid-but-stale; reject them.
    if (user.tokenVersion !== payload.tv) {
      throw unauthorized('TOKEN_REVOKED', 'You have been logged out. Please log in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** Keeps handlers free of non-null assertions on the optional `req.user`. */
export function authenticatedUser(req: Request): UserRecord {
  if (req.user === undefined) {
    throw unauthorized('TOKEN_MISSING', 'Please log in to continue.');
  }
  return req.user;
}
