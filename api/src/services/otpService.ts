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

/** Columns to write once a code is used, or burned after too many wrong guesses. */
export const clearedOtp = {
  otp: null,
  otpPurpose: null,
  otpExpiresAt: null,
  otpAttempts: 0,
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
  if (!user.otp || user.otpPurpose !== purpose) return 'invalid';
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) return 'locked';
  // Codes issued before expiry tracking existed have no expiry; treat them as expired.
  if (!user.otpExpiresAt || user.otpExpiresAt.getTime() <= now.getTime()) return 'expired';
  return typeof submitted === 'string' && sameCode(submitted.trim(), user.otp) ? 'ok' : 'invalid';
};

/** Columns to write after a wrong guess: count it, and burn the code on the last allowed attempt. */
export const failedAttempt = (user: OtpState) =>
  user.otpAttempts + 1 >= MAX_OTP_ATTEMPTS ? { ...clearedOtp } : { otpAttempts: user.otpAttempts + 1 };

export const otpErrorMessage = (result: Exclude<OtpCheck, 'ok'>) =>
  result === 'expired' || result === 'locked'
    ? 'This code has expired. Please request a new one.'
    : 'Invalid OTP or email';
