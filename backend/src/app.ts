import cors from 'cors';
import express, { type Express } from 'express';
import { requireAuth } from './middleware/auth.js';
import { authRateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { profileRouter } from './routes/profile.js';
import { tasksRouter } from './routes/tasks.js';

// No side effects here (no listen, no env read) so tests can build an app without a port.
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use('/api/auth', authRateLimit, authRouter);

  app.use('/api/me', requireAuth, meRouter);
  app.use('/api/profile', requireAuth, profileRouter);
  app.use('/api/tasks', requireAuth, tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
