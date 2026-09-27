import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const valid = {
  DATABASE_URL: 'postgres://padosi:padosi@localhost:5432/padosipro',
  JWT_SECRET: 'a-development-only-secret',
  OTP_PEPPER: 'a-development-only-pepper',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(valid);

    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.JWT_EXPIRES_IN).toBe('7d');
    expect(config.MAIL_DRIVER).toBe('console');
    expect(config.DB_SSL).toBe(false);
  });

  it('treats an empty value as unset', () => {
    expect(loadConfig({ ...valid, PORT: '', DB_SSL: '  ' }).PORT).toBe(4000);
  });

  it('reads DB_SSL as a boolean without treating "false" as true', () => {
    expect(loadConfig({ ...valid, DB_SSL: 'true' }).DB_SSL).toBe(true);
    expect(loadConfig({ ...valid, DB_SSL: 'false' }).DB_SSL).toBe(false);
  });

  it('names every missing variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*OTP_PEPPER/);
  });

  it('rejects a short secret', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('requires the EmailJS credentials only when MAIL_DRIVER is emailjs', () => {
    expect(() => loadConfig({ ...valid, MAIL_DRIVER: 'emailjs' })).toThrow(
      /EMAILJS_SERVICE_ID: Required when MAIL_DRIVER=emailjs/,
    );
    expect(loadConfig({ ...valid, MAIL_DRIVER: 'console' }).EMAILJS_SERVICE_ID).toBeUndefined();
  });
});
