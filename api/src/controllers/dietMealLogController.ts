import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const prismaClient = prisma as any;

const getAuthenticatedUserId = (req: Request): string | null => {
  return (req as AuthenticatedRequest).user?.id || null;
};

const parseDateOnly = (value?: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const todayDateOnly = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const dateOnlyString = (date: Date): string => date.toISOString().slice(0, 10);

// GET /api/diet-meal-logs?date=YYYY-MM-DD
// Returns the user's logged meals for a given date (defaults to today)
export const getLoggedMeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const requestedDate = parseDateOnly(req.query.date) ?? todayDateOnly();

    const logs = await prismaClient.dietMealLog.findMany({
      where: {
        userId,
        date: requestedDate,
      },
      orderBy: {
        loggedAt: 'asc',
      },
      include: {
        meal: {
          include: {
            mealType: true,
            day: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: logs.map((log: any) => ({
        id: log.id,
        userId: log.userId,
        activePlanId: log.activePlanId,
        mealId: log.mealId,
        mealName: log.mealName || log.meal?.name || null,
        mealType: log.mealType || log.meal?.mealType?.name || null,
        calories: log.calories ?? log.meal?.calories ?? 0,
        date: dateOnlyString(log.date),
        loggedAt: log.loggedAt,
        meal: log.meal,
      })),
      message: 'Meal logs fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching meal logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/diet-meal-logs
// Logs a meal as consumed. Repeating the same meal for the same date is idempotent.
export const logMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { activePlanId, mealId, mealName, mealType, calories } = req.body;
    const logDate = parseDateOnly(req.body.date);

    if (!activePlanId || !mealId || !logDate) {
      res.status(400).json({
        success: false,
        message: 'activePlanId, mealId and valid date are required',
      });
      return;
    }

    const [activePlan, meal] = await Promise.all([
      prisma.userActiveDietPlan.findFirst({
        where: {
          id: String(activePlanId),
          userId,
          // Meals can't be logged against a deactivated plan.
          endedAt: null,
        },
      }),
      prisma.dietPlanMeal.findUnique({
        where: {
          id: String(mealId),
        },
        include: {
          day: true,
          mealType: true,
        },
      }),
    ]);

    if (!activePlan) {
      res.status(404).json({ success: false, message: 'Active diet plan not found for this user' });
      return;
    }

    if (!meal || meal.day.dietId !== activePlan.dietId) {
      res.status(404).json({ success: false, message: 'Meal does not belong to the active diet plan' });
      return;
    }

    const payload = {
      userId,
      activePlanId: activePlan.id,
      mealId: meal.id,
      mealName: typeof mealName === 'string' && mealName.trim() ? mealName.trim() : meal.name,
      mealType: typeof mealType === 'string' && mealType.trim() ? mealType.trim() : meal.mealType.name,
      calories: Number.isFinite(Number(calories)) ? Number(calories) : meal.calories,
      date: logDate,
    };

    const existing = await prismaClient.dietMealLog.findFirst({
      where: {
        userId,
        mealId: meal.id,
        date: logDate,
      },
    });

    const log = existing
      ? await prismaClient.dietMealLog.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prismaClient.dietMealLog.create({
          data: payload,
        });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: {
        ...log,
        date: dateOnlyString(log.date),
      },
      message: 'Meal logged successfully',
    });
  } catch (error) {
    console.error('Error logging meal:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/diet-meal-logs/meal/:mealId/date/:date
// Removes the meal log (uncheck)
export const unlogMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { mealId, date } = req.params;
    const logDate = parseDateOnly(date);

    if (!mealId || !logDate) {
      res.status(400).json({ success: false, message: 'mealId and valid date are required' });
      return;
    }

    const result = await prismaClient.dietMealLog.deleteMany({
      where: {
        userId,
        mealId,
        date: logDate,
      },
    });

    res.status(200).json({
      success: true,
      data: { deleted: result.count },
      message: result.count > 0 ? 'Meal log removed successfully' : 'Meal was not logged',
    });
  } catch (error) {
    console.error('Error unlogging meal:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
