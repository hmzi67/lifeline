import { checkOtp, clearedOtp, failedAttempt, issueOtp, MAX_OTP_ATTEMPTS, OTP_TTL_MS } from '../src/services/otpService';

const now = new Date('2026-10-20T10:00:00Z');

describe('otpService', () => {
  it('issues a 6-digit code that expires after the TTL', () => {
    const issued = issueOtp('reset_password', now);
    expect(issued.otp).toMatch(/^\d{6}$/);
    expect(issued.otpExpiresAt.getTime() - now.getTime()).toBe(OTP_TTL_MS);
    expect(issued.otpAttempts).toBe(0);
  });

  it('accepts the right code for the right purpose only', () => {
    const user = issueOtp('verify_email', now);
    expect(checkOtp(user, user.otp, 'verify_email', now)).toBe('ok');
    // A verification code must not reset a password.
    expect(checkOtp(user, user.otp, 'reset_password', now)).toBe('invalid');
    expect(checkOtp(user, '000000', 'verify_email', now)).toBe('invalid');
    expect(checkOtp(user, undefined, 'verify_email', now)).toBe('invalid');
  });

  it('rejects expired and legacy codes without an expiry', () => {
    const user = issueOtp('reset_password', now);
    const later = new Date(now.getTime() + OTP_TTL_MS + 1);
    expect(checkOtp(user, user.otp, 'reset_password', later)).toBe('expired');
    expect(checkOtp({ ...user, otpExpiresAt: null }, user.otp, 'reset_password', now)).toBe('expired');
  });

  it('locks after too many wrong guesses and burns the code on the last one', () => {
    const user = issueOtp('reset_password', now);
    expect(checkOtp({ ...user, otpAttempts: MAX_OTP_ATTEMPTS }, user.otp, 'reset_password', now)).toBe('locked');
    expect(failedAttempt({ ...user, otpAttempts: 0 })).toEqual({ otpAttempts: 1 });
    expect(failedAttempt({ ...user, otpAttempts: MAX_OTP_ATTEMPTS - 1 })).toEqual(clearedOtp);
  });
});
