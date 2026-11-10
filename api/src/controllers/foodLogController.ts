import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const amount = (max: number) => z.coerce.number().min(0).max(max).optional().nullable();

const foodLogSchema = z.object({
  // The user's local calendar day; the app sends it so late-night meals land on the right day.
  date: dayKey,
  name: z.string().trim().min(1, 'name is required').max(150),
  mealType: z.string().trim().max(50).optional().nullable(),
  calories: z.coerce.number().int().min(0).max(20000).optional().nullable(),
  protein: amount(2000),
  carbs: amount(2000),
  fat: amount(2000),
  source: z.enum(['barcode', 'scan', 'manual']),
  barcode: z.string().trim().max(64).optional().nullable(),
  image: z.string().trim().optional().nullable(),
});

const userIdOf = (req: Request) => (req as AuthenticatedRequest).user?.id;

// GET /api/food-logs?date=YYYY-MM-DD
export const getFoodLogs = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const parsed = dayKey.safeParse(req.query.date);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });

  try {
    const foodLogs = await prisma.foodLog.findMany({
      where: { userId, date: new Date(parsed.data) },
      orderBy: { loggedAt: 'asc' },
    });
    res.status(200).json({ success: true, data: foodLogs });
  } catch (error) {
    console.error('Get food logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch food logs' });
  }
};

// POST /api/food-logs
export const createFoodLog = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const parsed = foodLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid food log' });
  }

  try {
    const { date, ...rest } = parsed.data;
    const foodLog = await prisma.foodLog.create({ data: { ...rest, userId, date: new Date(date) } });
    res.status(201).json({ success: true, data: foodLog, message: 'Food logged' });
  } catch (error) {
    console.error('Create food log error:', error);
    res.status(500).json({ success: false, message: 'Failed to log food' });
  }
};

// DELETE /api/food-logs/:id
export const deleteFoodLog = async (req: Request<{ id: string }>, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const { count } = await prisma.foodLog.deleteMany({ where: { id: req.params.id, userId } });
    if (count === 0) return res.status(404).json({ success: false, message: 'Food log not found' });
    res.status(200).json({ success: true, data: { id: req.params.id }, message: 'Food log deleted' });
  } catch (error) {
    console.error('Delete food log error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete food log' });
  }
};
