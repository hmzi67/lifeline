import { Router } from 'express';
import { getLoggedMeals, logMeal, unlogMeal } from '../controllers/dietMealLogController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { dietMealLogBody } from '../validators/trackingSchemas.js';

const router = Router();

// GET /api/diet-meal-logs?date=YYYY-MM-DD
router.get('/', authenticate, getLoggedMeals);

// POST /api/diet-meal-logs
router.post('/', authenticate, validateBody(dietMealLogBody), logMeal);

// DELETE /api/diet-meal-logs/meal/:mealId/date/:date
router.delete('/meal/:mealId/date/:date', authenticate, unlogMeal);

export default router;
