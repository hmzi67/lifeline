import { Router } from 'express';
import {
  getAllExercisePlans,
  getExercisePlanById,
  createExercisePlan,
  updateExercisePlan,
  deleteExercisePlan
} from '../controllers/exercisePlanController.js';
import { saveExercisePlanSchedule } from '../controllers/exercisePlanBuilderController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { exercisePlanBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/exercise-plans - Get all exercise plans
router.get('/', getAllExercisePlans);

// GET /api/exercise-plans/:id - Get exercise plan by ID
router.get('/:id', getExercisePlanById);

// POST /api/exercise-plans - Create new exercise plan
router.post('/', authenticate, authorize(['admin']), validateBody(exercisePlanBody), createExercisePlan);

// PUT /api/exercise-plans/:id - Update exercise plan
router.put('/:id', authenticate, authorize(['admin']), validateBody(exercisePlanBody), updateExercisePlan);

// PUT /api/exercise-plans/:id/schedule - Replace a plan's weeks and workouts in one save
router.put('/:id/schedule', authenticate, authorize(['admin']), saveExercisePlanSchedule);

// DELETE /api/exercise-plans/:id - Delete exercise plan
router.delete('/:id', authenticate, authorize(['admin']), deleteExercisePlan);

export default router;
