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

export default router;
