import { burnedOtp, checkOtp, failedAttempt, issueOtp, MAX_OTP_ATTEMPTS, OTP_TTL_MS, otpErrorMessage } from '../src/services/otpService';

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

  it('burns the code on the last wrong guess and then says to request a new one', () => {
    const issued = issueOtp('verify_email', now);
    let user: any = { ...issued };
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
      expect(checkOtp(user, '000000', 'verify_email', now)).toBe('invalid');
      user = { ...user, ...failedAttempt(user) };
    }
    expect(user).toMatchObject(burnedOtp);
    // Even the right code no longer works, and the reply says why.
    expect(checkOtp(user, issued.otp, 'verify_email', now)).toBe('locked');
    expect(otpErrorMessage('locked')).toBe('Too many incorrect attempts. Please request a new code.');
    // A fresh code starts over.
    const fresh = { ...user, ...issueOtp('verify_email', now) };
    expect(checkOtp(fresh, fresh.otp, 'verify_email', now)).toBe('ok');
  });

  it('keeps a burned code for one purpose from locking the other', () => {
    const burned = { ...issueOtp('verify_email', now), ...burnedOtp };
    expect(checkOtp(burned, '123456', 'reset_password', now)).toBe('invalid');
  });
});
