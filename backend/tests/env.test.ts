import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

describe('loadEnv', () => {
  it('applies defaults when nothing is set', () => {
    const env = loadEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
  });

  it('treats an empty value as unset', () => {
    const env = loadEnv({ PORT: '', EMAILJS_SERVICE_ID: '  ' });

    expect(env.PORT).toBe(4000);
    expect(env.EMAILJS_SERVICE_ID).toBeUndefined();
  });

  it('rejects an invalid value', () => {
    expect(() => loadEnv({ PORT: 'nope' })).toThrow(/Invalid environment variables/);
  });
});
