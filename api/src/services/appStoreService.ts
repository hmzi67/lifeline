import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  AppStoreServerAPIClient,
  AutoRenewStatus,
  Environment,
  JWSRenewalInfoDecodedPayload,
  JWSTransactionDecodedPayload,
  NotificationTypeV2,
  OfferDiscountType,
  SignedDataVerifier,
  Status,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';

const prisma = new PrismaClient();

const ENTITLEMENT_ID = 'lifeline_vip';
const DEFAULT_BUNDLE_ID = 'com.irtaza.lifeline';
const MAX_SIGNED_TRANSACTIONS = 25;

export interface AppStoreEntitlementSyncResult {
  active: boolean;
  cancelAtPeriodEnd: boolean;
  entitlementId: string;
  expiresAt: string | null;
  originalTransactionId: string | null;
  paymentId: string | null;
  pricingPlanId: string | null;
  productId: string | null;
  status: string;
}

export interface AppStoreNotificationResult {
  handled: boolean;
  notificationType: string | null;
  reason?: string;
  result?: AppStoreEntitlementSyncResult;
}

interface SubscriptionSnapshot {
  environment: Environment;
  renewalInfo?: JWSRenewalInfoDecodedPayload;
  status?: number;
  transaction: JWSTransactionDecodedPayload;
}

export class AppStoreServiceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'AppStoreServiceError';
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const getBundleId = (): string => process.env.APPLE_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID;

const getAppAppleId = (): number | undefined => {
  const raw = process.env.APPLE_APP_APPLE_ID?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AppStoreServiceError('APPLE_APP_APPLE_ID must be the numeric App Store app ID', 503);
  }
  return value;
};

const isSandboxAllowed = (): boolean => (
  process.env.APPLE_IAP_ALLOW_SANDBOX?.trim().toLowerCase() !== 'false'
);

const areOnlineChecksEnabled = (): boolean => (
  process.env.APPLE_IAP_ONLINE_CHECKS?.trim().toLowerCase() !== 'false'
);

let rootCertificates: Buffer[] | null = null;

const loadRootCertificates = (): Buffer[] => {
  if (rootCertificates) return rootCertificates;

  const directory = process.env.APPLE_ROOT_CERTIFICATES_DIR?.trim()
    || path.resolve(process.cwd(), 'certs', 'apple');
  let files: string[] = [];
  try {
    files = readdirSync(directory).filter(file => /\.(cer|der)$/i.test(file));
  } catch {
    files = [];
  }

  if (files.length === 0) {
    throw new AppStoreServiceError('App Store verification certificates are not installed', 503);
  }

  rootCertificates = files.map(file => readFileSync(path.join(directory, file)));
  return rootCertificates;
};

const verifierCache = new Map<Environment, SignedDataVerifier>();

/**
 * Production is tried first, then Sandbox. Apple reviews production builds with
 * sandbox purchases, so Sandbox must stay enabled unless explicitly disabled.
 */
const getVerifiers = (): Array<{ environment: Environment; verifier: SignedDataVerifier }> => {
  const appAppleId = getAppAppleId();
  const environments: Environment[] = [];
  if (appAppleId) environments.push(Environment.PRODUCTION);
  if (isSandboxAllowed()) environments.push(Environment.SANDBOX);

  if (environments.length === 0) {
    throw new AppStoreServiceError('App Store subscription verification is not configured', 503);
  }

  return environments.map(environment => {
    let verifier = verifierCache.get(environment);
    if (!verifier) {
      verifier = new SignedDataVerifier(
        loadRootCertificates(),
        areOnlineChecksEnabled(),
        environment,
        getBundleId(),
        environment === Environment.PRODUCTION ? appAppleId : undefined,
      );
      verifierCache.set(environment, verifier);
    }
    return { environment, verifier };
  });
};

