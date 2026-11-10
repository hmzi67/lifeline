import { Router } from 'express';
import {
  getExerciseDetails,
  getExerciseDetailById,
  createExerciseDetail,
  updateExerciseDetail,
  deleteExerciseDetail
} from '../controllers/exerciseDetailController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// GET /api/exercise-details/exercise/:exerciseId - Get all details for an exercise
router.get('/exercise/:exerciseId', getExerciseDetails);

// GET /api/exercise-details/:id - Get exercise detail by ID
router.get('/:id', getExerciseDetailById);

// POST /api/exercise-details - Create exercise detail
router.post('/', authenticate, authorize(['admin']), createExerciseDetail);

// PUT /api/exercise-details/:id - Update exercise detail
router.put('/:id', authenticate, authorize(['admin']), updateExerciseDetail);

// DELETE /api/exercise-details/:id - Delete exercise detail
router.delete('/:id', authenticate, authorize(['admin']), deleteExerciseDetail);

export default router;
