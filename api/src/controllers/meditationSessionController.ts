import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all meditation sessions for a meditation
export const getMeditationSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meditationId } = req.params;

    const sessions = await prisma.meditationSession.findMany({
      where: { meditationId },
      include: {
        meditation: true
      }
    });

    res.status(200).json({
      success: true,
      data: sessions,
      message: 'Meditation sessions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching meditation sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get meditation session by ID
export const getMeditationSessionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const session = await prisma.meditationSession.findUnique({
      where: { id },
      include: {
        meditation: true
      }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Meditation session not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: session,
      message: 'Meditation session retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching meditation session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create meditation session
export const createMeditationSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meditationId, durationMinutes, image, soundUrl, difficulty } = req.body;

    if (!meditationId) {
      res.status(400).json({
        success: false,
        message: 'Meditation ID is required'
      });
      return;
    }

    // Verify meditation exists
    const meditation = await prisma.meditation.findUnique({
      where: { id: meditationId }
    });

    if (!meditation) {
      res.status(404).json({
        success: false,
        message: 'Meditation not found'
      });
      return;
    }

    const session = await prisma.meditationSession.create({
      data: {
        meditationId,
        durationMinutes: durationMinutes || null,
        image: image || null,
        soundUrl: soundUrl || null,
        difficulty: difficulty || null
      },
      include: {
        meditation: true
      }
    });

    res.status(201).json({
      success: true,
      data: session,
      message: 'Meditation session created successfully'
    });
  } catch (error) {
    console.error('Error creating meditation session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update meditation session
export const updateMeditationSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { durationMinutes, image, soundUrl, difficulty } = req.body;

    const existingSession = await prisma.meditationSession.findUnique({
      where: { id }
    });

    if (!existingSession) {
      res.status(404).json({
        success: false,
        message: 'Meditation session not found'
      });
      return;
    }

    const updateData: any = {};
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (image !== undefined) updateData.image = image;
    if (soundUrl !== undefined) updateData.soundUrl = soundUrl;
    if (difficulty !== undefined) updateData.difficulty = difficulty;

    const session = await prisma.meditationSession.update({
      where: { id },
      data: updateData,
      include: {
        meditation: true
      }
    });

    res.status(200).json({
      success: true,
      data: session,
      message: 'Meditation session updated successfully'
    });
  } catch (error) {
    console.error('Error updating meditation session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete meditation session
export const deleteMeditationSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingSession = await prisma.meditationSession.findUnique({
      where: { id }
    });

    if (!existingSession) {
      res.status(404).json({
        success: false,
        message: 'Meditation session not found'
      });
      return;
    }

    await prisma.meditationSession.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Meditation session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meditation session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
