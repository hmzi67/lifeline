import { Router } from 'express';
import { completeUserExerciseProgress, getUserExerciseProgress } from '../controllers/userExerciseProgressController.js';
import authenticate from '../middleware/authenticate.js';
import { bindBodyUserIdToCaller, requireSelfOrAdmin } from '../middleware/ownership.js';

const router = Router();

router.use(authenticate);

// GET /api/user-exercise-progress/user/:userId - Get user exercise progress
router.get('/user/:userId', requireSelfOrAdmin(), getUserExerciseProgress);

// POST /api/user-exercise-progress/complete - Save the caller's completed exercise progress
router.post('/complete', bindBodyUserIdToCaller, completeUserExerciseProgress);

export default router;