const getSigningKey = (): string | null => {
  const inlineKey = process.env.APPLE_IAP_PRIVATE_KEY?.trim();
  if (inlineKey) return inlineKey.replace(/\\n/g, '\n');

  const keyPath = process.env.APPLE_IAP_PRIVATE_KEY_PATH?.trim();
  if (!keyPath) return null;
  try {
    return readFileSync(keyPath, 'utf8');
  } catch {
    console.error(`App Store Server API key could not be read from ${keyPath}`);
    return null;
  }
};

const apiClientCache = new Map<Environment, AppStoreServerAPIClient>();

/** The App Store Server API is optional but recommended for authoritative status. */
const getApiClient = (environment: Environment): AppStoreServerAPIClient | null => {
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim();
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim();
  if (!keyId || !issuerId) return null;

  const cached = apiClientCache.get(environment);
  if (cached) return cached;

  const signingKey = getSigningKey();
  if (!signingKey) return null;

  const client = new AppStoreServerAPIClient(signingKey, keyId, issuerId, getBundleId(), environment);
  apiClientCache.set(environment, client);
  return client;
};

// ---------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------

const verifyWithFallback = async <T>(
  decode: (verifier: SignedDataVerifier) => Promise<T>,
): Promise<{ environment: Environment; value: T }> => {
  let lastError: unknown;

  for (const { environment, verifier } of getVerifiers()) {
    try {
      return { environment, value: await decode(verifier) };
    } catch (error) {
      lastError = error;
      if (
        error instanceof VerificationException
        && error.status === VerificationStatus.INVALID_ENVIRONMENT
      ) {
        continue;
      }
      break;
    }
  }

  if (
    lastError instanceof VerificationException
    && lastError.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
  ) {
    throw new AppStoreServiceError('Apple could not be reached to verify the purchase', 503);
  }

  throw new AppStoreServiceError('The App Store transaction could not be verified', 400);
};

const toEnvironment = (value?: string | null): Environment => (
  value?.toUpperCase() === 'SANDBOX' ? Environment.SANDBOX : Environment.PRODUCTION
);

const fromEnvironment = (environment: Environment): string => (
  environment === Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'
);

const tokensMatch = (left?: string | null, right?: string | null): boolean => (
  !!left && !!right && left.toLowerCase() === right.toLowerCase()
);

/**
 * Reads the authoritative subscription state from the App Store Server API.
 * Returns null when the API is not configured or unavailable so callers can
 * fall back to the Apple-signed data they already verified.
 */
