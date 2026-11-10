import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

interface AssignExerciseBody {
  userId: string;
  exerciseId: string;
}

interface UpdateUserExerciseBody {
  userId?: string;
  exerciseId?: string;
}

// Get all user exercises
export const getAllUserExercises = async (req: Request, res: Response): Promise<void> => {
  try {
    const userExercises = await prisma.userExercise.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profileImage: true
          }
        },
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            description: true,
            duration: true,
            image: true,
            videoUrl: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: userExercises,
      message: 'User exercises retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user exercises by user ID
export const getUserExercisesByUserId = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const userExercises = await prisma.userExercise.findMany({
      where: { userId },
      include: {
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            description: true,
            duration: true,
            image: true,
            videoUrl: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: userExercises,
      message: 'User exercises retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user exercise by ID
export const getUserExerciseById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const userExercise = await prisma.userExercise.findUnique({
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
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            description: true,
            duration: true,
            image: true,
            videoUrl: true
          }
        }
      }
    });

    if (!userExercise) {
      res.status(404).json({
        success: false,
        message: 'User exercise not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: userExercise,
      message: 'User exercise retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Assign exercise to user
export const assignExerciseToUser = async (req: Request<{}, {}, AssignExerciseBody>, res: Response): Promise<void> => {
  try {
    const { userId, exerciseId } = req.body;

    // Validation
    if (!userId || !exerciseId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Exercise ID are required'
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

    // Check if exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId }
    });

    if (!exercise) {
      res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
      return;
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userExercise.findFirst({
      where: {
        userId,
        exerciseId
      }
    });

    if (existingAssignment) {
      res.status(409).json({
        success: false,
        message: 'User is already assigned to this exercise'
      });
      return;
    }

    const userExercise = await prisma.userExercise.create({
      data: {
        userId,
        exerciseId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            duration: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: userExercise,
      message: 'Exercise assigned to user successfully'
    });
  } catch (error) {
    console.error('Error assigning exercise to user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update user exercise assignment
export const updateUserExercise = async (req: Request<{ id: string }, {}, UpdateUserExerciseBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, exerciseId } = req.body;

    // Check if assignment exists
    const existingAssignment = await prisma.userExercise.findUnique({
      where: { id }
    });

    if (!existingAssignment) {
      res.status(404).json({
        success: false,
        message: 'User exercise assignment not found'
      });
      return;
    }

    // If updating user or exercise, validate they exist
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

    if (exerciseId) {
      const exercise = await prisma.exercise.findUnique({
        where: { id: exerciseId }
      });

      if (!exercise) {
        res.status(404).json({
          success: false,
          message: 'Exercise not found'
        });
        return;
      }
    }

    const updateData: Partial<AssignExerciseBody> = {};
    if (userId !== undefined) updateData.userId = userId;
    if (exerciseId !== undefined) updateData.exerciseId = exerciseId;

    const updatedUserExercise = await prisma.userExercise.update({
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
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            duration: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: updatedUserExercise,
      message: 'User exercise assignment updated successfully'
    });
  } catch (error) {
    console.error('Error updating user exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove exercise assignment from user
export const removeUserExercise = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if assignment exists
    const existingAssignment = await prisma.userExercise.findUnique({
      where: { id }
    });

    if (!existingAssignment) {
      res.status(404).json({
        success: false,
        message: 'User exercise assignment not found'
      });
      return;
    }

    await prisma.userExercise.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Exercise assignment removed successfully'
    });
  } catch (error) {
    console.error('Error removing user exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove user from specific exercise
export const removeUserFromExercise = async (req: Request<{ userId: string; exerciseId: string }>, res: Response): Promise<void> => {
  try {
    const { userId, exerciseId } = req.params;

    const assignment = await prisma.userExercise.findFirst({
      where: {
        userId,
        exerciseId
      }
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        message: 'User exercise assignment not found'
      });
      return;
    }

    await prisma.userExercise.delete({
      where: { id: assignment.id }
    });

    res.status(200).json({
      success: true,
      message: 'User removed from exercise successfully'
    });
  } catch (error) {
    console.error('Error removing user from exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get users by exercise ID
export const getUsersByExerciseId = async (req: Request<{ exerciseId: string }>, res: Response): Promise<void> => {
  try {
    const { exerciseId } = req.params;

    const userExercises = await prisma.userExercise.findMany({
      where: { exerciseId },
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

    const users = userExercises.map(ue => ue.user);

    res.status(200).json({
      success: true,
      data: users,
      message: 'Users for exercise retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching users by exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get exercises by user ID with purpose filter
export const getUserExercisesByPurpose = async (req: Request<{ userId: string; purpose: string }>, res: Response): Promise<void> => {
  try {
    const { userId, purpose } = req.params;

    const userExercises = await prisma.userExercise.findMany({
      where: {
        userId,
        exercise: {
          purpose: {
            contains: purpose,
            mode: 'insensitive'
          }
        }
      },
      include: {
        exercise: {
          select: {
            id: true,
            name: true,
            purpose: true,
            description: true,
            duration: true,
            image: true,
            videoUrl: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: userExercises,
      message: `User exercises for purpose '${purpose}' retrieved successfully`
    });
  } catch (error) {
    console.error('Error fetching user exercises by purpose:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};