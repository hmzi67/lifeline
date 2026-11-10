import { prisma } from '../config/database.js';
import { Request, Response } from 'express';

interface CompleteExerciseBody {
  userId?: string;
  exerciseScheduleId?: string;
  exerciseId?: string;
  progressPercent?: number;
  note?: string;
  completed?: boolean;
  completedAt?: string;
  elapsedSeconds?: number;
}

const clampProgress = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 100;
  return Math.max(0, Math.min(100, Math.floor(value)));
};

export const getUserExerciseProgress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const progress = await prisma.userExerciseProgress.findMany({
      where: { userId },
      include: {
        exerciseSchedule: {
          include: {
            exercise: true,
            week: { include: { plan: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: progress,
      message: 'User exercise progress retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching user exercise progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const completeUserExerciseProgress = async (
  req: Request<{}, {}, CompleteExerciseBody>,
  res: Response,
): Promise<void> => {
  try {
    const {
      userId,
      exerciseScheduleId: rawExerciseScheduleId,
      exerciseId,
      progressPercent,
      note,
      completed,
      completedAt,
      elapsedSeconds,
    } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    if (!rawExerciseScheduleId && !exerciseId) {
      res.status(400).json({
        success: false,
        message: 'Exercise schedule ID or exercise ID is required',
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    let exerciseScheduleId = rawExerciseScheduleId;

    if (!exerciseScheduleId && exerciseId) {
      const activePlan = await prisma.userActiveExercisePlan.findFirst({
        where: {
          userId,
          pausedAt: null,
        },
        include: {
          plan: {
            include: {
              exercisePlanWeeks: {
                where: {
                  weekNumber: undefined,
                },
                include: {
                  exercisePlanSchedule: {
                    where: {
                      exerciseId,
                    },
                    orderBy: {
                      orderIndex: 'asc',
                    },
                  },
                },
              },
            },
          },
        },
      });

      const allWeeks = Array.isArray(activePlan?.plan?.exercisePlanWeeks)
        ? activePlan!.plan.exercisePlanWeeks
        : [];

      const currentWeek = allWeeks.find((week: any) => week.weekNumber === activePlan?.currentWeek);
      const candidateFromCurrentWeek = currentWeek?.exercisePlanSchedule?.[0]?.id;

      const fallbackFromAnyWeek = allWeeks
        .flatMap((week: any) => week.exercisePlanSchedule || [])
        .find((schedule: any) => schedule?.exerciseId === exerciseId)?.id;

      exerciseScheduleId = candidateFromCurrentWeek || fallbackFromAnyWeek;
    }

    if (!exerciseScheduleId) {
      res.status(404).json({
        success: false,
        message: 'Exercise schedule not found for this user/exercise',
      });
      return;
    }

    const schedule = await prisma.exercisePlanSchedule.findUnique({
      where: { id: exerciseScheduleId },
    });

    if (!schedule) {
      res.status(404).json({
        success: false,
        message: 'Exercise schedule not found',
      });
      return;
    }

    const existingOpenProgress = await prisma.userExerciseProgress.findFirst({
      where: {
        userId,
        exerciseScheduleId,
        completed: false,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    const persistedNote = note
      ? note
      : typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds)
        ? `Elapsed: ${Math.floor(elapsedSeconds)}s`
        : null;

    const payload = {
      progressPercent: clampProgress(progressPercent),
      note: persistedNote,
      completed: completed ?? true,
      // A past day is allowed (a missed workout added later); a future or invalid one means now.
      completedAt: completedAt && Date.parse(completedAt) <= Date.now() ? new Date(completedAt) : new Date(),
    };

    const savedProgress = existingOpenProgress
      ? await prisma.userExerciseProgress.update({
          where: { id: existingOpenProgress.id },
          data: payload,
          include: {
            exerciseSchedule: true,
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        })
      : await prisma.userExerciseProgress.create({
          data: {
            userId,
            exerciseScheduleId,
            ...payload,
          },
          include: {
            exerciseSchedule: true,
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        });

    res.status(201).json({
      success: true,
      data: savedProgress,
      message: 'Exercise progress saved successfully',
    });
  } catch (error) {
    console.error('Error saving user exercise progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
