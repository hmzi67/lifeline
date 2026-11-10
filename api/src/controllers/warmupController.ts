import { prisma } from '../config/database.js';
import { Request, Response } from 'express';

const DEFAULT_AUDIO_URL = 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3';
const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80';

export const getWarmupExercises = async (_req: Request, res: Response): Promise<void> => {
  try {
    const exercises = await prisma.exercise.findMany({
      where: {
        purpose: {
          contains: 'warm',
          mode: 'insensitive',
        },
      },
      include: {
        exerciseDetails: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: exercises,
      message: 'Warm-up exercises retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching warm-up exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load warm-up exercises',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getWarmupSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, meditationId } = req.query as { sessionId?: string; meditationId?: string };

    let session = null;

    if (sessionId) {
      session = await prisma.meditationSession.findUnique({
        where: { id: sessionId },
        include: { meditation: true },
      });
    } else if (meditationId) {
      session = await prisma.meditationSession.findFirst({
        where: { meditationId },
        include: { meditation: true },
        orderBy: { durationMinutes: 'asc' },
      });
    } else {
      session = await prisma.meditationSession.findFirst({
        where: {
          OR: [{ soundUrl: { not: null } }, { meditation: { soundUrl: { not: null } } }],
        },
        include: { meditation: true },
        orderBy: { durationMinutes: 'asc' },
      });
    }

    const durationSeconds = Math.max(30, (session?.durationMinutes || 1) * 60);

    const payload = {
      id: session?.id || null,
      meditationId: session?.meditationId || null,
      title: session?.meditation?.name || 'Recovery Run',
      description:
        session?.meditation?.description ||
        'Having a structured plan is crucial to fitness. Stay focused and complete your session.',
      imageUrl: session?.image || session?.meditation?.image || DEFAULT_IMAGE_URL,
      audioUrl: session?.soundUrl || session?.meditation?.soundUrl || DEFAULT_AUDIO_URL,
      durationSeconds,
      warmupSeconds: 10,
      difficulty: session?.difficulty || 'beginner',
    };

    res.status(200).json({
      success: true,
      message: 'Warmup session retrieved successfully',
      data: payload,
    });
  } catch (error) {
    console.error('Error fetching warmup session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load warmup session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
