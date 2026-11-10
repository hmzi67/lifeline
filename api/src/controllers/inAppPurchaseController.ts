import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import {
  AppStoreServiceError,
  getOrCreateAppAccountToken,
  handleAppStoreNotification,
  syncAppStoreTransactions,
} from '../services/appStoreService.js';

const sendServiceError = (res: Response, error: unknown) => {
  if (error instanceof AppStoreServiceError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  console.error('App Store subscription request failed:', error);
  return res.status(500).json({
    success: false,
    message: 'Unable to sync the App Store subscription',
  });
};

const readSignedTransactions = (body: unknown): string[] | null => {
  if (!body || typeof body !== 'object') return [];
  const { signedTransaction, signedTransactions } = body as {
    signedTransaction?: unknown;
    signedTransactions?: unknown;
  };

  const values: unknown[] = [];
  if (signedTransaction !== undefined) values.push(signedTransaction);
  if (signedTransactions !== undefined) {
    if (!Array.isArray(signedTransactions)) return null;
    values.push(...signedTransactions);
  }
  if (values.some(value => typeof value !== 'string')) return null;
  return values as string[];
};

/** GET /api/iap/apple/account-token — UUID the app passes to StoreKit as appAccountToken. */
export const getAppAccountToken = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const appAccountToken = await getOrCreateAppAccountToken(userId);
    return res.status(200).json({ success: true, data: { appAccountToken } });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

/**
 * POST /api/iap/sync — body `{ signedTransactions: string[] }` holding StoreKit 2
 * JWS transactions (`jwsRepresentation`). An empty body refreshes the stored
 * subscription from Apple.
 */
export const syncInAppPurchase = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const signedTransactions = readSignedTransactions(req.body);
  if (!signedTransactions) {
    return res.status(400).json({
      success: false,
      message: 'signedTransactions must be an array of StoreKit signed transactions',
    });
  }

  try {
    const result = await syncAppStoreTransactions(userId, signedTransactions);
    return res.status(200).json({
      success: true,
      data: result,
      message: result.active
        ? 'App Store subscription synced successfully'
        : 'No active App Store subscription was found',
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

/** POST /api/iap/apple/notifications — App Store Server Notifications V2. */
export const handleAppStoreServerNotification = async (req: Request, res: Response) => {
  const signedPayload = req.body?.signedPayload;
  if (typeof signedPayload !== 'string' || signedPayload.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid App Store notification payload' });
  }

  try {
    const outcome = await handleAppStoreNotification(signedPayload);
    return res.status(200).json({ received: true, ...outcome });
  } catch (error) {
    // Non-2xx responses make Apple retry the notification later.
    return sendServiceError(res, error);
  }
};
