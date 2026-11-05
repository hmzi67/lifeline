import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all meals for a specific day
export const getDietPlanMeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dayId } = req.params;

    const meals = await prisma.dietPlanMeal.findMany({
      where: { dayId },
      include: {
        mealType: true,
        day: {
          include: {
            diet: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: meals,
      message: 'Diet plan meals retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plan meals:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get meal by ID
export const getDietPlanMealById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const meal = await prisma.dietPlanMeal.findUnique({
      where: { id },
      include: {
        mealType: true,
        day: {
          include: {
            diet: true
          }
        }
      }
    });

    if (!meal) {
      res.status(404).json({
        success: false,
        message: 'Diet plan meal not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: meal,
      message: 'Diet plan meal retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plan meal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create diet plan meal
export const createDietPlanMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dayId, mealTypeId, name, calories, portionSize, image, recipe } = req.body;

    if (!dayId || !mealTypeId || !name) {
      res.status(400).json({
        success: false,
        message: 'Day ID, meal type ID, and name are required'
      });
      return;
    }

    // Column limits from schema.prisma; reject here instead of failing in the database.
    if (String(name).length > 100) {
      res.status(400).json({ success: false, message: 'Meal name must be 100 characters or fewer' });
      return;
    }
    if (portionSize && String(portionSize).length > 150) {
      res.status(400).json({ success: false, message: 'Portion size must be 150 characters or fewer' });
      return;
    }

    // Verify day exists
    const day = await prisma.dietPlanDay.findUnique({
      where: { id: dayId }
    });

    if (!day) {
      res.status(404).json({
        success: false,
        message: 'Diet plan day not found'
      });
      return;
    }

    // Verify meal type exists
    const mealType = await prisma.mealType.findUnique({
      where: { id: mealTypeId }
    });

    if (!mealType) {
      res.status(404).json({
        success: false,
        message: 'Meal type not found'
      });
      return;
    }

    const meal = await prisma.dietPlanMeal.create({
      data: {
        dayId,
        mealTypeId,
        name,
        calories: calories || null,
        portionSize: portionSize || null,
        image: image || null,
        recipe: recipe || null
      },
      include: {
        mealType: true,
        day: true
      }
    });

    res.status(201).json({
      success: true,
      data: meal,
      message: 'Diet plan meal created successfully'
    });
  } catch (error) {
    console.error('Error creating diet plan meal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update diet plan meal
export const updateDietPlanMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { mealTypeId, name, calories, portionSize, image, recipe } = req.body;

    const existingMeal = await prisma.dietPlanMeal.findUnique({
      where: { id }
    });

    if (!existingMeal) {
      res.status(404).json({
        success: false,
        message: 'Diet plan meal not found'
      });
      return;
    }

    const updateData: any = {};
    if (mealTypeId !== undefined) updateData.mealTypeId = mealTypeId;
    if (name !== undefined) updateData.name = name;
    if (calories !== undefined) updateData.calories = calories;
    if (portionSize !== undefined) updateData.portionSize = portionSize;
    if (image !== undefined) updateData.image = image;
    if (recipe !== undefined) updateData.recipe = recipe;

    const meal = await prisma.dietPlanMeal.update({
      where: { id },
      data: updateData,
      include: {
        mealType: true,
        day: true
      }
    });

    res.status(200).json({
      success: true,
      data: meal,
      message: 'Diet plan meal updated successfully'
    });
  } catch (error) {
    console.error('Error updating diet plan meal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete diet plan meal
export const deleteDietPlanMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingMeal = await prisma.dietPlanMeal.findUnique({
      where: { id }
    });

    if (!existingMeal) {
      res.status(404).json({
        success: false,
        message: 'Diet plan meal not found'
      });
      return;
    }

    await prisma.dietPlanMeal.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Diet plan meal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting diet plan meal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
