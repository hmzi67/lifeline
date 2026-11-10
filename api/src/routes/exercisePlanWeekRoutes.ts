import { Router } from 'express';
import {
  getExercisePlanWeeks,
  getExercisePlanWeekById,
  createExercisePlanWeek,
  updateExercisePlanWeek,
  deleteExercisePlanWeek
} from '../controllers/exercisePlanWeekController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { exercisePlanWeekBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/exercise-plan-weeks/plan/:planId - Get all weeks for a plan
router.get('/plan/:planId', getExercisePlanWeeks);

// GET /api/exercise-plan-weeks/:id - Get week by ID
router.get('/:id', getExercisePlanWeekById);

// POST /api/exercise-plan-weeks - Create exercise plan week
router.post('/', authenticate, authorize(['admin']), validateBody(exercisePlanWeekBody), createExercisePlanWeek);

// PUT /api/exercise-plan-weeks/:id - Update exercise plan week
router.put('/:id', authenticate, authorize(['admin']), validateBody(exercisePlanWeekBody), updateExercisePlanWeek);

// DELETE /api/exercise-plan-weeks/:id - Delete exercise plan week
router.delete('/:id', authenticate, authorize(['admin']), deleteExercisePlanWeek);

export default router;
