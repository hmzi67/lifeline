import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

// Get all meal types
export const getAllMealTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const mealTypes = await prisma.mealType.findMany({
      include: {
        dietPlanMeals: {
          select: {
            id: true,
            name: true,
            calories: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: mealTypes,
      message: 'Meal types retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching meal types:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get meal type by ID
export const getMealTypeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const mealType = await prisma.mealType.findUnique({
      where: { id },
      include: {
        dietPlanMeals: true
      }
    });

    if (!mealType) {
      res.status(404).json({
        success: false,
        message: 'Meal type not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: mealType,
      message: 'Meal type retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching meal type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create meal type
export const createMealType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Meal type name is required'
      });
      return;
    }

    const mealType = await prisma.mealType.create({
      data: { name }
    });

    res.status(201).json({
      success: true,
      data: mealType,
      message: 'Meal type created successfully'
    });
  } catch (error) {
    console.error('Error creating meal type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update meal type
export const updateMealType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const existingMealType = await prisma.mealType.findUnique({
      where: { id }
    });

    if (!existingMealType) {
      res.status(404).json({
        success: false,
        message: 'Meal type not found'
      });
      return;
    }

    const mealType = await prisma.mealType.update({
      where: { id },
      data: { name }
    });

    res.status(200).json({
      success: true,
      data: mealType,
      message: 'Meal type updated successfully'
    });
  } catch (error) {
    console.error('Error updating meal type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete meal type
export const deleteMealType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingMealType = await prisma.mealType.findUnique({
      where: { id }
    });

    if (!existingMealType) {
      res.status(404).json({
        success: false,
        message: 'Meal type not found'
      });
      return;
    }

    await prisma.mealType.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Meal type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meal type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
