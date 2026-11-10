import { Router } from 'express';
import {
  getDietPlanMeals,
  getDietPlanMealById,
  createDietPlanMeal,
  updateDietPlanMeal,
  deleteDietPlanMeal
} from '../controllers/dietPlanMealController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// GET /api/diet-plan-meals/day/:dayId - Get all meals for a day
router.get('/day/:dayId', getDietPlanMeals);

// GET /api/diet-plan-meals/:id - Get meal by ID
router.get('/:id', getDietPlanMealById);

// POST /api/diet-plan-meals - Create diet plan meal
router.post('/', authenticate, authorize(['admin']), createDietPlanMeal);

// PUT /api/diet-plan-meals/:id - Update diet plan meal
router.put('/:id', authenticate, authorize(['admin']), updateDietPlanMeal);

// DELETE /api/diet-plan-meals/:id - Delete diet plan meal
router.delete('/:id', authenticate, authorize(['admin']), deleteDietPlanMeal);

export default router;
