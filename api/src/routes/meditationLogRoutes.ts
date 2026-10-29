import { Router } from 'express';
import { createMeditationLog, getMeditationLogs } from '../controllers/meditationLogController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// GET /api/meditation-logs?limit=20 - The caller's finished meditations, newest first
router.get('/', getMeditationLogs);

// POST /api/meditation-logs - Record a finished meditation
router.post('/', createMeditationLog);

export default router;
