import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

// The caller already knows their identity; routines do not need a nested user.
const routineInclude = {
  fasting: true,
  sleep: true,
  medication: true,
  meditation: true,
  water: true,
};

type RoutineLinks = {
  fastingId?: string | null;
  sleepId?: string | null;
  medicationId?: string | null;
  meditationId?: string | null;
  waterId?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const authUserId = (req: Request): string | undefined => (req as unknown as AuthenticatedRequest).user?.id;

type OwnedRoutine = {
  userId: string | null;
  fasting?: { userId: string | null } | null;
  sleep?: { userId: string | null } | null;
  medication?: { userId: string | null } | null;
  water?: { userId: string | null } | null;
};

// Fail closed if a query or historical foreign-key linkage violates isolation.
// Do not serialize even part of a response containing another account's data.
const assertRoutineOwnership = (routines: OwnedRoutine[], userId: string) => {
  for (const routine of routines) {
    if (routine.userId !== userId ||
      [routine.fasting, routine.sleep, routine.medication, routine.water]
        .some(link => link && link.userId !== userId)) {
      throw new Error('Routine ownership validation failed');
    }
  }
};

const pickLinks = (body: Record<string, unknown>): RoutineLinks => {
  const links: RoutineLinks = {};
  for (const key of ['fastingId', 'sleepId', 'medicationId', 'meditationId', 'waterId'] as const) {
    if (body[key] !== undefined) links[key] = (body[key] as string | null) || null;
  }
  return links;
};

/**
 * Fasting, sleep, medication and water rows are per-user logs; a routine may
 * only point at the caller's own. Meditations are a shared catalogue.
 */
const findForeignLink = async (userId: string, links: RoutineLinks): Promise<string | null> => {
  const checks: Array<[string, () => Promise<{ userId: string | null } | null>]> = [];
  if (links.fastingId) checks.push(['fastingId', () => prisma.fastingLog.findUnique({ where: { id: links.fastingId! }, select: { userId: true } })]);
  if (links.sleepId) checks.push(['sleepId', () => prisma.sleepLog.findUnique({ where: { id: links.sleepId! }, select: { userId: true } })]);
  if (links.medicationId) checks.push(['medicationId', () => prisma.medication.findUnique({ where: { id: links.medicationId! }, select: { userId: true } })]);
  if (links.waterId) checks.push(['waterId', () => prisma.waterIntakeLog.findUnique({ where: { id: links.waterId! }, select: { userId: true } })]);
  for (const [field, load] of checks) {
    const row = await load();
    if (!row || row.userId !== userId) return field;
  }
  if (links.meditationId) {
    const meditation = await prisma.meditation.findUnique({ where: { id: links.meditationId }, select: { id: true } });
    if (!meditation) return 'meditationId';
  }
  return null;
};

const serverError = (res: Response, context: string, error: unknown) => {
  console.error(`Error ${context}:`, error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error instanceof Error ? error.message : 'Unknown error',
  });
};

