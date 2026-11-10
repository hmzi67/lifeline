import { NextFunction, Request, Response } from 'express';
import { findActiveLicense, findFreeWeek } from '../services/subscriptionAccessService.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const requireActiveLicense = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  const userId = user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  // Staff must be able to preview and administer VIP content without holding
  // a consumer subscription themselves.
  if (user.role === 'admin') {
    return next();
  }

  try {
    // VIP, or the account's free week (timed by the server clock) is still running.
    const hasAccess = Boolean(await findActiveLicense(userId)) || (await findFreeWeek(user.email)).active;
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'An active Lifeline VIP subscription is required',
        code: 'ACTIVE_SUBSCRIPTION_REQUIRED',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireActiveLicense;
