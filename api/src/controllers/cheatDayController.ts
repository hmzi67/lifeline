import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { getMediaCategory } from '../middleware/upload.js';

// Get all cheat days for a user
export const getUserCheatDays = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const { userId } = req.params;

    if (authUser?.id !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only access your own cheat days' });
      return;
    }

    const cheatDays = await prisma.cheatDay.findMany({
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
        loggedAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: cheatDays,
      message: 'Cheat days retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching cheat days:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get cheat day by ID
export const getCheatDayById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cheatDay = await prisma.cheatDay.findUnique({
      where: { id },
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

    if (!cheatDay) {
      res.status(404).json({
        success: false,
        message: 'Cheat day not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== cheatDay.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only access your own cheat days' });
      return;
    }

    res.status(200).json({
      success: true,
      data: cheatDay,
      message: 'Cheat day retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching cheat day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Calories/macros arrive as numbers (JSON) or strings (multipart with an image).
 * Returns undefined when absent, null when cleared or invalid.
 */
const nutrient = (value: unknown, integer = false): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return integer ? Math.round(parsed) : parsed;
};

// Log a cheat day meal
export const logCheatDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, foodName, image, mealType, portionSize, calories, protein, carbs, fat } = req.body;

    const authUser = (req as AuthenticatedRequest).user;
    if (!userId || authUser?.id !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only log cheat days for yourself' });
      return;
    }

    if (!foodName) {
      res.status(400).json({
        success: false,
        message: 'User ID and food name are required'
      });
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

    // Handle file upload - construct URL from uploaded file
    let imageUrl = image || null;
    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const relativePath = `/uploads/${category}/${req.file.filename}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      imageUrl = `${baseUrl}${relativePath}`;
    }

    const cheatDay = await prisma.cheatDay.create({
      data: {
        userId,
        foodName,
        image: imageUrl,
        mealType: mealType || null,
        portionSize: portionSize || null,
        calories: nutrient(calories, true) ?? null,
        protein: nutrient(protein) ?? null,
        carbs: nutrient(carbs) ?? null,
        fat: nutrient(fat) ?? null,
        loggedAt: new Date()
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

    res.status(201).json({
      success: true,
      data: cheatDay,
      message: 'Cheat day logged successfully'
    });
  } catch (error) {
    console.error('Error logging cheat day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update cheat day
export const updateCheatDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { foodName, image, mealType, portionSize, calories, protein, carbs, fat } = req.body;

    const existingCheatDay = await prisma.cheatDay.findUnique({
      where: { id }
    });

    if (!existingCheatDay) {
      res.status(404).json({
        success: false,
        message: 'Cheat day not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== existingCheatDay.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only update your own cheat days' });
      return;
    }

    // Handle file upload - construct URL from uploaded file
    let imageUrl = image !== undefined ? image : existingCheatDay.image;
    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const relativePath = `/uploads/${category}/${req.file.filename}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      imageUrl = `${baseUrl}${relativePath}`;
    }

    const updateData: any = {};
    if (foodName !== undefined) updateData.foodName = foodName;
    if (imageUrl !== undefined) updateData.image = imageUrl;
    if (mealType !== undefined) updateData.mealType = mealType;
    if (portionSize !== undefined) updateData.portionSize = portionSize;
    for (const [field, value] of Object.entries({ calories: nutrient(calories, true), protein: nutrient(protein), carbs: nutrient(carbs), fat: nutrient(fat) })) {
      if (value !== undefined) updateData[field] = value;
    }

    const cheatDay = await prisma.cheatDay.update({
      where: { id },
      data: updateData,
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

    res.status(200).json({
      success: true,
      data: cheatDay,
      message: 'Cheat day updated successfully'
    });
  } catch (error) {
    console.error('Error updating cheat day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete cheat day
export const deleteCheatDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingCheatDay = await prisma.cheatDay.findUnique({
      where: { id }
    });

    if (!existingCheatDay) {
      res.status(404).json({
        success: false,
        message: 'Cheat day not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== existingCheatDay.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own cheat days' });
      return;
    }

    await prisma.cheatDay.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Cheat day deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cheat day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all cheat days (admin)
export const getAllCheatDays = async (req: Request, res: Response): Promise<void> => {
  try {
    const cheatDays = await prisma.cheatDay.findMany({
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
        loggedAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: cheatDays,
      message: 'All cheat days retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching all cheat days:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
