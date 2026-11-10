import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

interface AssignDietPlanBody {
  userId: string;
  dietId: string;
}

interface UpdateUserDietPlanBody {
  userId?: string;
  dietId?: string;
}

// Get all user diet plans
export const getAllUserDietPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const userDietPlans = await prisma.userDietPlan.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profileImage: true
          }
        },
        diet: {
          select: {
            id: true,
            name: true,
            calories: true,
            duration: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: userDietPlans,
      message: 'User diet plans retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user diet plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user diet plans by user ID
export const getUserDietPlansByUserId = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const userDietPlans = await prisma.userDietPlan.findMany({
      where: { userId },
      include: {
        diet: {
          select: {
            id: true,
            name: true,
            calories: true,
            duration: true,
            description: true,
            image: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: userDietPlans,
      message: 'User diet plans retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user diet plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user diet plan by ID
export const getUserDietPlanById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const userDietPlan = await prisma.userDietPlan.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profileImage: true
          }
        },
        diet: {
          select: {
            id: true,
            name: true,
            calories: true,
            duration: true
          }
        }
      }
    });

    if (!userDietPlan) {
      res.status(404).json({
        success: false,
        message: 'User diet plan not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: userDietPlan,
      message: 'User diet plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Assign diet plan to user
export const assignDietPlanToUser = async (req: Request<{}, {}, AssignDietPlanBody>, res: Response): Promise<void> => {
  try {
    const { userId, dietId } = req.body;

    // Validation
    if (!userId || !dietId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Diet ID are required'
      });
      return;
    }

    // Check if user exists
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

    // Check if diet plan exists
    const dietPlan = await prisma.dietPlan.findUnique({
      where: { id: dietId }
    });

    if (!dietPlan) {
      res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
      return;
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userDietPlan.findFirst({
      where: {
        userId,
        dietId
      }
    });

    if (existingAssignment) {
      res.status(409).json({
        success: false,
        message: 'User is already assigned to this diet plan'
      });
      return;
    }

    const userDietPlan = await prisma.userDietPlan.create({
      data: {
        userId,
        dietId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        diet: {
          select: {
            id: true,
            name: true,
            calories: true,
            duration: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: userDietPlan,
      message: 'Diet plan assigned to user successfully'
    });
  } catch (error) {
    console.error('Error assigning diet plan to user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update user diet plan assignment
export const updateUserDietPlan = async (req: Request<{ id: string }, {}, UpdateUserDietPlanBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, dietId } = req.body;

    // Check if assignment exists
    const existingAssignment = await prisma.userDietPlan.findUnique({
      where: { id }
    });

    if (!existingAssignment) {
      res.status(404).json({
        success: false,
        message: 'User diet plan assignment not found'
      });
      return;
    }

    // If updating user or diet, validate they exist
    if (userId) {
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
    }

    if (dietId) {
      const dietPlan = await prisma.dietPlan.findUnique({
        where: { id: dietId }
      });

      if (!dietPlan) {
        res.status(404).json({
          success: false,
          message: 'Diet plan not found'
        });
        return;
      }
    }

    const updateData: Partial<AssignDietPlanBody> = {};
    if (userId !== undefined) updateData.userId = userId;
    if (dietId !== undefined) updateData.dietId = dietId;

    const updatedUserDietPlan = await prisma.userDietPlan.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        diet: {
          select: {
            id: true,
            name: true,
            calories: true,
            duration: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: updatedUserDietPlan,
      message: 'User diet plan assignment updated successfully'
    });
  } catch (error) {
    console.error('Error updating user diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove diet plan assignment from user
export const removeUserDietPlan = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if assignment exists
    const existingAssignment = await prisma.userDietPlan.findUnique({
      where: { id }
    });

    if (!existingAssignment) {
      res.status(404).json({
        success: false,
        message: 'User diet plan assignment not found'
      });
      return;
    }

    await prisma.userDietPlan.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Diet plan assignment removed successfully'
    });
  } catch (error) {
    console.error('Error removing user diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove user from specific diet plan
export const removeUserFromDietPlan = async (req: Request<{ userId: string; dietId: string }>, res: Response): Promise<void> => {
  try {
    const { userId, dietId } = req.params;

    const assignment = await prisma.userDietPlan.findFirst({
      where: {
        userId,
        dietId
      }
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        message: 'User diet plan assignment not found'
      });
      return;
    }

    await prisma.userDietPlan.delete({
      where: { id: assignment.id }
    });

    res.status(200).json({
      success: true,
      message: 'User removed from diet plan successfully'
    });
  } catch (error) {
    console.error('Error removing user from diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get users by diet plan ID
export const getUsersByDietPlanId = async (req: Request<{ dietId: string }>, res: Response): Promise<void> => {
  try {
    const { dietId } = req.params;

    const userDietPlans = await prisma.userDietPlan.findMany({
      where: { dietId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profileImage: true,
            status: true
          }
        }
      }
    });

    const users = userDietPlans.map(udp => udp.user);

    res.status(200).json({
      success: true,
      data: users,
      message: 'Users for diet plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching users by diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};