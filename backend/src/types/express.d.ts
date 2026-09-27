import type { UserRecord } from '../repositories/users.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}
