import { Request } from 'express';
import { prisma } from '../config/database.js';

let adminRoleId: string | null = null;

/** The admin role's id, looked up once and kept (role ids don't change). */
export const getAdminRoleId = async (): Promise<string | null> => {
  if (adminRoleId) return adminRoleId;
  const role = await prisma.role.findFirst({ where: { name: 'admin' }, select: { id: true } });
  adminRoleId = role?.id ?? null;
  return adminRoleId;
};

/** Test hook: forget the cached admin role id. */
export const resetAdminRoleCache = () => {
  adminRoleId = null;
};

/** The Lifeline mobile app marks every request it sends with this header. */
export const isMobileAppRequest = (req: Request): boolean =>
  String(req.headers['x-requested-with'] ?? '').toLowerCase() === 'reactnative';

/**
 * Admin accounts manage content in the admin panel; they can't sign in to the mobile app
 * (they would see unpublished drafts there). The app signs out when it gets this code.
 */
export const MOBILE_ADMIN_DENIAL = {
  code: 'ADMIN_NOT_ALLOWED_ON_MOBILE',
  message: "Admin accounts can't be used in the Lifeline app. Please sign in with a regular account.",
} as const;

/** Whether this request comes from the mobile app with an admin account (by role id). */
export const isAdminOnMobile = async (req: Request, roleId: string | null | undefined): Promise<boolean> =>
  !!roleId && isMobileAppRequest(req) && roleId === (await getAdminRoleId());
