import { Router } from 'express';
import {
  getDietPlanDays,
  getDietPlanDayById,
  createDietPlanDay,
  updateDietPlanDay,
  deleteDietPlanDay
} from '../controllers/dietPlanDayController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { dietPlanDayBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/diet-plan-days/diet/:dietId - Get all days for a diet plan
router.get('/diet/:dietId', getDietPlanDays);

// GET /api/diet-plan-days/:id - Get day by ID
router.get('/:id', getDietPlanDayById);

// POST /api/diet-plan-days - Create diet plan day
router.post('/', authenticate, authorize(['admin']), validateBody(dietPlanDayBody), createDietPlanDay);

// PUT /api/diet-plan-days/:id - Update diet plan day
router.put('/:id', authenticate, authorize(['admin']), validateBody(dietPlanDayBody), updateDietPlanDay);

// DELETE /api/diet-plan-days/:id - Delete diet plan day
router.delete('/:id', authenticate, authorize(['admin']), deleteDietPlanDay);

export default router;
