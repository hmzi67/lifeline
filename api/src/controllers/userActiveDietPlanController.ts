import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { Request, Response } from 'express';

/** The user's current plan: the one not ended. A unique index keeps it to one per user. */
const openPlanWhere = (userId: string) => ({ userId, endedAt: null });

const planInclude = {
  user: { select: { id: true, email: true, username: true } },
  diet: true,
} as const;

// Get user's active diet plan
export const getUserActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const activePlan = await prisma.userActiveDietPlan.findFirst({
      where: openPlanWhere(userId),
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        diet: {
          include: {
            dietPlanDays: {
              include: {
                dietPlanMeals: {
                  include: {
                    mealType: true
                  }
                }
              },
              orderBy: {
                dayNumber: 'asc'
              }
            }
          }
        }
      }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'No active diet plan found for this user'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: activePlan,
      message: 'Active diet plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching active diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Start a new active diet plan
export const startActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, dietId, currentDay } = req.body;
    // The app sends this after the user agreed to deactivate their current plan.
    const replaceActive = req.body?.replaceActive === true;

    if (!userId || !dietId) {
      res.status(400).json({
        success: false,
        message: 'User ID and diet ID are required'
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

    // Verify diet plan exists
    const diet = await prisma.dietPlan.findUnique({
      where: { id: dietId }
    });

    if (!diet) {
      res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
      return;
    }

    // One plan at a time (paused plans count: they can be resumed).
    const existingActivePlan = await prisma.userActiveDietPlan.findFirst({
      where: openPlanWhere(userId),
      orderBy: { startedAt: 'desc' },
      include: { diet: { select: { id: true, name: true } } },
    });

    if (existingActivePlan && existingActivePlan.dietId === dietId) {
      // Already following this plan: nothing to start.
      const plan = await prisma.userActiveDietPlan.findUnique({ where: { id: existingActivePlan.id }, include: planInclude });
      res.status(200).json({ success: true, data: plan, message: 'This diet plan is already active' });
      return;
    }

    if (existingActivePlan && !replaceActive) {
      res.status(409).json({
        success: false,
        code: 'ACTIVE_DIET_PLAN_EXISTS',
        message: `You're already following "${existingActivePlan.diet?.name ?? 'another diet plan'}". Deactivate it to start this one.`,
        data: {
          activePlan: {
            id: existingActivePlan.id,
            dietId: existingActivePlan.dietId,
            dietName: existingActivePlan.diet?.name ?? null,
            currentDay: existingActivePlan.currentDay,
            startedAt: existingActivePlan.startedAt,
          },
        },
      });
      return;
    }

    // End the old plan and start the new one together, so the user is never left with none or two.
    const now = new Date();
    const activePlan = await prisma.$transaction(async (tx) => {
      if (existingActivePlan) {
        await tx.userActiveDietPlan.updateMany({ where: openPlanWhere(userId), data: { endedAt: now } });
      }
      return tx.userActiveDietPlan.create({
        data: {
          userId,
          dietId,
          currentDay: currentDay || 1,
          startedAt: now
        },
        include: planInclude
      });
    });

    res.status(201).json({
      success: true,
      data: activePlan,
      message: 'Active diet plan started successfully'
    });
  } catch (error) {
    // Two starts at once: the one-open-plan-per-user index rejects the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({
        success: false,
        code: 'ACTIVE_DIET_PLAN_EXISTS',
        message: 'You already have an active diet plan. Deactivate it to start this one.'
      });
      return;
    }
    console.error('Error starting active diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Pause active diet plan
export const pauseActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveDietPlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active diet plan not found'
      });
      return;
    }

    if (activePlan.endedAt) {
      res.status(400).json({ success: false, message: 'This diet plan has been deactivated' });
      return;
    }

    if (activePlan.pausedAt) {
      res.status(400).json({
        success: false,
        message: 'Diet plan is already paused'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveDietPlan.update({
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
        diet: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Active diet plan paused successfully'
    });
  } catch (error) {
    console.error('Error pausing active diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Resume active diet plan
export const resumeActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveDietPlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active diet plan not found'
      });
      return;
    }

    if (activePlan.endedAt) {
      res.status(400).json({ success: false, message: 'This diet plan has been deactivated' });
      return;
    }

    if (!activePlan.pausedAt) {
      res.status(400).json({
        success: false,
        message: 'Diet plan is not paused'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveDietPlan.update({
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
        diet: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Active diet plan resumed successfully'
    });
  } catch (error) {
    console.error('Error resuming active diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update current day
export const updateCurrentDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { currentDay } = req.body;

    if (!currentDay) {
      res.status(400).json({
        success: false,
        message: 'Current day is required'
      });
      return;
    }

    const activePlan = await prisma.userActiveDietPlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active diet plan not found'
      });
      return;
    }

    const updatedPlan = await prisma.userActiveDietPlan.update({
      where: { id },
      data: { currentDay },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        diet: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Current day updated successfully'
    });
  } catch (error) {
    console.error('Error updating current day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Deactivate (end) the plan. Unlike delete, its meal logs stay as history.
export const endActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveDietPlan.findUnique({ where: { id } });
    if (!activePlan) {
      res.status(404).json({ success: false, message: 'Active diet plan not found' });
      return;
    }

    const updatedPlan = activePlan.endedAt
      ? await prisma.userActiveDietPlan.findUnique({ where: { id }, include: planInclude })
      : await prisma.userActiveDietPlan.update({ where: { id }, data: { endedAt: new Date() }, include: planInclude });

    res.status(200).json({
      success: true,
      data: updatedPlan,
      message: 'Diet plan deactivated'
    });
  } catch (error) {
    console.error('Error deactivating diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete active diet plan
export const deleteActiveDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const activePlan = await prisma.userActiveDietPlan.findUnique({
      where: { id }
    });

    if (!activePlan) {
      res.status(404).json({
        success: false,
        message: 'Active diet plan not found'
      });
      return;
    }

    await prisma.userActiveDietPlan.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Active diet plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting active diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
