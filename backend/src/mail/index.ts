import type { Config } from '../config.js';
import { consoleMailer } from './console.js';
import { createEmailjsMailer } from './emailjs.js';
import type { Mailer } from './types.js';

export type { Mailer, OtpEmail } from './types.js';

export function createMailer(config: Config): Mailer {
  if (config.MAIL_DRIVER === 'console') return consoleMailer;

  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } =
    config;

  // config.ts already rejects MAIL_DRIVER=emailjs without these, so this only narrows the types.
  if (
    EMAILJS_SERVICE_ID === undefined ||
    EMAILJS_TEMPLATE_ID === undefined ||
    EMAILJS_PUBLIC_KEY === undefined ||
    EMAILJS_PRIVATE_KEY === undefined
  ) {
    throw new Error('MAIL_DRIVER=emailjs requires all four EMAILJS_* variables');
  }

  return createEmailjsMailer({
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY,
    privateKey: EMAILJS_PRIVATE_KEY,
  });
}
