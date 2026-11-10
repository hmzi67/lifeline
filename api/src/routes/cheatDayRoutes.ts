import { Router } from 'express';
import {
    deleteCheatDay,
    getAllCheatDays,
    getCheatDayById,
    getUserCheatDays,
    logCheatDay,
    updateCheatDay
} from '../controllers/cheatDayController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { cheatDayEligibility } from '../services/cheatDayEligibility.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { imageUpload } from '../middleware/upload.js';

const router = Router();

// GET /api/cheat-days - Get all cheat days (admin)
router.get('/', authenticate, authorize(['admin']), getAllCheatDays);

// Whether the user has followed their diet plan long enough for a cheat day (declared before /:id)
router.get('/eligibility', authenticate, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  try {
    res.status(200).json({ success: true, data: await cheatDayEligibility(userId, date) });
  } catch (error) {
    console.error('Cheat day eligibility error:', error);
    res.status(500).json({ success: false, message: 'Failed to check cheat day eligibility' });
  }
});

// GET /api/cheat-days/user/:userId - Get user's cheat days
router.get('/user/:userId', authenticate, getUserCheatDays);

// GET /api/cheat-days/:id - Get cheat day by ID
router.get('/:id', authenticate, getCheatDayById);

// POST /api/cheat-days - Log a cheat day meal
router.post('/', authenticate, imageUpload.single('file'), logCheatDay);

// PUT /api/cheat-days/:id - Update cheat day
router.put('/:id', authenticate, imageUpload.single('file'), updateCheatDay);

// DELETE /api/cheat-days/:id - Delete cheat day
router.delete('/:id', authenticate, deleteCheatDay);

export default router;
