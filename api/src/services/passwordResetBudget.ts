/**
 * Per-account limits on password reset, on top of the per-IP otpLimiter (an attacker
 * rotating IPs still hits these). Within a rolling 24h window an account gets at most
 * RESET_DAILY_SENDS codes, RESET_COOLDOWN_MS apart, and RESET_DAILY_FAILURES wrong
 * guesses in total: reissuing a code does not refill the guesses, a successful reset
 * does. The window expiring also refills them, so an attacker cannot lock a user out
 * of resetting for good.
 */
export const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RESET_COOLDOWN_MS = 60 * 1000;
export const RESET_DAILY_SENDS = 5;
export const RESET_DAILY_FAILURES = 10;

export type ResetBudget = {
  passwordResetWindowStart: Date | null;
  passwordResetSentCount: number;
  passwordResetLastSentAt: Date | null;
  passwordResetFailedCount: number;
};

/** Whether the account's current 24h window is still running. */
export const resetWindowOpen = (budget: Pick<ResetBudget, 'passwordResetWindowStart'>, now = new Date()) =>
  !!budget.passwordResetWindowStart &&
  now.getTime() - budget.passwordResetWindowStart.getTime() < RESET_WINDOW_MS;

/** A fresh window: what the budget looks like after it expires. */
const freshWindow = (now: Date) => ({
  passwordResetWindowStart: now,
  passwordResetSentCount: 0,
  passwordResetFailedCount: 0,
});

/** The budget as it applies right now (an expired window counts as empty). */
export const currentBudget = (budget: ResetBudget, now = new Date()): ResetBudget =>
  resetWindowOpen(budget, now) ? budget : { ...budget, ...freshWindow(now) };

/**
 * Columns to write when sending a reset code now, or null when the account must wait
 * (too soon after the last code, out of codes for the window, or out of guesses).
 */
export const claimResetSend = (budget: ResetBudget, now = new Date()) => {
  const current = currentBudget(budget, now);
  if (budget.passwordResetLastSentAt && now.getTime() - budget.passwordResetLastSentAt.getTime() < RESET_COOLDOWN_MS) {
    return null;
  }
  if (current.passwordResetSentCount >= RESET_DAILY_SENDS) return null;
  if (current.passwordResetFailedCount >= RESET_DAILY_FAILURES) return null;
  return {
    passwordResetWindowStart: current.passwordResetWindowStart,
    passwordResetSentCount: current.passwordResetSentCount + 1,
    passwordResetLastSentAt: now,
    passwordResetFailedCount: current.passwordResetFailedCount,
  };
};

/** Columns that refill the budget after a successful reset. */
export const resetBudgetCleared = {
  passwordResetWindowStart: null,
  passwordResetSentCount: 0,
  passwordResetLastSentAt: null,
  passwordResetFailedCount: 0,
};
