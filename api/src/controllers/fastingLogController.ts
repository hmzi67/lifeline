import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

// Helper function to get userId from token
const getUserIdFromToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
};

const MAX_FAST_MINUTES = 7 * 24 * 60;
// Clock skew allowed between the phone and the server.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const parseInstant = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Outcome of ending a fast at `endedAt`: how long it ran and whether it reached its target.
 * A fast without a target counts as completed.
 */
export const endFast = (startedAt: Date, endedAt: Date, targetMinutes: number | null) => {
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  const reachedTarget = !targetMinutes || durationMinutes >= targetMinutes;
  return { durationMinutes, status: reachedTarget ? 'COMPLETED' : 'STOPPED' };
};

// Create a new fasting log
export const createFastingLog = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { date, timeStart, timeEnd, durationMinutes, startedAt, targetMinutes } = req.body;

    // Validate required fields
    if (!date || !timeStart || !timeEnd) {
      return res.status(400).json({
        success: false,
        message: 'Date, start time, and end time are required',
      });
    }

    // Validate time format (HH:mm or HH:mm:ss)
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    if (!timeRegex.test(timeStart) || !timeRegex.test(timeEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Time must be in HH:mm or HH:mm:ss format',
      });
    }

    const data: any = {
      userId,
      date: new Date(date),
      timeStart: new Date(`1970-01-01T${timeStart}Z`),
      timeEnd: new Date(`1970-01-01T${timeEnd}Z`),
    };
    if (durationMinutes != null) data.durationMinutes = parseInt(String(durationMinutes), 10);

    // Current app versions start a fast with a real timestamp and a target; older ones
    // send only date/time fields and keep working as before.
    if (startedAt != null) {
      const start = parseInstant(startedAt);
      if (!start || start.getTime() > Date.now() + CLOCK_SKEW_MS) {
        return res.status(400).json({ success: false, message: 'startedAt must be a valid time, not in the future' });
      }
      const target = targetMinutes == null ? null : Number(targetMinutes);
      if (target !== null && (!Number.isInteger(target) || target < 1 || target > MAX_FAST_MINUTES)) {
        return res.status(400).json({ success: false, message: 'targetMinutes must be a whole number of minutes' });
      }

      const active = await prisma.fastingLog.findFirst({ where: { userId, status: 'ACTIVE' } });
      if (active) {
        return res.status(409).json({
          success: false,
          message: 'You already have a fast in progress',
          data: { fastingLog: active },
        });
      }
      Object.assign(data, { startedAt: start, targetMinutes: target, status: 'ACTIVE' });
    }

    const fastingLog = await prisma.fastingLog.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { fastingLog },
      message: 'Fasting log created successfully',
    });
  } catch (error) {
    console.error('Create fasting log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fasting log',
    });
  }
};

// Get all fasting logs for the authenticated user
export const getUserFastingLogs = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const {
      page = '1',
      limit = '10',
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const totalLogs = await prisma.fastingLog.count({ where });

    const fastingLogs = await prisma.fastingLog.findMany({
      where,
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
      skip,
      take: limitNum,
    });

    const totalPages = Math.ceil(totalLogs / limitNum);

    res.status(200).json({
      success: true,
      data: {
        fastingLogs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLogs,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get user fasting logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fasting logs',
    });
  }
};

// The user's fast in progress, whichever day it started on
export const getActiveFastingLog = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const fastingLog = await prisma.fastingLog.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { fastingLog } });
  } catch (error) {
    console.error('Get active fasting log error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch the active fast' });
  }
};

// Get a single fasting log by ID
export const getFastingLogById = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;

    const fastingLog = await prisma.fastingLog.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        userDailyRoutines: true,
      },
    });

    if (!fastingLog) {
      return res.status(404).json({
        success: false,
        message: 'Fasting log not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { fastingLog },
    });
  } catch (error) {
    console.error('Get fasting log by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fasting log',
    });
  }
};

// Update a fasting log
export const updateFastingLog = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const { date, timeStart, timeEnd, durationMinutes, endedAt } = req.body;

    // Check if the fasting log exists and belongs to the user
    const existingLog = await prisma.fastingLog.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: 'Fasting log not found',
      });
    }

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    if (timeStart && !timeRegex.test(timeStart)) {
      return res.status(400).json({ success: false, message: 'timeStart must be in HH:mm or HH:mm:ss format' });
    }
    if (timeEnd && !timeRegex.test(timeEnd)) {
      return res.status(400).json({ success: false, message: 'timeEnd must be in HH:mm or HH:mm:ss format' });
    }

    const data: any = {};
    if (date) data.date = new Date(date);
    if (timeStart) data.timeStart = new Date(`1970-01-01T${timeStart}Z`);
    if (timeEnd) data.timeEnd = new Date(`1970-01-01T${timeEnd}Z`);
    if (durationMinutes != null) data.durationMinutes = parseInt(String(durationMinutes), 10);

    // Ending a timestamped fast: the server works out the duration and outcome.
    if (endedAt != null) {
      if (!existingLog.startedAt) {
        return res.status(400).json({ success: false, message: 'This fast has no start time' });
      }
      if (existingLog.status !== 'ACTIVE') {
        return res.status(409).json({ success: false, message: 'This fast has already ended' });
      }
      const end = parseInstant(endedAt);
      if (!end || end < existingLog.startedAt || end.getTime() > Date.now() + CLOCK_SKEW_MS) {
        return res.status(400).json({ success: false, message: 'endedAt must be between the start time and now' });
      }
      Object.assign(data, { endedAt: end, ...endFast(existingLog.startedAt, end, existingLog.targetMinutes) });
    }

    const fastingLog = await prisma.fastingLog.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: { fastingLog },
      message: 'Fasting log updated successfully',
    });
  } catch (error) {
    console.error('Update fasting log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fasting log',
    });
  }
};

// Delete a fasting log
export const deleteFastingLog = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;

    // Check if the fasting log exists and belongs to the user
    const existingLog = await prisma.fastingLog.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: 'Fasting log not found',
      });
    }

    await prisma.fastingLog.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Fasting log deleted successfully',
    });
  } catch (error) {
    console.error('Delete fasting log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fasting log',
    });
  }
};

// Get fasting statistics for the user
export const getFastingStats = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { startDate, endDate } = req.query;

    const where: any = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const totalLogs = await prisma.fastingLog.count({ where });

    const logs = await prisma.fastingLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Calculate average fasting duration
    let totalDuration = 0;
    logs.forEach(log => {
      if (log.timeStart && log.timeEnd) {
        const start = log.timeStart.getTime();
        const end = log.timeEnd.getTime();
        const duration = end - start;
        totalDuration += duration;
      }
    });

    const averageDuration = totalLogs > 0 ? totalDuration / totalLogs : 0;
    const averageHours = averageDuration / (1000 * 60 * 60);

    res.status(200).json({
      success: true,
      data: {
        totalLogs,
        averageFastingHours: averageHours.toFixed(2),
        dateRange: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present',
        },
      },
    });
  } catch (error) {
    console.error('Get fasting stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fasting statistics',
    });
  }
};