import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { Request, Response } from "express";
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

type Id = string;

interface CreateWaterIntakeBody {
  userId?: Id | null;
  date?: string | null;       // ISO date: YYYY-MM-DD
  timeStart?: string | null;  // HH:MM
  timeEnd?: string | null;    // HH:MM
  amount?: number | null;
  unit?: string | null;
  drinkType?: string | null;
  notes?: string | null;
}

interface UpdateWaterIntakeBody extends Partial<CreateWaterIntakeBody> {}

interface PaginationQuery {
  page?: string;  // number as string
  limit?: string; // number as string
}

interface ListQuery extends PaginationQuery {
  userId?: Id;
  date?: string; // YYYY-MM-DD or ISO
  startDate?: string; // YYYY-MM-DD, inclusive
  endDate?: string; // YYYY-MM-DD, inclusive
  order?: string; // 'asc' | 'desc' (default)
}

class WaterIntakeController {
  // Create new water intake log
  async createWaterIntake(
    req: Request<unknown, unknown, CreateWaterIntakeBody>,
    res: Response
  ): Promise<void> {
    try {
      const { userId, date, timeStart, timeEnd, unit, drinkType, notes } = req.body;
      const today = new Date().toISOString().split('T')[0];
      // Column is Int; a fractional amount would make Prisma throw a 500.
      const amount = typeof req.body.amount === 'number' ? Math.round(req.body.amount) : null;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          message: "Amount is required and must be a positive number",
        });
        return;
      }

      const authUser = (req as unknown as AuthenticatedRequest).user;
      const resolvedUserId = userId || authUser?.id;

      if (!resolvedUserId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      if (authUser?.id !== resolvedUserId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only create water intake logs for yourself' });
        return;
      }

      const userExists = await prisma.user.findUnique({
        where: { id: resolvedUserId },
      });
      if (!userExists) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      const waterIntake = await prisma.waterIntakeLog.create({
        data: {
          userId: resolvedUserId,
          date: new Date(date || today),
          timeStart: timeStart
            ? new Date(`1970-01-01T${timeStart}:00.000Z`)
            : null,
          timeEnd: timeEnd ? new Date(`1970-01-01T${timeEnd}:00.000Z`) : null,
          amount,
          unit: unit ?? 'ml',
          drinkType: drinkType ?? 'water',
          notes: notes ?? null,
          loggedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: "Water intake log created successfully",
        data: waterIntake,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error creating water intake:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }

  // Get all water intake logs with optional filtering
  async getAllWaterIntakes(
    req: Request<unknown, unknown, unknown, ListQuery>,
    res: Response
  ): Promise<void> {
    try {
      const { date, startDate, endDate, order, page = "1", limit = "10" } = req.query;
      const pageNum = Number.parseInt(page, 10) || 1;
      const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const authUser = (req as unknown as AuthenticatedRequest).user;
      const where: Prisma.WaterIntakeLogWhereInput = {};
      where.userId = authUser?.id;
      if (date) {
        const start = new Date(String(date).slice(0, 10));
        const end = new Date(start.getTime() + 86400000);
        where.date = { gte: start, lt: end };
      } else if (startDate || endDate) {
        // Whole days, both ends included.
        const range: Prisma.DateTimeFilter = {};
        if (startDate) range.gte = new Date(String(startDate).slice(0, 10));
        if (endDate) range.lt = new Date(new Date(String(endDate).slice(0, 10)).getTime() + 86400000);
        if (Object.values(range).some(d => Number.isNaN((d as Date).getTime()))) {
          res.status(400).json({ success: false, message: "startDate and endDate must be YYYY-MM-DD" });
          return;
        }
        where.date = range;
      }

      const [waterIntakes, totalCount] = await Promise.all([
        prisma.waterIntakeLog.findMany({
          where,
          skip,
          take: limitNum,
          // order=asc gives the oldest first (e.g. limit=1 for the first log ever).
          orderBy: {
            date: order === "asc" ? "asc" : "desc",
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        }),
        prisma.waterIntakeLog.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        message: "Water intake logs retrieved successfully",
        data: waterIntakes,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error fetching water intakes:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }

  // Get water intake log by ID
  async getWaterIntakeById(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Water intake ID is required',
        });
        return;
      }

      const waterIntake = await prisma.waterIntakeLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });

      if (!waterIntake) {
        res.status(404).json({
          success: false,
          message: "Water intake log not found",
        });
        return;
      }

      const authUser = (req as unknown as AuthenticatedRequest).user;
      if (authUser?.id !== waterIntake.userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only access your own water intake logs' });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Water intake log retrieved successfully",
        data: waterIntake,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error fetching water intake:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }

  // Get water intake logs by user ID
  async getWaterIntakesByUserId(
    req: Request<any, unknown, unknown, PaginationQuery & { date?: string }>,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.params.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      const { date, page = "1", limit = "10" } = req.query;

      const authUser = (req as unknown as AuthenticatedRequest).user;
      if (authUser?.id !== userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only access your own water intake logs' });
        return;
      }

      const pageNum = Number.parseInt(page, 10) || 1;
      const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const where: Prisma.WaterIntakeLogWhereInput = { userId };
      if (date) {
        // `date` is a DATE column (UTC midnight); match getAllWaterIntakes rather
        // than the server's local timezone.
        const start = new Date(String(date).slice(0, 10));
        const end = new Date(start.getTime() + 86400000);
        where.date = { gte: start, lt: end };
      }

      const [waterIntakes, totalCount] = await Promise.all([
        prisma.waterIntakeLog.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { date: "desc" },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        }),
        prisma.waterIntakeLog.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        message: "User water intake logs retrieved successfully",
        data: waterIntakes,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error fetching user water intakes:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }

  // Update water intake log
  async updateWaterIntake(
    req: Request<any, unknown, UpdateWaterIntakeBody>,
    res: Response
  ): Promise<void> {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Water intake ID is required',
        });
        return;
      }

      const { userId, date, timeStart, timeEnd, amount, unit, drinkType, notes } = req.body;

      const existingWaterIntake = await prisma.waterIntakeLog.findUnique({
        where: { id },
      });

      if (!existingWaterIntake) {
        res.status(404).json({
          success: false,
          message: "Water intake log not found",
        });
        return;
      }

      const authUser = (req as unknown as AuthenticatedRequest).user;
      if (authUser?.id !== existingWaterIntake.userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only update your own water intake logs' });
        return;
      }

      if (userId && userId !== existingWaterIntake.userId) {
        res.status(403).json({ success: false, message: 'Forbidden: Cannot reassign water intake to another user' });
        return;
      }

      const updateData: Prisma.WaterIntakeLogUpdateInput = {};
      if (userId !== undefined) updateData.user = userId ? { connect: { id: userId } } : undefined;
      if (date !== undefined) updateData.date = date ? new Date(date) : null;
      if (timeStart !== undefined)
        updateData.timeStart = timeStart
          ? new Date(`1970-01-01T${timeStart}:00.000Z`)
          : null;
      if (timeEnd !== undefined)
        updateData.timeEnd = timeEnd
          ? new Date(`1970-01-01T${timeEnd}:00.000Z`)
          : null;
      if (amount !== undefined) {
        if (amount !== null && (typeof amount !== 'number' || amount <= 0)) {
          res.status(400).json({ success: false, message: 'Amount must be a positive number' });
          return;
        }
        updateData.amount = amount === null ? null : Math.round(amount);
      }
      if (unit !== undefined) updateData.unit = unit;
      if (drinkType !== undefined) updateData.drinkType = drinkType;
      if (notes !== undefined) updateData.notes = notes;
      updateData.loggedAt = new Date();

      const updatedWaterIntake = await prisma.waterIntakeLog.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        message: "Water intake log updated successfully",
        data: updatedWaterIntake,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error updating water intake:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }

  // Delete water intake log
  async deleteWaterIntake(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Water intake ID is required',
        });
        return;
      }

      const existingWaterIntake = await prisma.waterIntakeLog.findUnique({
        where: { id },
      });

      if (!existingWaterIntake) {
        res.status(404).json({
          success: false,
          message: "Water intake log not found",
        });
        return;
      }

      const authUser = (req as unknown as AuthenticatedRequest).user;
      if (authUser?.id !== existingWaterIntake.userId) {
        res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own water intake logs' });
        return;
      }

      await prisma.waterIntakeLog.delete({
        where: { id },
      });

      res.status(200).json({
        success: true,
        message: "Water intake log deleted successfully",
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error deleting water intake:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }
}

const controller = new WaterIntakeController();
export default controller;
