import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

// Get all schedules for a week
export const getExercisePlanSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { weekId } = req.params;

    const schedules = await prisma.exercisePlanSchedule.findMany({
      where: { weekId },
      include: {
        exercise: true,
        week: {
          include: {
            plan: true
          }
        },
        userExerciseProgress: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: schedules,
      message: 'Exercise plan schedules retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise plan schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get schedule by ID
export const getExercisePlanScheduleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const schedule = await prisma.exercisePlanSchedule.findUnique({
      where: { id },
      include: {
        exercise: true,
        week: {
          include: {
            plan: true
          }
        },
        userExerciseProgress: true
      }
    });

    if (!schedule) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan schedule not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: schedule,
      message: 'Exercise plan schedule retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise plan schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create exercise plan schedule
export const createExercisePlanSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { weekId, exerciseId, dayOfWeek, sets, reps, duration, orderIndex } = req.body;

    if (!weekId || !exerciseId || !dayOfWeek) {
      res.status(400).json({
        success: false,
        message: 'Week ID, exercise ID, and day of week are required'
      });
      return;
    }

    // Verify week exists
    const week = await prisma.exercisePlanWeek.findUnique({
      where: { id: weekId }
    });

    if (!week) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan week not found'
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

    const schedule = await prisma.exercisePlanSchedule.create({
      data: {
        weekId,
        exerciseId,
        dayOfWeek,
        sets: sets || null,
        reps: reps || null,
        duration: duration || null,
        orderIndex: orderIndex || null,
        completed: false
      },
      include: {
        exercise: true,
        week: true
      }
    });

    res.status(201).json({
      success: true,
      data: schedule,
      message: 'Exercise plan schedule created successfully'
    });
  } catch (error) {
    console.error('Error creating exercise plan schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update exercise plan schedule
export const updateExercisePlanSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { exerciseId, dayOfWeek, sets, reps, duration, orderIndex, completed } = req.body;

    const existingSchedule = await prisma.exercisePlanSchedule.findUnique({
      where: { id }
    });

    if (!existingSchedule) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan schedule not found'
      });
      return;
    }

    const updateData: any = {};
    if (exerciseId !== undefined) updateData.exerciseId = exerciseId;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (sets !== undefined) updateData.sets = sets;
    if (reps !== undefined) updateData.reps = reps;
    if (duration !== undefined) updateData.duration = duration;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (completed !== undefined) updateData.completed = completed;

    const schedule = await prisma.exercisePlanSchedule.update({
      where: { id },
      data: updateData,
      include: {
        exercise: true,
        week: true
      }
    });

    res.status(200).json({
      success: true,
      data: schedule,
      message: 'Exercise plan schedule updated successfully'
    });
  } catch (error) {
    console.error('Error updating exercise plan schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete exercise plan schedule
export const deleteExercisePlanSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingSchedule = await prisma.exercisePlanSchedule.findUnique({
      where: { id }
    });

    if (!existingSchedule) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan schedule not found'
      });
      return;
    }

    await prisma.exercisePlanSchedule.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Exercise plan schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise plan schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
