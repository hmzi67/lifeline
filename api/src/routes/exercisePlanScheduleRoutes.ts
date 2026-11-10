import { Router } from 'express';
import {
  getExercisePlanSchedules,
  getExercisePlanScheduleById,
  createExercisePlanSchedule,
  updateExercisePlanSchedule,
  deleteExercisePlanSchedule
} from '../controllers/exercisePlanScheduleController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { exercisePlanScheduleBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/exercise-plan-schedules/week/:weekId - Get all schedules for a week
router.get('/week/:weekId', getExercisePlanSchedules);

// GET /api/exercise-plan-schedules/:id - Get schedule by ID
router.get('/:id', getExercisePlanScheduleById);

// POST /api/exercise-plan-schedules - Create exercise plan schedule
router.post('/', authenticate, authorize(['admin']), validateBody(exercisePlanScheduleBody), createExercisePlanSchedule);

// PUT /api/exercise-plan-schedules/:id - Update exercise plan schedule
router.put('/:id', authenticate, authorize(['admin']), validateBody(exercisePlanScheduleBody), updateExercisePlanSchedule);

// DELETE /api/exercise-plan-schedules/:id - Delete exercise plan schedule
router.delete('/:id', authenticate, authorize(['admin']), deleteExercisePlanSchedule);

export default router;