export class UserDailyRoutineController {
  // Create a new daily routine for the signed-in user
  static async createUserDailyRoutine(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (req.body.userId && req.body.userId !== userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only create your own routines' });
        return;
      }

      const links = pickLinks(req.body);
      const foreign = await findForeignLink(userId, links);
      if (foreign) {
        res.status(400).json({ success: false, message: `Invalid ${foreign}` });
        return;
      }

      const { routinesDate } = req.body;
      const userDailyRoutine = await prisma.userDailyRoutine.create({
        data: {
          userId,
          ...links,
          routinesDate: routinesDate ? new Date(routinesDate) : undefined,
        },
        include: routineInclude,
      });

      assertRoutineOwnership([userDailyRoutine], userId);

      res.status(201).json({
        success: true,
        message: 'User daily routine created successfully',
        data: userDailyRoutine,
      });
    } catch (error) {
      serverError(res, 'creating user daily routine', error);
    }
  }

  /**
   * PUT /user-daily-routines/today  { date: 'YYYY-MM-DD', meditationId?, waterId?, ... }
   * Create-or-update the caller's routine for their local day, so clients don't
   * need to look up the row id (and can't create duplicates for one day).
   */
  static async upsertTodayRoutine(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const date = typeof req.body.date === 'string' ? req.body.date : '';
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
        res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
        return;
      }

      const links = pickLinks(req.body);
      if (Object.keys(links).length === 0) {
        res.status(400).json({ success: false, message: 'Nothing to update' });
        return;
      }
      const foreign = await findForeignLink(userId, links);
      if (foreign) {
        res.status(400).json({ success: false, message: `Invalid ${foreign}` });
        return;
      }

      const routinesDate = new Date(date);
      const existing = await prisma.userDailyRoutine.findFirst({
        where: { userId, routinesDate },
        orderBy: { id: 'desc' },
        select: { id: true },
      });

      const routine = existing
        ? await prisma.userDailyRoutine.update({ where: { id: existing.id }, data: links, include: routineInclude })
        : await prisma.userDailyRoutine.create({ data: { userId, routinesDate, ...links }, include: routineInclude });

      assertRoutineOwnership([routine], userId);

      res.status(existing ? 200 : 201).json({
        success: true,
        message: 'Daily routine saved',
        data: routine,
      });
    } catch (error) {
      serverError(res, 'saving today routine', error);
    }
  }

  // List the signed-in user's daily routines
  static async getAllUserDailyRoutines(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (req.query.userId && req.query.userId !== userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only view your own routines' });
        return;
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;

      const where: { userId: string; routinesDate?: Date } = { userId };
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      if (DATE_RE.test(date)) where.routinesDate = new Date(date);

      const [userDailyRoutines, total] = await Promise.all([
        prisma.userDailyRoutine.findMany({
          where,
          skip,
          take: limit,
          include: routineInclude,
          orderBy: [{ routinesDate: 'desc' }, { id: 'desc' }],
        }),
        prisma.userDailyRoutine.count({ where }),
      ]);

      assertRoutineOwnership(userDailyRoutines, userId);

      res.status(200).json({
        success: true,
        message: 'User daily routines retrieved successfully',
        data: userDailyRoutines,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      serverError(res, 'getting user daily routines', error);
    }
  }

  // Get one of the signed-in user's routines by ID
  static async getUserDailyRoutineById(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      const userDailyRoutine = await prisma.userDailyRoutine.findUnique({
        where: { id: req.params.id },
        include: routineInclude,
      });

      // 404 rather than 403 so other users' IDs can't be probed.
      if (!userDailyRoutine || userDailyRoutine.userId !== userId) {
        res.status(404).json({ success: false, message: 'User daily routine not found' });
        return;
      }

      assertRoutineOwnership([userDailyRoutine], userId!);

      res.status(200).json({
        success: true,
        message: 'User daily routine retrieved successfully',
        data: userDailyRoutine,
      });
    } catch (error) {
      serverError(res, 'getting user daily routine', error);
    }
  }

  // Update one of the signed-in user's routines
  static async updateUserDailyRoutine(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      const { id } = req.params;

      const existingRoutine = await prisma.userDailyRoutine.findUnique({ where: { id } });
      if (!existingRoutine || existingRoutine.userId !== userId) {
        res.status(404).json({ success: false, message: 'User daily routine not found' });
        return;
      }
      if (req.body.userId && req.body.userId !== userId) {
        res.status(403).json({ success: false, message: 'Forbidden: Cannot reassign a routine to another user' });
        return;
      }

      const links = pickLinks(req.body);
      const foreign = await findForeignLink(userId!, links);
      if (foreign) {
        res.status(400).json({ success: false, message: `Invalid ${foreign}` });
        return;
      }

      const { routinesDate } = req.body;
      const updatedUserDailyRoutine = await prisma.userDailyRoutine.update({
        where: { id },
        data: {
          ...links,
          routinesDate: routinesDate ? new Date(routinesDate) : undefined,
        },
        include: routineInclude,
      });

      assertRoutineOwnership([updatedUserDailyRoutine], userId!);

      res.status(200).json({
        success: true,
        message: 'User daily routine updated successfully',
        data: updatedUserDailyRoutine,
      });
    } catch (error) {
      serverError(res, 'updating user daily routine', error);
    }
  }

  // Delete one of the signed-in user's routines
  static async deleteUserDailyRoutine(req: Request, res: Response): Promise<void> {
    try {
      const userId = authUserId(req);
      const { id } = req.params;

      const existingRoutine = await prisma.userDailyRoutine.findUnique({ where: { id } });
      if (!existingRoutine || existingRoutine.userId !== userId) {
        res.status(404).json({ success: false, message: 'User daily routine not found' });
        return;
      }

      await prisma.userDailyRoutine.delete({ where: { id } });

      res.status(200).json({
        success: true,
        message: 'User daily routine deleted successfully',
      });
    } catch (error) {
      serverError(res, 'deleting user daily routine', error);
    }
  }

  // Get daily routines by user ID (own user only)
  static async getUserDailyRoutinesByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (userId !== authUserId(req)) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only view your own routines' });
        return;
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;

      const [userDailyRoutines, total] = await Promise.all([
        prisma.userDailyRoutine.findMany({
          where: { userId },
          skip,
          take: limit,
          include: {
            fasting: true,
            sleep: true,
            medication: true,
            meditation: true,
            water: true,
          },
          orderBy: [{ routinesDate: 'desc' }, { id: 'desc' }],
        }),
        prisma.userDailyRoutine.count({ where: { userId } }),
      ]);

      assertRoutineOwnership(userDailyRoutines, userId);

      res.status(200).json({
        success: true,
        message: 'User daily routines retrieved successfully',
        data: userDailyRoutines,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      serverError(res, 'getting user daily routines by user ID', error);
    }
  }
}
