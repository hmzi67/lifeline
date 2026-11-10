import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const prisma = new PrismaClient();

type SleepItemType = 'sound' | 'story';

const parseType = (value: unknown): SleepItemType | null =>
  value === 'sound' || value === 'story' ? value : null;

// Enough of the sound or story to show and play it from the Favourites screen.
const FAVORITE_SELECT = {
  id: true,
  soundId: true,
  storyId: true,
  favoritedAt: true,
  sound: { select: { id: true, name: true, description: true, image: true, soundUrl: true, duration: true } },
  story: { select: { id: true, title: true, description: true, image: true, audioUrl: true, duration: true } },
} as const;

type FavoriteRow = {
  id: string;
  soundId: string | null;
  storyId: string | null;
  favoritedAt: Date;
  sound: { id: string; name: string; description: string | null; image: string | null; soundUrl: string; duration: number | null } | null;
  story: { id: string; title: string; description: string | null; image: string | null; audioUrl: string; duration: number | null } | null;
};

// One shape for both kinds, so the app doesn't need to know sounds say "name" and stories "title".
const toResponse = (row: FavoriteRow) => {
  const type: SleepItemType = row.soundId ? 'sound' : 'story';
  const item = row.sound
    ? { id: row.sound.id, title: row.sound.name, description: row.sound.description, image: row.sound.image, audioUrl: row.sound.soundUrl, duration: row.sound.duration }
    : row.story
      ? { id: row.story.id, title: row.story.title, description: row.story.description, image: row.story.image, audioUrl: row.story.audioUrl, duration: row.story.duration }
      : null;
  return { id: row.id, type, itemId: (row.soundId ?? row.storyId) as string, favoritedAt: row.favoritedAt, item };
};

const requireUser = (req: Request, res: Response): string | null => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) res.status(401).json({ success: false, message: 'Authentication required' });
  return userId ?? null;
};

// GET /api/favorite-sleep - the caller's favourite sleep sounds and stories, newest first
export const getFavoriteSleepItems = async (req: Request, res: Response): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const favorites = await prisma.userFavoriteSleepItem.findMany({
      where: { userId },
      select: FAVORITE_SELECT,
      orderBy: { favoritedAt: 'desc' },
    });
    res.status(200).json({
      success: true,
      data: favorites.map(toResponse),
      message: 'Favorite sleep items retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching favorite sleep items:', error);
    res.status(500).json({ success: false, message: 'Failed to load favorite sleep items' });
  }
};

// POST /api/favorite-sleep { type: 'sound' | 'story', itemId } - adding one twice is not an error
export const addFavoriteSleepItem = async (req: Request, res: Response): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const type = parseType(req.body?.type);
  const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
  if (!type || !itemId) {
    res.status(400).json({ success: false, message: "type ('sound' or 'story') and itemId are required" });
    return;
  }

  try {
    const exists = type === 'sound'
      ? await prisma.sleepSound.findUnique({ where: { id: itemId }, select: { id: true } })
      : await prisma.sleepStory.findUnique({ where: { id: itemId }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ success: false, message: type === 'sound' ? 'Sleep sound not found' : 'Sleep story not found' });
      return;
    }

    const favorite = type === 'sound'
      ? await prisma.userFavoriteSleepItem.upsert({
          where: { userId_soundId: { userId, soundId: itemId } },
          create: { userId, soundId: itemId },
          update: {},
          select: FAVORITE_SELECT,
        })
      : await prisma.userFavoriteSleepItem.upsert({
          where: { userId_storyId: { userId, storyId: itemId } },
          create: { userId, storyId: itemId },
          update: {},
          select: FAVORITE_SELECT,
        });

    res.status(201).json({ success: true, data: toResponse(favorite), message: 'Added to favorites' });
  } catch (error) {
    console.error('Error adding favorite sleep item:', error);
    res.status(500).json({ success: false, message: 'Failed to add to favorites' });
  }
};

// DELETE /api/favorite-sleep/:type/:itemId - removing a missing one is not an error
export const removeFavoriteSleepItem = async (req: Request, res: Response): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const type = parseType(req.params.type);
  if (!type) {
    res.status(400).json({ success: false, message: "type must be 'sound' or 'story'" });
    return;
  }

  try {
    // Scoped to the caller, so one user can never remove another's favourite.
    await prisma.userFavoriteSleepItem.deleteMany({
      where: type === 'sound' ? { userId, soundId: req.params.itemId } : { userId, storyId: req.params.itemId },
    });
    res.status(200).json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite sleep item:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from favorites' });
  }
};
