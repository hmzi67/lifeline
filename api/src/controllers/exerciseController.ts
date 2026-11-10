import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

interface ExerciseQuery {
  query?: string;
  purpose?: string;
  duration?: string;
}

interface CreateExerciseBody {
  name: string;
  purpose?: string;
  description?: string;
  image?: string;
  duration?: string;
  videoUrl?: string;
  difficulty?: string;
  caloriesBurnEstimate?: number;
}

interface UpdateExerciseBody {
  name?: string;
  purpose?: string;
  description?: string;
  image?: string;
  duration?: string;
  videoUrl?: string;
  difficulty?: string;
  caloriesBurnEstimate?: number;
}

// Get all exercises
export const getAllExercises = async (req: Request, res: Response): Promise<void> => {
  try {
    const exercises = await prisma.exercise.findMany({
      include: {
        userExercises: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        },
        challengeExercises: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: exercises,
      message: 'Exercises retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get exercise by ID
export const getExerciseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      include: {
        exerciseDetails: true,
        userExercises: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        },
        challengeExercises: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!exercise) {
      res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: exercise,
      message: 'Exercise retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create new exercise
export const createExercise = async (req: Request<{}, {}, CreateExerciseBody>, res: Response): Promise<void> => {
  try {
    const { name, purpose, description, image, duration, videoUrl, difficulty, caloriesBurnEstimate } = req.body;

    // Validation
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Exercise name is required'
      });
      return;
    }

    const exercise = await prisma.exercise.create({
      data: {
        name,
        purpose: purpose || null,
        description: description || null,
        image: image || null,
        duration: duration || null,
        videoUrl: videoUrl || null,
        difficulty: difficulty || null,
        caloriesBurnEstimate: caloriesBurnEstimate || null
      }
    });

    res.status(201).json({
      success: true,
      data: exercise,
      message: 'Exercise created successfully'
    });
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update exercise
export const updateExercise = async (req: Request<{ id: string }, {}, UpdateExerciseBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, purpose, description, image, duration, videoUrl, difficulty, caloriesBurnEstimate } = req.body;

    // Check if exercise exists
    const existingExercise = await prisma.exercise.findUnique({
      where: { id }
    });

    if (!existingExercise) {
      res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
      return;
    }

    const updateData: Partial<CreateExerciseBody> = {};
    if (name !== undefined) updateData.name = name;
    if (purpose !== undefined) updateData.purpose = purpose;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (duration !== undefined) updateData.duration = duration;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (caloriesBurnEstimate !== undefined) updateData.caloriesBurnEstimate = caloriesBurnEstimate;

    const updatedExercise = await prisma.exercise.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: updatedExercise,
      message: 'Exercise updated successfully'
    });
  } catch (error) {
    console.error('Error updating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete exercise
export const deleteExercise = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if exercise exists
    const existingExercise = await prisma.exercise.findUnique({
      where: { id }
    });

    if (!existingExercise) {
      res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
      return;
    }

    await prisma.exercise.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Search exercises
export const searchExercises = async (req: Request<{}, {}, {}, ExerciseQuery>, res: Response): Promise<void> => {
  try {
    const { query, purpose, duration } = req.query;

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (purpose) {
      whereClause.purpose = {
        contains: purpose,
        mode: 'insensitive'
      };
    }

    if (duration) {
      whereClause.duration = duration;
    }

    const exercises = await prisma.exercise.findMany({
      where: whereClause,
      include: {
        userExercises: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: exercises,
      message: 'Exercise search completed successfully'
    });
  } catch (error) {
    console.error('Error searching exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get exercises by purpose
export const getExercisesByPurpose = async (req: Request<{ purpose: string }>, res: Response): Promise<void> => {
  try {
    const { purpose } = req.params;

    const exercises = await prisma.exercise.findMany({
      where: {
        purpose: {
          contains: purpose,
          mode: 'insensitive'
        }
      },
      include: {
        userExercises: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: exercises,
      message: `Exercises for purpose '${purpose}' retrieved successfully`
    });
  } catch (error) {
    console.error('Error fetching exercises by purpose:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};