const fetchLatestSnapshot = async (
  originalTransactionId: string,
  environment: Environment,
): Promise<SubscriptionSnapshot | null> => {
  const client = getApiClient(environment);
  if (!client) return null;

  try {
    const response = await client.getAllSubscriptionStatuses(originalTransactionId);
    const items = (response.data ?? []).flatMap(group => group.lastTransactions ?? []);
    const item = items.find(entry => entry.originalTransactionId === originalTransactionId)
      ?? items[0];
    if (!item?.signedTransactionInfo) return null;

    const { value: transaction } = await verifyWithFallback(
      verifier => verifier.verifyAndDecodeTransaction(item.signedTransactionInfo!),
    );
    const renewalInfo = item.signedRenewalInfo
      ? (await verifyWithFallback(
          verifier => verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo!),
        )).value
      : undefined;

    return {
      environment,
      renewalInfo,
      status: typeof item.status === 'number' ? item.status : undefined,
      transaction,
    };
  } catch (error) {
    console.error('App Store Server API status lookup failed:', error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Entitlement evaluation and persistence
// ---------------------------------------------------------------------------

const toDate = (milliseconds?: number | null): Date | null => (
  typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? new Date(milliseconds) : null
);

const evaluateSnapshot = (snapshot: SubscriptionSnapshot, now: Date) => {
  const { renewalInfo, status, transaction } = snapshot;
  const includeGrace = status === Status.BILLING_GRACE_PERIOD || status === undefined;
  const candidates = [
    toDate(transaction.expiresDate),
    includeGrace ? toDate(renewalInfo?.gracePeriodExpiresDate) : null,
  ].filter((value): value is Date => !!value);
  const expiresAt = candidates.length > 0
    ? new Date(Math.max(...candidates.map(date => date.getTime())))
    : null;

  const revoked = !!transaction.revocationDate || status === Status.REVOKED;
  let active: boolean;
  if (revoked) active = false;
  else if (status === Status.ACTIVE || status === Status.BILLING_GRACE_PERIOD) active = true;
  else if (status === Status.EXPIRED || status === Status.BILLING_RETRY) active = false;
  else active = !!expiresAt && expiresAt > now;

  const autoRenewOff = renewalInfo?.autoRenewStatus === AutoRenewStatus.OFF;
  const billingIssue = status === Status.BILLING_RETRY
    || status === Status.BILLING_GRACE_PERIOD
    || !!renewalInfo?.isInBillingRetryPeriod;

  let inactiveStatus = 'INACTIVE';
  if (revoked) inactiveStatus = 'REFUNDED';
  else if (billingIssue) inactiveStatus = 'BILLING_ISSUE';
  else if (expiresAt && expiresAt <= now) inactiveStatus = 'EXPIRED';
  else if (autoRenewOff) inactiveStatus = 'CANCELLED';

  const isTrial = transaction.offerDiscountType === OfferDiscountType.FREE_TRIAL;

  return {
    active,
    cancelAtPeriodEnd: active && autoRenewOff,
    expiresAt,
    inactiveStatus,
    isTrial,
  };
};

const entitlementKeyFor = (userId: string): string => {
  const key = `${userId}:${ENTITLEMENT_ID}`;
  if (key.length > 255) {
    throw new AppStoreServiceError('App Store entitlement identifier is too long', 500);
  }
  return key;
};

const inactiveResult = (
  status: string,
  overrides: Partial<AppStoreEntitlementSyncResult> = {},
): AppStoreEntitlementSyncResult => ({
  active: false,
  cancelAtPeriodEnd: false,
  entitlementId: ENTITLEMENT_ID,
  expiresAt: null,
  originalTransactionId: null,
  paymentId: null,
  pricingPlanId: null,
  productId: null,
  status,
  ...overrides,
});

interface ApplyOptions {
  /** Skip snapshots older than what is already stored (out-of-order notifications). */
  ignoreStale?: boolean;
}

/**
 * Mirrors an Apple-verified subscription snapshot into the existing
 * SubscriptionPayment/UserLicense access model. Nothing here is trusted from
 * the client: every snapshot was decoded from Apple-signed JWS data.
 */
const applySnapshot = async (
  userId: string,
  snapshot: SubscriptionSnapshot,
  options: ApplyOptions = {},
): Promise<AppStoreEntitlementSyncResult> => {
  const { transaction } = snapshot;
  const originalTransactionId = transaction.originalTransactionId?.trim();
  const productId = transaction.productId?.trim() || null;
  if (!originalTransactionId) {
    throw new AppStoreServiceError('The App Store transaction is missing its original transaction ID', 400);
  }

  const claimedPayment = await prisma.subscriptionPayment.findUnique({
    where: { appStoreOriginalTransactionId: originalTransactionId },
    select: { userId: true },
  });
  if (claimedPayment?.userId && claimedPayment.userId !== userId) {
    throw new AppStoreServiceError(
      'This App Store subscription is already linked to a different Lifeline account',
      409,
    );
  }

  const now = new Date();
  const evaluation = evaluateSnapshot(snapshot, now);
  // Archived plans still count: archiving only hides a plan from new buyers, and
  // Apple keeps renewing existing subscribers, who must keep their access.
  const plan = productId
    ? await prisma.pricingPlan.findFirst({ where: { appleProductId: productId } })
    : null;

  if (evaluation.active && !plan) {
    throw new AppStoreServiceError(
      `The App Store product ${productId} is not mapped to an active pricing plan`,
      409,
    );
  }

  const entitlementKey = entitlementKeyFor(userId);
  const storeEnvironment = fromEnvironment(snapshot.environment);

  return prisma.$transaction(async tx => {
    const existingPayment = await tx.subscriptionPayment.findUnique({
      where: { appStoreEntitlementKey: entitlementKey },
    });
    const tracksOtherSubscription = !!existingPayment?.appStoreOriginalTransactionId
      && existingPayment.appStoreOriginalTransactionId !== originalTransactionId;

    const isStale = options.ignoreStale
      && existingPayment
      && !tracksOtherSubscription
      && !transaction.revocationDate
      && existingPayment.currentPeriodEnd
      && evaluation.expiresAt
      && evaluation.expiresAt < existingPayment.currentPeriodEnd;

    if (isStale) {
      return {
        active: !!existingPayment.currentPeriodEnd && existingPayment.currentPeriodEnd > now
          && ['COMPLETED', 'TRIALING'].includes(existingPayment.status ?? ''),
        cancelAtPeriodEnd: existingPayment.cancelAtPeriodEnd,
        entitlementId: ENTITLEMENT_ID,
        expiresAt: existingPayment.currentPeriodEnd?.toISOString() ?? null,
        originalTransactionId,
        paymentId: existingPayment.id,
        pricingPlanId: existingPayment.pricingPlanId,
        productId: existingPayment.storeProductId,
        status: existingPayment.status ?? 'INACTIVE',
      };
    }

    if (!evaluation.active || !plan || !productId) {
      // Never let an old, inactive Apple subscription overwrite the one the
      // account currently tracks (e.g. restoring from a second Apple ID).
      if (!existingPayment || tracksOtherSubscription) {
        return inactiveResult(evaluation.inactiveStatus, {
          expiresAt: evaluation.expiresAt?.toISOString() ?? null,
          originalTransactionId,
          productId,
        });
      }

      const effectiveExpiresAt = evaluation.expiresAt || existingPayment.currentPeriodEnd;
      const revokedAt = effectiveExpiresAt && effectiveExpiresAt <= now ? effectiveExpiresAt : now;
      await tx.subscriptionPayment.update({
        where: { id: existingPayment.id },
        data: {
          status: evaluation.inactiveStatus,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: effectiveExpiresAt || revokedAt,
          appStoreOriginalTransactionId: originalTransactionId,
          storeProductId: productId || existingPayment.storeProductId,
          storeEnvironment,
        },
      });
      await tx.userLicense.updateMany({
        where: { userId, paymentId: existingPayment.id },
        data: { expiresAt: revokedAt },
      });

      return inactiveResult(evaluation.inactiveStatus, {
        expiresAt: revokedAt.toISOString(),
        originalTransactionId,
        paymentId: existingPayment.id,
        pricingPlanId: existingPayment.pricingPlanId,
        productId: productId || existingPayment.storeProductId,
      });
    }

    const status = evaluation.isTrial ? 'TRIALING' : 'COMPLETED';
    const paymentData = {
      userId,
      pricingPlanId: plan.id,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      originalAmount: plan.originalPrice,
      amount: plan.price,
      method: 'app_store',
      status,
      appStoreEntitlementKey: entitlementKey,
      appStoreOriginalTransactionId: originalTransactionId,
      storeProductId: productId,
      storeEnvironment,
      currentPeriodEnd: evaluation.expiresAt,
      cancelAtPeriodEnd: evaluation.cancelAtPeriodEnd,
    };

    const payment = await tx.subscriptionPayment.upsert({
      where: { appStoreEntitlementKey: entitlementKey },
      create: {
        ...paymentData,
        createdAt: toDate(transaction.originalPurchaseDate ?? transaction.purchaseDate) || now,
      },
      update: paymentData,
    });

    await tx.userLicense.upsert({
      where: { appStoreEntitlementKey: entitlementKey },
      create: {
        userId,
        paymentId: payment.id,
        appStoreEntitlementKey: entitlementKey,
        createdAt: now,
        expiresAt: evaluation.expiresAt,
      },
      update: {
        userId,
        paymentId: payment.id,
        expiresAt: evaluation.expiresAt,
      },
    });

    if (evaluation.isTrial) {
      await tx.user.updateMany({
        where: { id: userId, trialUsedAt: null },
        data: { trialUsedAt: now },
      });
    }

    return {
      active: true,
      cancelAtPeriodEnd: evaluation.cancelAtPeriodEnd,
      entitlementId: ENTITLEMENT_ID,
      expiresAt: evaluation.expiresAt?.toISOString() ?? null,
      originalTransactionId,
      paymentId: payment.id,
      pricingPlanId: plan.id,
      productId,
      status,
    };
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the UUID the iOS app must pass to StoreKit as `appAccountToken`.
 * Lifeline user IDs are CUIDs, which StoreKit does not accept.
 */
export const getOrCreateAppAccountToken = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appStoreAccountToken: true },
  });
  if (!user) throw new AppStoreServiceError('User not found', 404);
  if (user.appStoreAccountToken) return user.appStoreAccountToken;

  await prisma.user.updateMany({
    where: { id: userId, appStoreAccountToken: null },
    data: { appStoreAccountToken: randomUUID() },
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { appStoreAccountToken: true },
  });
  if (!updated?.appStoreAccountToken) {
    throw new AppStoreServiceError('Unable to create an App Store account token', 500);
  }
  return updated.appStoreAccountToken;
};

/**
 * Verifies StoreKit 2 signed transactions sent by the app (after a purchase or
 * a restore) and updates the user's backend license. With no transactions the
 * stored subscription is refreshed from the App Store Server API when possible.
 */
/** Verifies one StoreKit 2 signed transaction (JWS) against Apple's certificates. */
export const verifySignedTransaction = async (signedTransaction: string): Promise<JWSTransactionDecodedPayload> => {
  const { value } = await verifyWithFallback(verifier => verifier.verifyAndDecodeTransaction(signedTransaction));
  return value;
};

export const syncAppStoreTransactions = async (
  userId: string,
  signedTransactions: string[],
): Promise<AppStoreEntitlementSyncResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, appStoreAccountToken: true },
  });
  if (!user) throw new AppStoreServiceError('User not found', 404);

  const uniqueTransactions = [...new Set(
    signedTransactions
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim())
      .filter(value => value.length > 0),
  )];
  if (uniqueTransactions.length > MAX_SIGNED_TRANSACTIONS) {
    throw new AppStoreServiceError('Too many App Store transactions were submitted', 400);
  }

  if (uniqueTransactions.length === 0) {
    return refreshStoredSubscription(userId);
  }

  const settled = await Promise.allSettled(uniqueTransactions.map(signed => (
    verifyWithFallback(verifier => verifier.verifyAndDecodeTransaction(signed))
  )));
  const verified = settled
    .filter((entry): entry is PromiseFulfilledResult<{
      environment: Environment;
      value: JWSTransactionDecodedPayload;
    }> => entry.status === 'fulfilled')
    .map(entry => ({ environment: entry.value.environment, transaction: entry.value.value }))
    .filter(entry => !!entry.transaction.originalTransactionId);

  if (verified.length === 0) {
    const firstFailure = settled.find(
      (entry): entry is PromiseRejectedResult => entry.status === 'rejected',
    );
    throw firstFailure?.reason instanceof AppStoreServiceError
      ? firstFailure.reason
      : new AppStoreServiceError('The App Store transaction could not be verified', 400);
  }

  // A transaction bought under another Lifeline account carries that account's token.
  const owned = verified.filter(entry => (
    !entry.transaction.appAccountToken
    || tokensMatch(entry.transaction.appAccountToken, user.appStoreAccountToken)
  ));
  if (owned.length === 0) {
    throw new AppStoreServiceError(
      'This App Store subscription was purchased with a different Lifeline account',
      409,
    );
  }

  const now = Date.now();
  const byExpiry = [...owned].sort((a, b) => {
    const aActive = !a.transaction.revocationDate && (a.transaction.expiresDate ?? 0) > now;
    const bActive = !b.transaction.revocationDate && (b.transaction.expiresDate ?? 0) > now;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return (b.transaction.expiresDate ?? 0) - (a.transaction.expiresDate ?? 0);
  });
  const best = byExpiry[0];

  const latest = await fetchLatestSnapshot(best.transaction.originalTransactionId!, best.environment)
    ?? { environment: best.environment, transaction: best.transaction };

  if (
    latest.transaction.appAccountToken
    && !tokensMatch(latest.transaction.appAccountToken, user.appStoreAccountToken)
  ) {
    throw new AppStoreServiceError(
      'This App Store subscription was purchased with a different Lifeline account',
      409,
    );
  }

  return applySnapshot(userId, latest);
};

