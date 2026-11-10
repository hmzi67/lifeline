import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

// Get all days for a diet plan
export const getDietPlanDays = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dietId } = req.params;

    const days = await prisma.dietPlanDay.findMany({
      where: { dietId },
      include: {
        dietPlanMeals: {
          include: {
            mealType: true
          }
        }
      },
      orderBy: { dayNumber: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: days,
      message: 'Diet plan days retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plan days:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get single day by ID
export const getDietPlanDayById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const day = await prisma.dietPlanDay.findUnique({
      where: { id },
      include: {
        diet: true,
        dietPlanMeals: {
          include: {
            mealType: true
          }
        }
      }
    });

    if (!day) {
      res.status(404).json({
        success: false,
        message: 'Diet plan day not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: day,
      message: 'Diet plan day retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plan day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create diet plan day
export const createDietPlanDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dietId, dayNumber, notes } = req.body;

    if (!dietId || !dayNumber) {
      res.status(400).json({
        success: false,
        message: 'Diet ID and day number are required'
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

    const day = await prisma.dietPlanDay.create({
      data: {
        dietId,
        dayNumber,
        notes: notes || null
      },
      include: {
        dietPlanMeals: true
      }
    });

    res.status(201).json({
      success: true,
      data: day,
      message: 'Diet plan day created successfully'
    });
  } catch (error) {
    console.error('Error creating diet plan day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update diet plan day
export const updateDietPlanDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dayNumber, notes } = req.body;

    const existingDay = await prisma.dietPlanDay.findUnique({
      where: { id }
    });

    if (!existingDay) {
      res.status(404).json({
        success: false,
        message: 'Diet plan day not found'
      });
      return;
    }

    const updateData: any = {};
    if (dayNumber !== undefined) updateData.dayNumber = dayNumber;
    if (notes !== undefined) updateData.notes = notes;

    const day = await prisma.dietPlanDay.update({
      where: { id },
      data: updateData,
      include: {
        dietPlanMeals: true
      }
    });

    res.status(200).json({
      success: true,
      data: day,
      message: 'Diet plan day updated successfully'
    });
  } catch (error) {
    console.error('Error updating diet plan day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete diet plan day
export const deleteDietPlanDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingDay = await prisma.dietPlanDay.findUnique({
      where: { id }
    });

    if (!existingDay) {
      res.status(404).json({
        success: false,
        message: 'Diet plan day not found'
      });
      return;
    }

    await prisma.dietPlanDay.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Diet plan day deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting diet plan day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
