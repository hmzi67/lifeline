import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

/** Minutes, from the admin form: a whole number 1-600, or null to clear. undefined when not sent. */
const parseDuration = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error('Duration must be a whole number of minutes between 1 and 600');
  return minutes;
};

const optionalText = (value: unknown): string | null | undefined =>
  value === undefined ? undefined : typeof value === 'string' && value.trim() ? value.trim() : null;

// The app shows a meditation's length and favourites it through its sessions; expose the
// shortest session's length as `duration` so lists don't need the sessions themselves.
const SESSION_SUMMARY = { meditationSessions: { select: { id: true, durationMinutes: true }, orderBy: { durationMinutes: 'asc' as const } } };
const withDuration = <T extends { meditationSessions?: { durationMinutes: number | null }[] }>({ meditationSessions, ...meditation }: T) => ({
  ...meditation,
  duration: meditationSessions?.find(session => session.durationMinutes != null)?.durationMinutes ?? null,
});

export const createMeditation = async (req: Request, res: Response) => {
  try {
    const { name, type, soundUrl } = req.body;

    if (!name || !type || !soundUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and soundUrl are required'
      });
    }

    let durationMinutes: number | null | undefined;
    try {
      durationMinutes = parseDuration(req.body.durationMinutes);
    } catch (e) {
      return res.status(400).json({ success: false, message: (e as Error).message });
    }

    // Favourites and the player work through a session, so every meditation gets one.
    const meditation = await prisma.meditation.create({
      data: {
        name,
        type,
        soundUrl,
        description: optionalText(req.body.description) ?? null,
        image: optionalText(req.body.image) ?? null,
        meditationSessions: { create: { durationMinutes: durationMinutes ?? null } },
      },
      include: SESSION_SUMMARY,
    });

    res.status(201).json({
      success: true,
      data: withDuration(meditation),
      message: 'Meditation created successfully'
    });
  } catch (error) {
    console.error('Error creating meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create meditation'
    });
  }
};

export const getMeditations = async (req: Request, res: Response) => {
  try {
    const { type, limit, offset } = req.query;

    const where = type ? { type: type as string } : {};
    const take = limit ? parseInt(limit as string) : undefined;
    const skip = offset ? parseInt(offset as string) : undefined;

    const meditations = await prisma.meditation.findMany({
      where,
      take,
      skip,
      orderBy: {
        name: 'asc'
      },
      include: SESSION_SUMMARY,
    });

    const total = await prisma.meditation.count({ where });

    res.json({
      success: true,
      data: meditations.map(withDuration),
      count: meditations.length,
      total
    });
  } catch (error) {
    console.error('Error fetching meditations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meditations'
    });
  }
};

export const getMeditationsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const meditations = await prisma.meditation.findMany({
      where: {
        type
      },
      orderBy: {
        name: 'asc'
      },
      include: SESSION_SUMMARY,
    });

    res.json({
      success: true,
      data: meditations.map(withDuration),
      count: meditations.length
    });
  } catch (error) {
    console.error('Error fetching meditations by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meditations by type'
    });
  }
};

export const getMeditationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const meditation = await prisma.meditation.findUnique({
      where: { id },
      include: SESSION_SUMMARY,
    });

    if (!meditation) {
      return res.status(404).json({
        success: false,
        message: 'Meditation not found'
      });
    }

    res.json({
      success: true,
      data: withDuration(meditation)
    });
  } catch (error) {
    console.error('Error fetching meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meditation'
    });
  }
};

export const updateMeditation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, soundUrl } = req.body;

    let durationMinutes: number | null | undefined;
    try {
      durationMinutes = parseDuration(req.body.durationMinutes);
    } catch (e) {
      return res.status(400).json({ success: false, message: (e as Error).message });
    }

    // Check if meditation exists
    const existingMeditation = await prisma.meditation.findUnique({
      where: { id }
    });

    if (!existingMeditation) {
      return res.status(404).json({
        success: false,
        message: 'Meditation not found'
      });
    }

    const description = optionalText(req.body.description);
    const image = optionalText(req.body.image);
    const meditation = await prisma.$transaction(async tx => {
      await tx.meditation.update({
        where: { id },
        data: {
          name: name || existingMeditation.name,
          type: type || existingMeditation.type,
          soundUrl: soundUrl || existingMeditation.soundUrl,
          ...(description !== undefined ? { description } : {}),
          ...(image !== undefined ? { image } : {}),
        }
      });
      // The length lives on the session; one is created if the meditation never had any.
      const session = await tx.meditationSession.findFirst({ where: { meditationId: id }, orderBy: { durationMinutes: 'asc' } });
      if (!session) {
        await tx.meditationSession.create({ data: { meditationId: id, durationMinutes: durationMinutes ?? null } });
      } else if (durationMinutes !== undefined) {
        await tx.meditationSession.update({ where: { id: session.id }, data: { durationMinutes } });
      }
      return tx.meditation.findUniqueOrThrow({ where: { id }, include: SESSION_SUMMARY });
    });

    res.json({
      success: true,
      data: withDuration(meditation),
      message: 'Meditation updated successfully'
    });
  } catch (error) {
    console.error('Error updating meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update meditation'
    });
  }
};

export const deleteMeditation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if meditation exists
    const existingMeditation = await prisma.meditation.findUnique({
      where: { id }
    });

    if (!existingMeditation) {
      return res.status(404).json({
        success: false,
        message: 'Meditation not found'
      });
    }

    // Check if meditation is being used in user daily routines
    const usageCount = await prisma.userDailyRoutine.count({
      where: { meditationId: id }
    });

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete meditation. It is being used in ${usageCount} user daily routines.`
      });
    }

    const [favouriteCount, logCount] = await Promise.all([
      prisma.userFavoriteMeditation.count({ where: { session: { meditationId: id } } }),
      prisma.userMeditationLog.count({ where: { meditationId: id } }),
    ]);
    if (favouriteCount > 0 || logCount > 0) {
      return res.status(409).json({
        success: false,
        message: favouriteCount > 0
          ? `Cannot delete meditation. ${favouriteCount} user${favouriteCount === 1 ? ' has' : 's have'} it in their favourites.`
          : `Cannot delete meditation. Users have listened to it ${logCount} time${logCount === 1 ? '' : 's'}, and that history would be lost.`
      });
    }

    // Sessions reference the meditation without ON DELETE CASCADE.
    await prisma.$transaction([
      prisma.meditationSession.deleteMany({ where: { meditationId: id } }),
      prisma.meditation.delete({ where: { id } }),
    ]);

    res.json({
      success: true,
      message: 'Meditation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meditation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete meditation'
    });
  }
};