const refreshStoredSubscription = async (userId: string): Promise<AppStoreEntitlementSyncResult> => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { appStoreEntitlementKey: entitlementKeyFor(userId) },
  });
  if (!payment) return inactiveResult('INACTIVE');

  if (payment.appStoreOriginalTransactionId) {
    const latest = await fetchLatestSnapshot(
      payment.appStoreOriginalTransactionId,
      toEnvironment(payment.storeEnvironment),
    );
    if (latest) return applySnapshot(userId, latest);
  }

  const now = new Date();
  const active = !!payment.currentPeriodEnd
    && payment.currentPeriodEnd > now
    && ['COMPLETED', 'TRIALING'].includes(payment.status ?? '');
  return {
    active,
    cancelAtPeriodEnd: active && payment.cancelAtPeriodEnd,
    entitlementId: ENTITLEMENT_ID,
    expiresAt: payment.currentPeriodEnd?.toISOString() ?? null,
    originalTransactionId: payment.appStoreOriginalTransactionId,
    paymentId: payment.id,
    pricingPlanId: payment.pricingPlanId,
    productId: payment.storeProductId,
    status: payment.status ?? 'INACTIVE',
  };
};

const resolveNotificationUserId = async (
  originalTransactionId: string,
  appAccountToken?: string,
): Promise<string | null> => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { appStoreOriginalTransactionId: originalTransactionId },
    select: { userId: true },
  });
  if (payment?.userId) return payment.userId;

  if (!appAccountToken) return null;
  const user = await prisma.user.findFirst({
    where: { appStoreAccountToken: { equals: appAccountToken, mode: 'insensitive' } },
    select: { id: true },
  });
  return user?.id ?? null;
};

