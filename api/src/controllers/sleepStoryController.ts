import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { pageSize } from '../utils/pagination.js';

// ── Create ────────────────────────────────────────────────────────────────────
export const createSleepStory = async (req: Request, res: Response) => {
  try {
    const { title, author, description, image, audioUrl, category, duration, isActive } = req.body;

    if (!title || !audioUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title and audioUrl are required',
      });
    }

    const story = await prisma.sleepStory.create({
      data: {
        title,
        author: author ?? null,
        description: description ?? null,
        image: image ?? null,
        audioUrl,
        category: category ?? null,
        duration: duration ? Number(duration) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({ success: true, data: story, message: 'Sleep story created successfully' });
  } catch (error) {
    console.error('Error creating sleep story:', error);
    res.status(500).json({ success: false, message: 'Failed to create sleep story' });
  }
};

// ── Get All ───────────────────────────────────────────────────────────────────
export const getSleepStories = async (req: Request, res: Response) => {
  try {
    const { category, limit, offset } = req.query;

    const where = category ? { category: category as string } : {};
    const take = pageSize(limit);
    const skip = offset ? parseInt(offset as string) : undefined;

    const stories = await prisma.sleepStory.findMany({
      where,
      take,
      skip,
      orderBy: { title: 'asc' },
    });

    const total = await prisma.sleepStory.count({ where });

    res.json({ success: true, data: stories, count: stories.length, total });
  } catch (error) {
    console.error('Error fetching sleep stories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sleep stories' });
  }
};

// ── Get By ID ─────────────────────────────────────────────────────────────────
export const getSleepStoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const story = await prisma.sleepStory.findUnique({ where: { id } });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Sleep story not found' });
    }

    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error fetching sleep story:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sleep story' });
  }
};

// ── Update ────────────────────────────────────────────────────────────────────
export const updateSleepStory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, author, description, image, audioUrl, category, duration, isActive } = req.body;

    const existing = await prisma.sleepStory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sleep story not found' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
    if (category !== undefined) updateData.category = category;
    if (duration !== undefined) updateData.duration = duration ? Number(duration) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const story = await prisma.sleepStory.update({ where: { id }, data: updateData });

    res.json({ success: true, data: story, message: 'Sleep story updated successfully' });
  } catch (error) {
    console.error('Error updating sleep story:', error);
    res.status(500).json({ success: false, message: 'Failed to update sleep story' });
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteSleepStory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.sleepStory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sleep story not found' });
    }

    await prisma.sleepStory.delete({ where: { id } });

    res.json({ success: true, message: 'Sleep story deleted successfully' });
  } catch (error) {
    console.error('Error deleting sleep story:', error);
    res.status(500).json({ success: false, message: 'Failed to delete sleep story' });
  }
};
