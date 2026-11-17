import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/accessToken.js';
import { getAdminRoleId } from '../utils/adminRole.js';

export { resetAdminRoleCache } from '../utils/adminRole.js';

/**
 * For public read endpoints: marks the request as coming from an admin when it carries a
 * valid admin access token, so drafts can be listed for the admin panel. Never rejects a
 * request: a missing, expired or non-admin token simply sees published content only.
 * (Admin accounts can't sign in to the mobile app, so drafts never reach it.)
 */
const detectAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(header.substring(7)) as { roleId?: string };
      if (decoded.roleId && decoded.roleId === (await getAdminRoleId())) {
        (req as Request & { viewerIsAdmin?: boolean }).viewerIsAdmin = true;
      }
    }
  } catch {
    // Not an admin token; carry on as a normal viewer.
  }
  next();
};

export default detectAdmin;
