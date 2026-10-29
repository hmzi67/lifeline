import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { AppError } from './errorHandler.js';

const isAdmin = (req: Request) => (req as AuthenticatedRequest).user?.role === 'admin';

/** Allows the request only when `req.params[param]` is the caller's own user ID (admins pass). */
export const requireSelfOrAdmin =
  (param = 'userId') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    if (isAdmin(req) || req.params[param] === user.id) return next();
    return next(new AppError('Forbidden: you can only access your own data', 403, 'FORBIDDEN'));
  };

/**
 * Forces `req.body.userId` to the caller's ID so a client cannot act on behalf of
 * another user. Admins may still target any user.
 */
export const bindBodyUserIdToCaller = (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
  if (!isAdmin(req)) req.body = { ...(req.body ?? {}), userId: user.id };
  next();
};

type OwnedModel =
  | 'userDietPlan'
  | 'userExercise'
  | 'userActiveExercisePlan'
  | 'userExerciseProgress'
  | 'userActiveDietPlan'
  | 'userWaterGoal';

const findOwner = (model: OwnedModel, id: string): Promise<{ userId: string | null } | null> => {
  const args = { where: { id }, select: { userId: true } };
  switch (model) {
    case 'userDietPlan':
      return prisma.userDietPlan.findUnique(args);
    case 'userExercise':
      return prisma.userExercise.findUnique(args);
    case 'userActiveExercisePlan':
      return prisma.userActiveExercisePlan.findUnique(args);
    case 'userExerciseProgress':
      return prisma.userExerciseProgress.findUnique(args);
    case 'userActiveDietPlan':
      return prisma.userActiveDietPlan.findUnique(args);
    case 'userWaterGoal':
      return prisma.userWaterGoal.findUnique(args);
  }
};

/** Allows the request only when the `model` row named by `req.params[param]` belongs to the caller. */
export const requireRecordOwner =
  (model: OwnedModel, param = 'id') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    if (isAdmin(req)) return next();
    try {
      const record = await findOwner(model, req.params[param]);
      // Same response for "missing" and "not yours" so IDs cannot be probed.
      if (!record || record.userId !== user.id) return next(new AppError('Not found', 404, 'NOT_FOUND'));
      next();
    } catch (err) {
      next(err);
    }
  };
