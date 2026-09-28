import { AppError } from '../lib/errors.js';
import type { Mailer, OtpEmail } from './types.js';

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export type EmailjsCredentials = {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
};

export function createEmailjsMailer(credentials: EmailjsCredentials): Mailer {
  return {
    async sendOtp({ to, code, expiryMinutes }: OtpEmail): Promise<void> {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: credentials.serviceId,
          template_id: credentials.templateId,
          user_id: credentials.publicKey,
          accessToken: credentials.privateKey,
          template_params: {
            email: to,
            otp: code,
            expiry_minutes: expiryMinutes,
          },
        }),
      });

      if (!response.ok) {
        // EmailJS returns the reason as plain text; log it, but never show a provider payload.
        console.error(`[mail:emailjs] ${response.status} ${await response.text()}`);
        throw new AppError({
          status: 502,
          code: 'MAIL_FAILED',
          message: 'We could not send the verification email. Please try again shortly.',
        });
      }
    },
  };
}
