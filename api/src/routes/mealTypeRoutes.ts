import { Router } from 'express';
import {
  getAllMealTypes,
  getMealTypeById,
  createMealType,
  updateMealType,
  deleteMealType
} from '../controllers/mealTypeController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// GET /api/meal-types - Get all meal types
router.get('/', getAllMealTypes);

// GET /api/meal-types/:id - Get meal type by ID
router.get('/:id', getMealTypeById);

// POST /api/meal-types - Create new meal type
router.post('/', authenticate, authorize(['admin']), createMealType);

// PUT /api/meal-types/:id - Update meal type
router.put('/:id', authenticate, authorize(['admin']), updateMealType);

// DELETE /api/meal-types/:id - Delete meal type
router.delete('/:id', authenticate, authorize(['admin']), deleteMealType);

export default router;
