import { Request, Response } from 'express';
import { findActiveLicense, findFreeWeek, FreeWeek, hasUsedFreeTrial, startFreeWeek } from '../services/subscriptionAccessService.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const freeWeekJson = (freeWeek: FreeWeek) => ({
  active: freeWeek.active,
  startedAt: freeWeek.startedAt?.toISOString() ?? null,
  endsAt: freeWeek.endsAt?.toISOString() ?? null,
});

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const userId = user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const now = new Date();
    const [activeLicense, usedTrial, freeWeek] = await Promise.all([
      findActiveLicense(userId, now),
      hasUsedFreeTrial(userId),
      findFreeWeek(user.email, now),
    ]);
    const payment = activeLicense?.payment;

    return res.status(200).json({
      success: true,
      data: {
        active: Boolean(activeLicense),
        expiresAt: activeLicense?.expiresAt?.toISOString() ?? null,
        cancelAtPeriodEnd: payment?.cancelAtPeriodEnd ?? false,
        pricingPlanId: payment?.pricingPlanId ?? null,
        productId: payment?.storeProductId ?? null,
        source: payment?.method ?? null,
        // Lets the app offer a plan's free trial only to someone who can still get it.
        trialAvailable: !usedTrial,
        freeWeek: freeWeekJson(freeWeek),
        // Full app: VIP, or still inside the free week. The app locks itself when this is false.
        hasAccess: Boolean(activeLicense) || freeWeek.active,
        // Lets the app work out time left from its own clock offset, not the phone's date.
        serverTime: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Subscription status lookup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve subscription status',
    });
  }
};

/** "Continue for free" on the paywall: starts the one free week (a no-op if it already started). */
export const startFreeWeekAccess = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.id) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const freeWeek = await startFreeWeek(user.email);
    return res.status(200).json({ success: true, data: { freeWeek: freeWeekJson(freeWeek) } });
  } catch (error) {
    console.error('Free week start failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to start your free week' });
  }
};
