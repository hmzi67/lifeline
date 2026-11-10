import { randomInt, timingSafeEqual } from 'node:crypto';

export type OtpPurpose = 'verify_email' | 'reset_password';

export const OTP_TTL_MS = 15 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

type OtpState = {
  otp: string | null;
  otpPurpose: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
};

/** Columns to write when issuing a fresh 6-digit code. */
export const issueOtp = (purpose: OtpPurpose, now = new Date()) => ({
  otp: randomInt(100000, 1000000).toString(),
  otpPurpose: purpose,
  otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
  otpAttempts: 0,
});

/** Columns to write once a code is used. */
export const clearedOtp = {
  otp: null,
  otpPurpose: null,
  otpExpiresAt: null,
  otpAttempts: 0,
};

/**
 * Columns for a code burned after too many wrong guesses: it can no longer be used, and
 * checkOtp reports 'locked' (not 'invalid') until a new code is issued.
 */
export const burnedOtp = {
  otp: null,
  otpExpiresAt: null,
  otpAttempts: MAX_OTP_ATTEMPTS,
};

export type OtpCheck = 'ok' | 'invalid' | 'expired' | 'locked';

const sameCode = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const checkOtp = (
  user: OtpState,
  submitted: unknown,
  purpose: OtpPurpose,
  now = new Date(),
): OtpCheck => {
  if (user.otpPurpose !== purpose) return 'invalid';
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) return 'locked';
  if (!user.otp) return 'invalid';
  // Codes issued before expiry tracking existed have no expiry; treat them as expired.
  if (!user.otpExpiresAt || user.otpExpiresAt.getTime() <= now.getTime()) return 'expired';
  return typeof submitted === 'string' && sameCode(submitted.trim(), user.otp) ? 'ok' : 'invalid';
};

/** Whether a wrong guess now is the last one this code allows. */
export const isLastAttempt = (user: OtpState) => user.otpAttempts + 1 >= MAX_OTP_ATTEMPTS;

/** Columns to write after a wrong guess: count it, and burn the code on the last allowed attempt. */
export const failedAttempt = (user: OtpState) =>
  isLastAttempt(user) ? { ...burnedOtp } : { otpAttempts: user.otpAttempts + 1 };

const OTP_ERROR_MESSAGES: Record<Exclude<OtpCheck, 'ok'>, string> = {
  invalid: 'Invalid OTP or email',
  expired: 'This code has expired. Please request a new one.',
  locked: 'Too many incorrect attempts. Please request a new code.',
};
export const otpErrorMessage = (result: Exclude<OtpCheck, 'ok'>) => OTP_ERROR_MESSAGES[result];
