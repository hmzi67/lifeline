import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const DEFAULT_WATER_GOAL_ML = 2500;

const getDefaultWaterGoal = async () => {
  const setting = await prisma.appSetting.findFirst({
    where: {
      key: 'daily_water_goal_ml',
      scope: 'user'
    }
  });

  const parsedValue = setting?.value ? Number(setting.value) : NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_WATER_GOAL_ML;
};

// Get user's water goal
export const getUserWaterGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const waterGoal = await prisma.userWaterGoal.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!waterGoal) {
      const defaultGoalAmount = await getDefaultWaterGoal();

      res.status(200).json({
        success: true,
        data: {
          id: null,
          userId,
          goalAmount: defaultGoalAmount,
          unit: 'ml',
          updatedAt: null,
          user: null
        },
        message: 'Default water goal retrieved successfully'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: waterGoal,
      message: 'Water goal retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching water goal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Set or update user's water goal
export const setUserWaterGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, goalAmount: rawGoalAmount, unit: rawUnit } = req.body;

    if (!userId || !rawGoalAmount || !rawUnit) {
      res.status(400).json({
        success: false,
        message: 'User ID, goal amount, and unit are required'
      });
      return;
    }

    const authUser = (req as unknown as AuthenticatedRequest).user;
    if (authUser?.id !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only set your own water goal' });
      return;
    }

    // Goals are stored as whole ml (column is Int) so they compare directly with
    // intake logs. Litre input ("L", "Lt", "litres") is converted.
    const parsedAmount = Number(rawGoalAmount);
    const isLitres = /^l(t|itre|iter)?s?$/i.test(String(rawUnit).trim());
    const goalAmount = Math.round(isLitres ? parsedAmount * 1000 : parsedAmount);
    const unit = 'ml';
    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      res.status(400).json({ success: false, message: 'Goal amount must be a positive number' });
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

    // Check if user already has a water goal
    const existingGoal = await prisma.userWaterGoal.findFirst({
      where: { userId }
    });

    let waterGoal;

    if (existingGoal) {
      // Update existing goal
      waterGoal = await prisma.userWaterGoal.update({
        where: { id: existingGoal.id },
        data: {
          goalAmount,
          unit,
          updatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      });
    } else {
      // Create new goal
      waterGoal = await prisma.userWaterGoal.create({
        data: {
          userId,
          goalAmount,
          unit,
          updatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      });
    }

    res.status(existingGoal ? 200 : 201).json({
      success: true,
      data: waterGoal,
      message: existingGoal ? 'Water goal updated successfully' : 'Water goal created successfully'
    });
  } catch (error) {
    console.error('Error setting water goal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete user's water goal
export const deleteUserWaterGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingGoal = await prisma.userWaterGoal.findUnique({
      where: { id }
    });

    if (!existingGoal) {
      res.status(404).json({
        success: false,
        message: 'Water goal not found'
      });
      return;
    }

    await prisma.userWaterGoal.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Water goal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting water goal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all water goals (admin)
export const getAllWaterGoals = async (req: Request, res: Response): Promise<void> => {
  try {
    const waterGoals = await prisma.userWaterGoal.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: waterGoals,
      message: 'Water goals retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching water goals:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
