export const SUSPENDED_STATUSES = new Set(['blocked', 'suspended']);

export interface AccountAccessDenial {
  message: string;
  code: 'ACCOUNT_SUSPENDED' | 'EMAIL_NOT_VERIFIED';
}

export const isSuspended = (status?: string | null): boolean => !!status && SUSPENDED_STATUSES.has(status);

/**
 * Why an account with a valid token may still not use the API: it is
 * suspended, or its email was never verified (signup issues tokens before the
 * code is entered; verification itself uses unauthenticated routes).
 */
export const accountAccessDenial = (user: {
  status?: string | null;
  isEmailVerified: boolean;
}): AccountAccessDenial | null => {
  if (isSuspended(user.status)) {
    return { message: 'Your account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' };
  }
  if (!user.isEmailVerified) {
    return { message: 'Please verify your email before continuing', code: 'EMAIL_NOT_VERIFIED' };
  }
  return null;
};
