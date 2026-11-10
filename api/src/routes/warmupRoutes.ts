import { Router } from 'express';
import { getWarmupExercises, getWarmupSession } from '../controllers/warmupController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// GET /api/warmup/exercises - Get warm-up exercises
router.get('/exercises', getWarmupExercises);

// GET /api/warmup/session
router.get('/session', getWarmupSession);

export default router;
