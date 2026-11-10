import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const meditationLogSchema = z.object({
  meditationId: z.string({ required_error: 'meditationId is required' }).trim().min(1, 'meditationId is required'),
  // Seconds actually listened; a session is at most a few hours.
  durationSeconds: z.coerce.number().int().min(0).max(6 * 60 * 60).optional().nullable(),
  // A meditation added later to a missed day; defaults to now. Up to a week back, never ahead.
  completedAt: z.coerce.date().optional().nullable()
    .refine(date => !date || (date.getTime() <= Date.now() + 60_000 && date.getTime() >= Date.now() - 8 * 86_400_000),
      'completedAt must be within the past week'),
});

const userIdOf = (req: Request) => (req as AuthenticatedRequest).user?.id;

// GET /api/meditation-logs?limit=20 - The caller's finished meditations, newest first
export const getMeditationLogs = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  try {
    const logs = await prisma.userMeditationLog.findMany({
      where: { userId },
      include: { meditation: true },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Get meditation logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch meditation history' });
  }
};

// POST /api/meditation-logs - Record a finished meditation
export const createMeditationLog = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const parsed = meditationLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message ?? 'Invalid meditation log' });
  }

  try {
    const meditation = await prisma.meditation.findUnique({ where: { id: parsed.data.meditationId }, select: { id: true } });
    if (!meditation) return res.status(404).json({ success: false, message: 'Meditation not found' });

    const log = await prisma.userMeditationLog.create({
      data: {
        userId,
        meditationId: meditation.id,
        durationSeconds: parsed.data.durationSeconds ?? null,
        ...(parsed.data.completedAt ? { completedAt: parsed.data.completedAt } : {}),
      },
      include: { meditation: true },
    });
    res.status(201).json({ success: true, data: log, message: 'Meditation recorded' });
  } catch (error) {
    console.error('Create meditation log error:', error);
    res.status(500).json({ success: false, message: 'Failed to record meditation' });
  }
};