/**
 * Handles an App Store Server Notification V2. The signed payload is verified
 * against Apple's root certificates, so the endpoint needs no shared secret.
 */
export const handleAppStoreNotification = async (
  signedPayload: string,
): Promise<AppStoreNotificationResult> => {
  const { environment, value: notification } = await verifyWithFallback(
    verifier => verifier.verifyAndDecodeNotification(signedPayload),
  );
  const notificationType = notification.notificationType ?? null;

  if (notificationType === NotificationTypeV2.TEST) {
    return { handled: false, notificationType, reason: 'test' };
  }

  const data = notification.data;
  if (!data?.signedTransactionInfo) {
    return { handled: false, notificationType, reason: 'no_transaction' };
  }

  const { value: transaction } = await verifyWithFallback(
    verifier => verifier.verifyAndDecodeTransaction(data.signedTransactionInfo!),
  );
  const renewalInfo = data.signedRenewalInfo
    ? (await verifyWithFallback(
        verifier => verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo!),
      )).value
    : undefined;

  const originalTransactionId = transaction.originalTransactionId;
  if (!originalTransactionId) {
    return { handled: false, notificationType, reason: 'no_original_transaction' };
  }

  const userId = await resolveNotificationUserId(
    originalTransactionId,
    transaction.appAccountToken ?? renewalInfo?.appAccountToken,
  );
  if (!userId) {
    return { handled: false, notificationType, reason: 'unknown_user' };
  }

  const latest = await fetchLatestSnapshot(originalTransactionId, environment);
  const snapshot: SubscriptionSnapshot = latest ?? {
    environment,
    renewalInfo,
    status: typeof data.status === 'number' ? data.status : undefined,
    transaction,
  };

  const result = await applySnapshot(userId, snapshot, { ignoreStale: !latest });
  return { handled: true, notificationType, result };
};
