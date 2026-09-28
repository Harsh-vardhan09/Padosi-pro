import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

const tooManyRequests = new AppError({
  status: 429,
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many requests from this device. Please try again in a few minutes.',
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Integration tests drive far more than `limit` auth calls from one address in a single run.
  skip: () => config().NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(tooManyRequests.status).json(tooManyRequests.toBody());
  },
});
