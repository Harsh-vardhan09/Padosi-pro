import { z } from 'zod';
import { request } from './client';

const sessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.string(),
    email: z.string(),
    profileCompleted: z.boolean(),
  }),
});

const otpIssuedSchema = z.object({
  otpSent: z.boolean(),
  otpExpiresAt: z.string(),
  resendAvailableAt: z.string(),
});

const registeredSchema = otpIssuedSchema.extend({ email: z.string() });

export type Session = z.infer<typeof sessionSchema>;
export type OtpIssued = z.infer<typeof otpIssuedSchema>;
export type Registered = z.infer<typeof registeredSchema>;

export function register(body: { email: string; password: string }): Promise<Registered> {
  return request('/api/auth/register', registeredSchema, { method: 'POST', body });
}

export function verifyOtp(body: { email: string; code: string }): Promise<Session> {
  return request('/api/auth/verify-otp', sessionSchema, { method: 'POST', body });
}

export function resendOtp(body: { email: string }): Promise<OtpIssued> {
  return request('/api/auth/resend-otp', otpIssuedSchema, { method: 'POST', body });
}

export function login(body: { email: string; password: string }): Promise<Session> {
  return request('/api/auth/login', sessionSchema, { method: 'POST', body });
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST', token });
}
