import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

// Get all weeks for an exercise plan
export const getExercisePlanWeeks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    const weeks = await prisma.exercisePlanWeek.findMany({
      where: { planId },
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
    });

    res.status(200).json({
      success: true,
      data: weeks,
      message: 'Exercise plan weeks retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise plan weeks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get week by ID
export const getExercisePlanWeekById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const week = await prisma.exercisePlanWeek.findUnique({
      where: { id },
      include: {
        plan: true,
        exercisePlanSchedule: {
          include: {
            exercise: true
          },
          orderBy: {
            orderIndex: 'asc'
          }
        }
      }
    });

    if (!week) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan week not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: week,
      message: 'Exercise plan week retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching exercise plan week:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create exercise plan week
export const createExercisePlanWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId, weekNumber } = req.body;

    if (!planId || !weekNumber) {
      res.status(400).json({
        success: false,
        message: 'Plan ID and week number are required'
      });
      return;
    }

    // Verify plan exists
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

    const week = await prisma.exercisePlanWeek.create({
      data: {
        planId,
        weekNumber
      },
      include: {
        exercisePlanSchedule: true
      }
    });

    res.status(201).json({
      success: true,
      data: week,
      message: 'Exercise plan week created successfully'
    });
  } catch (error) {
    console.error('Error creating exercise plan week:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update exercise plan week
export const updateExercisePlanWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { weekNumber } = req.body;

    const existingWeek = await prisma.exercisePlanWeek.findUnique({
      where: { id }
    });

    if (!existingWeek) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan week not found'
      });
      return;
    }

    const week = await prisma.exercisePlanWeek.update({
      where: { id },
      data: { weekNumber },
      include: {
        exercisePlanSchedule: true
      }
    });

    res.status(200).json({
      success: true,
      data: week,
      message: 'Exercise plan week updated successfully'
    });
  } catch (error) {
    console.error('Error updating exercise plan week:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete exercise plan week
export const deleteExercisePlanWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingWeek = await prisma.exercisePlanWeek.findUnique({
      where: { id }
    });

    if (!existingWeek) {
      res.status(404).json({
        success: false,
        message: 'Exercise plan week not found'
      });
      return;
    }

    await prisma.exercisePlanWeek.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Exercise plan week deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise plan week:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
