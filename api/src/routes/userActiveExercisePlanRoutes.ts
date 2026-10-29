import { Router } from 'express';
import {
  getUserActiveExercisePlan,
  startActiveExercisePlan,
  pauseActiveExercisePlan,
  resumeActiveExercisePlan,
  updateCurrentWeek,
  deleteActiveExercisePlan
} from '../controllers/userActiveExercisePlanController.js';
import authenticate from '../middleware/authenticate.js';
import { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } from '../middleware/ownership.js';

const router = Router();

router.use(authenticate);

const ownsPlan = requireRecordOwner('userActiveExercisePlan');

// GET /api/active-exercise-plans/user/:userId - Get user's active exercise plan
router.get('/user/:userId', requireSelfOrAdmin(), getUserActiveExercisePlan);

// POST /api/active-exercise-plans/start - Start a new active exercise plan for the caller
router.post('/start', bindBodyUserIdToCaller, startActiveExercisePlan);

// PUT /api/active-exercise-plans/:id/pause - Pause active exercise plan
router.put('/:id/pause', ownsPlan, pauseActiveExercisePlan);

// PUT /api/active-exercise-plans/:id/resume - Resume active exercise plan
router.put('/:id/resume', ownsPlan, resumeActiveExercisePlan);

// PUT /api/active-exercise-plans/:id/current-week - Update current week
router.put('/:id/current-week', ownsPlan, updateCurrentWeek);

// DELETE /api/active-exercise-plans/:id - Delete active exercise plan
router.delete('/:id', ownsPlan, deleteActiveExercisePlan);

export default router;
