import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

// Enough of the plan for the Favourites screen; the schedule is only read to count exercises.
const PLAN_SELECT = {
  id: true,
  name: true,
  level: true,
  image: true,
  durationWeeks: true,
  exercisePlanWeeks: { select: { exercisePlanSchedule: { select: { exerciseId: true } } } },
} as const;

type FavoriteRow = {
  id: string;
  planId: string;
  favoritedAt: Date;
  plan: {
    id: string;
    name: string;
    level: string | null;
    image: string | null;
    durationWeeks: number | null;
    exercisePlanWeeks: { exercisePlanSchedule: { exerciseId: string }[] }[];
  };
};

const toResponse = ({ plan, ...favorite }: FavoriteRow) => {
  const { exercisePlanWeeks, ...planFields } = plan;
  const exerciseIds = new Set(exercisePlanWeeks.flatMap(week => week.exercisePlanSchedule.map(s => s.exerciseId)));
  return { ...favorite, plan: { ...planFields, exerciseCount: exerciseIds.size } };
};

// GET /api/favorite-exercise-plans - the caller's favourite exercise plans, newest first
export const getFavoriteExercisePlans = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const favorites = await prisma.userFavoriteExercisePlan.findMany({
      where: { userId },
      select: { id: true, planId: true, favoritedAt: true, plan: { select: PLAN_SELECT } },
      orderBy: { favoritedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: favorites.map(toResponse),
      message: 'Favorite exercise plans retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching favorite exercise plans:', error);
    res.status(500).json({ success: false, message: 'Failed to load favorite exercise plans' });
  }
};

// POST /api/favorite-exercise-plans { planId } - add a plan; adding it twice is not an error
export const addFavoriteExercisePlan = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const planId = typeof req.body?.planId === 'string' ? req.body.planId.trim() : '';
  if (!planId) {
    res.status(400).json({ success: false, message: 'planId is required' });
    return;
  }

  try {
    const plan = await prisma.exercisePlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) {
      res.status(404).json({ success: false, message: 'Exercise plan not found' });
      return;
    }

    const favorite = await prisma.userFavoriteExercisePlan.upsert({
      where: { userId_planId: { userId, planId } },
      create: { userId, planId },
      update: {},
      select: { id: true, planId: true, favoritedAt: true, plan: { select: PLAN_SELECT } },
    });

    res.status(201).json({
      success: true,
      data: toResponse(favorite),
      message: 'Exercise plan added to favorites',
    });
  } catch (error) {
    console.error('Error adding favorite exercise plan:', error);
    res.status(500).json({ success: false, message: 'Failed to add exercise plan to favorites' });
  }
};

// DELETE /api/favorite-exercise-plans/:planId - remove a plan; removing a missing one is not an error
export const removeFavoriteExercisePlan = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    // Scoped to the caller, so one user can never remove another's favourite.
    await prisma.userFavoriteExercisePlan.deleteMany({ where: { userId, planId: req.params.planId } });
    res.status(200).json({ success: true, message: 'Exercise plan removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite exercise plan:', error);
    res.status(500).json({ success: false, message: 'Failed to remove exercise plan from favorites' });
  }
};
