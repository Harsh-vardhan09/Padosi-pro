import type { Mailer } from './types.js';

/** Default driver: no account needed, the reviewer reads the code from the server log. */
export const consoleMailer: Mailer = {
  sendOtp({ to, code, expiryMinutes }) {
    console.log(`[mail:console] OTP for ${to}: ${code} (valid ${expiryMinutes} minutes)`);
    return Promise.resolve();
  },
};
