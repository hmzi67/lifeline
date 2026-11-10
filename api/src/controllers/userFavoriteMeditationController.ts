import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const prisma = new PrismaClient();

// Get user's favorite meditations
export const getUserFavoriteMeditations = async (req: Request, res: Response): Promise<void> => {
  try {
    const authenticatedUser = (req as AuthenticatedRequest).user;
    if (!authenticatedUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userId = req.params.userId || authenticatedUser.id;
    if (userId !== authenticatedUser.id && authenticatedUser.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'You can only access your own favorite meditations'
      });
      return;
    }

    const favorites = await prisma.userFavoriteMeditation.findMany({
      where: { userId },
      select: {
        id: true,
        sessionId: true,
        favoritedAt: true,
        session: {
          include: {
            meditation: true
          }
        }
      },
      orderBy: {
        favoritedAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: favorites,
      message: 'Favorite meditations retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching favorite meditations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Add meditation to favorites
export const addFavoriteMeditation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Support both meditationId (from frontend) and sessionId (legacy)
    const { meditationId, sessionId: bodySessionId } = req.body;
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    let resolvedSessionId = bodySessionId;

    // If meditationId is provided, resolve an existing admin-managed session.
    // A consumer action must never create or modify catalog content.
    if (!resolvedSessionId && meditationId) {
      const meditation = await prisma.meditation.findUnique({ where: { id: meditationId } });
      if (!meditation) {
        res.status(404).json({ success: false, message: 'Meditation not found' });
        return;
      }
      const session = await prisma.meditationSession.findFirst({ where: { meditationId } });
      if (!session) {
        res.status(404).json({ success: false, message: 'No meditation session is available' });
        return;
      }
      resolvedSessionId = session.id;
    }

    if (!resolvedSessionId) {
      res.status(400).json({
        success: false,
        message: 'Either meditationId or sessionId is required'
      });
      return;
    }

    // Verify session exists
    const session = await prisma.meditationSession.findUnique({
      where: { id: resolvedSessionId }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Meditation session not found'
      });
      return;
    }

    // Check if already favorited
    const existingFavorite = await prisma.userFavoriteMeditation.findFirst({
      where: {
        userId,
        sessionId: resolvedSessionId
      }
    });

    if (existingFavorite) {
      res.status(400).json({
        success: false,
        message: 'Meditation is already in favorites'
      });
      return;
    }

    const favorite = await prisma.userFavoriteMeditation.create({
      data: {
        userId,
        sessionId: resolvedSessionId,
        favoritedAt: new Date()
      },
      select: {
        id: true,
        sessionId: true,
        favoritedAt: true,
        session: {
          include: {
            meditation: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: favorite,
      message: 'Meditation added to favorites successfully'
    });
  } catch (error) {
    console.error('Error adding favorite meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove meditation from favorites
export const removeFavoriteMeditation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as AuthenticatedRequest).user;
    if (!authenticatedUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const existingFavorite = await prisma.userFavoriteMeditation.findUnique({
      where: { id },
      select: { id: true, userId: true }
    });

    if (!existingFavorite) {
      res.status(404).json({
        success: false,
        message: 'Favorite meditation not found'
      });
      return;
    }

    if (existingFavorite.userId !== authenticatedUser.id && authenticatedUser.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'You can only remove your own favorite meditations'
      });
      return;
    }

    await prisma.userFavoriteMeditation.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Meditation removed from favorites successfully'
    });
  } catch (error) {
    console.error('Error removing favorite meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Check if meditation is favorited
export const checkFavoriteMeditation = async (req: Request, res: Response): Promise<void> => {
  try {
    const authenticatedUser = (req as AuthenticatedRequest).user;
    if (!authenticatedUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userId = req.params.userId || authenticatedUser.id;
    const { sessionId } = req.params;
    if (userId !== authenticatedUser.id && authenticatedUser.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'You can only check your own favorite meditations'
      });
      return;
    }

    if (!sessionId) {
      res.status(400).json({
        success: false,
        message: 'Meditation session ID is required'
      });
      return;
    }

    const favorite = await prisma.userFavoriteMeditation.findFirst({
      where: {
        userId,
        sessionId
      },
      select: {
        id: true,
        sessionId: true,
        favoritedAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: {
        isFavorited: !!favorite,
        favorite: favorite || null
      },
      message: 'Favorite status retrieved successfully'
    });
  } catch (error) {
    console.error('Error checking favorite meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
