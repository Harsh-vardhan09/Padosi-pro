import rateLimit from 'express-rate-limit';
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
  handler: (_req, res) => {
    res.status(tooManyRequests.status).json(tooManyRequests.toBody());
  },
});
