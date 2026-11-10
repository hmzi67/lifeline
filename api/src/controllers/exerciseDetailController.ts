import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

// Get all exercise details for an exercise
export const getExerciseDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exerciseId } = req.params;

    const details = await prisma.exerciseDetail.findMany({
      where: { exerciseId },
      include: {
        exercise: true
      }
    });

    res.status(200).json({
      success: true,
      data: details,
      message: 'Exercise details retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get exercise detail by ID
export const getExerciseDetailById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const detail = await prisma.exerciseDetail.findUnique({
      where: { id },
      include: {
        exercise: true
      }
    });

    if (!detail) {
      res.status(404).json({
        success: false,
        message: 'Exercise detail not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Exercise detail retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create exercise detail
export const createExerciseDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exerciseId, sets, reps, calories, timeRequired, mediaUrl, instructions } = req.body;

    if (!exerciseId) {
      res.status(400).json({
        success: false,
        message: 'Exercise ID is required'
      });
      return;
    }

    // Verify exercise exists
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

    const detail = await prisma.exerciseDetail.create({
      data: {
        exerciseId,
        sets: sets || null,
        reps: reps || null,
        calories: calories || null,
        timeRequired: timeRequired || null,
        mediaUrl: mediaUrl || null,
        instructions: instructions || null
      },
      include: {
        exercise: true
      }
    });

    res.status(201).json({
      success: true,
      data: detail,
      message: 'Exercise detail created successfully'
    });
  } catch (error) {
    console.error('Error creating exercise detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update exercise detail
export const updateExerciseDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { sets, reps, calories, timeRequired, mediaUrl, instructions } = req.body;

    const existingDetail = await prisma.exerciseDetail.findUnique({
      where: { id }
    });

    if (!existingDetail) {
      res.status(404).json({
        success: false,
        message: 'Exercise detail not found'
      });
      return;
    }

    const updateData: any = {};
    if (sets !== undefined) updateData.sets = sets;
    if (reps !== undefined) updateData.reps = reps;
    if (calories !== undefined) updateData.calories = calories;
    if (timeRequired !== undefined) updateData.timeRequired = timeRequired;
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
    if (instructions !== undefined) updateData.instructions = instructions;

    const detail = await prisma.exerciseDetail.update({
      where: { id },
      data: updateData,
      include: {
        exercise: true
      }
    });

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Exercise detail updated successfully'
    });
  } catch (error) {
    console.error('Error updating exercise detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete exercise detail
export const deleteExerciseDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingDetail = await prisma.exerciseDetail.findUnique({
      where: { id }
    });

    if (!existingDetail) {
      res.status(404).json({
        success: false,
        message: 'Exercise detail not found'
      });
      return;
    }

    await prisma.exerciseDetail.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Exercise detail deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
