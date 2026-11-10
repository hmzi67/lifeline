import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Get user's active exercise plan
export const getUserActiveExercisePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const activePlan = await prisma.userActiveExercisePlan.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        plan: {
          include: {
            exercisePlanWeeks: {
              include: {
                exercisePlanSchedule: {
                  include: {
                    exercise: true
                  },
                  orderBy: {
                    orderIndex: 'asc'
                  }
                }
              },
              orderBy: {
                weekNumber: 'asc'
              }
            }
          }
        }
      }
    });

    if (!activePlan) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'No active exercise plan found for this user'
      });
      return;
    }

    // Week completion: scheduled exercises completed since this plan was started.
    const scheduleIds = activePlan.plan.exercisePlanWeeks.flatMap((week) => week.exercisePlanSchedule.map((item) => item.id));
    const completed = scheduleIds.length
      ? await prisma.userExerciseProgress.findMany({
          where: { userId, completed: true, exerciseScheduleId: { in: scheduleIds }, completedAt: { gte: activePlan.startedAt } },
          select: { exerciseScheduleId: true },
          distinct: ['exerciseScheduleId'],
        })
      : [];
    const completedIds = new Set(completed.map((row) => row.exerciseScheduleId));
    const weekProgress = activePlan.plan.exercisePlanWeeks.map((week) => {
      const total = week.exercisePlanSchedule.length;
      const done = week.exercisePlanSchedule.filter((item) => completedIds.has(item.id)).length;
      return { weekNumber: week.weekNumber, completed: done, total, percent: total ? Math.round((done / total) * 100) : 0 };
    });

    res.status(200).json({
      success: true,
      data: { ...activePlan, weekProgress },
      message: 'Active exercise plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching active exercise plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Start a new active exercise plan
export const startActiveExercisePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, planId, currentWeek } = req.body;

    if (!userId || !planId) {
      res.status(400).json({
        success: false,
        message: 'User ID and plan ID are required'
      });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify exercise plan exists
    const plan = await prisma.exercisePlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan not found'
      });
      return;
    }

    // Check if user already has an active exercise plan
    const existingActivePlan = await prisma.userActiveExercisePlan.findFirst({
      where: {
        userId,
        pausedAt: null
      }
    });

    if (existingActivePlan) {
      res.status(400).json({
        success: false,
        message: 'User already has an active exercise plan. Please pause it first.'
      });
      return;
    }

    const activePlan = await prisma.userActiveExercisePlan.create({
      data: {
        userId,
        planId,
        currentWeek: currentWeek || 1,
        startedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        plan: true
      }
    });

    res.status(201).json({
      success: true,
      data: activePlan,
      message: 'Active exercise plan started successfully'
    });
  } catch (error) {
    console.error('Error starting active exercise plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Pause active exercise plan
export const pauseActiveExercisePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveExercisePlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active exercise plan not found'
      });
      return;
    }

    if (activePlan.pausedAt) {
      res.status(400).json({
        success: false,
        message: 'Exercise plan is already paused'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveExercisePlan.update({
      where: { id },
      data: {
        pausedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        plan: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Active exercise plan paused successfully'
    });
  } catch (error) {
    console.error('Error pausing active exercise plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Resume active exercise plan
export const resumeActiveExercisePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveExercisePlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active exercise plan not found'
      });
      return;
    }

    if (!activePlan.pausedAt) {
      res.status(400).json({
        success: false,
        message: 'Exercise plan is not paused'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveExercisePlan.update({
      where: { id },
      data: {
        pausedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        plan: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Active exercise plan resumed successfully'
    });
  } catch (error) {
    console.error('Error resuming active exercise plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update current week
export const updateCurrentWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { currentWeek } = req.body;

    if (!currentWeek) {
      res.status(400).json({
        success: false,
        message: 'Current week is required'
      });
      return;
    }

    const activePlan = await prisma.userActiveExercisePlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active exercise plan not found'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveExercisePlan.update({
      where: { id },
      data: { currentWeek },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        plan: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Current week updated successfully'
    });
  } catch (error) {
    console.error('Error updating current week:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete active exercise plan
export const deleteActiveExercisePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveExercisePlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active exercise plan not found'
      });
      return;
    }

    await prisma.userActiveExercisePlan.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Active exercise plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting active exercise plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
