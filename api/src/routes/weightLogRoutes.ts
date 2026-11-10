import { Request, Response, Router } from 'express';
import { prisma } from '../config/database.js';
import authenticate from '../middleware/authenticate.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const router = Router();

router.use(authenticate);

// GET /api/weight-logs?days=90 - The caller's daily weight readings, oldest first
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? '90'), 10) || 90));
  const since = new Date(Date.now() - days * 86400000);
  try {
    const weightLogs = await prisma.weightLog.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, weight: true, unit: true },
    });
    res.status(200).json({ success: true, data: weightLogs });
  } catch (error) {
    console.error('Get weight logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch weight history' });
  }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/weight-logs { date: 'YYYY-MM-DD', weight } - A weigh-in (kg) added for a missed local day.
// Today's reading is saved with the questionnaire weight, which also updates the current weight.
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  const { date, weight } = req.body ?? {};
  const day = typeof date === 'string' && DATE_RE.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  // One day of slack for timezones ahead of UTC; a week back, as the app offers.
  if (!day || Number.isNaN(day.getTime()) || day.getTime() > Date.now() + 86400000 || day.getTime() < Date.now() - 8 * 86400000) {
    return res.status(400).json({ success: false, message: 'date must be a day in the past week (YYYY-MM-DD)' });
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 700) {
    return res.status(400).json({ success: false, message: 'weight must be a positive number of kg' });
  }

  try {
    const questionnaire = await prisma.questionnaire.findFirst({ where: { userId }, select: { weightUnit: true } });
    const unit = questionnaire?.weightUnit ?? null;
    const log = await prisma.weightLog.upsert({
      where: { userId_date: { userId, date: day } },
      create: { userId, date: day, weight, unit },
      update: { weight, unit, loggedAt: new Date() },
      select: { date: true, weight: true, unit: true },
    });
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error('Create weight log error:', error);
    res.status(500).json({ success: false, message: 'Failed to save weight' });
  }
});

export default router;
