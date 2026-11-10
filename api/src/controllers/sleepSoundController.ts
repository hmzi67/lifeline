import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { pageSize } from '../utils/pagination.js';

// ── Create ────────────────────────────────────────────────────────────────────
export const createSleepSound = async (req: Request, res: Response) => {
  try {
    const { name, description, image, soundUrl, category, duration, isActive } = req.body;

    if (!name || !soundUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name and soundUrl are required',
      });
    }

    const sound = await prisma.sleepSound.create({
      data: {
        name,
        description: description ?? null,
        image: image ?? null,
        soundUrl,
        category: category ?? null,
        duration: duration ? Number(duration) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({ success: true, data: sound, message: 'Sleep sound created successfully' });
  } catch (error) {
    console.error('Error creating sleep sound:', error);
    res.status(500).json({ success: false, message: 'Failed to create sleep sound' });
  }
};

// ── Get All ───────────────────────────────────────────────────────────────────
export const getSleepSounds = async (req: Request, res: Response) => {
  try {
    const { category, limit, offset } = req.query;

    const where = category ? { category: category as string } : {};
    const take = pageSize(limit);
    const skip = offset ? parseInt(offset as string) : undefined;

    const sounds = await prisma.sleepSound.findMany({
      where,
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    const total = await prisma.sleepSound.count({ where });

    res.json({ success: true, data: sounds, count: sounds.length, total });
  } catch (error) {
    console.error('Error fetching sleep sounds:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sleep sounds' });
  }
};

// ── Get By ID ─────────────────────────────────────────────────────────────────
export const getSleepSoundById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sound = await prisma.sleepSound.findUnique({ where: { id } });

    if (!sound) {
      return res.status(404).json({ success: false, message: 'Sleep sound not found' });
    }

    res.json({ success: true, data: sound });
  } catch (error) {
    console.error('Error fetching sleep sound:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sleep sound' });
  }
};

// ── Update ────────────────────────────────────────────────────────────────────
export const updateSleepSound = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, image, soundUrl, category, duration, isActive } = req.body;

    const existing = await prisma.sleepSound.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sleep sound not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (soundUrl !== undefined) updateData.soundUrl = soundUrl;
    if (category !== undefined) updateData.category = category;
    if (duration !== undefined) updateData.duration = duration ? Number(duration) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const sound = await prisma.sleepSound.update({ where: { id }, data: updateData });

    res.json({ success: true, data: sound, message: 'Sleep sound updated successfully' });
  } catch (error) {
    console.error('Error updating sleep sound:', error);
    res.status(500).json({ success: false, message: 'Failed to update sleep sound' });
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteSleepSound = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.sleepSound.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sleep sound not found' });
    }

    await prisma.sleepSound.delete({ where: { id } });

    res.json({ success: true, message: 'Sleep sound deleted successfully' });
  } catch (error) {
    console.error('Error deleting sleep sound:', error);
    res.status(500).json({ success: false, message: 'Failed to delete sleep sound' });
  }
};
