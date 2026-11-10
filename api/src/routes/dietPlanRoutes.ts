import { Router } from 'express';
import {
  getAllDietPlans,
  getDietPlanById,
  createDietPlan,
  updateDietPlan,
  deleteDietPlan,
  searchDietPlans
} from '../controllers/dietPlanController.js';
import { getDietPlanSchedule, saveDietPlanSchedule } from '../controllers/dietPlanScheduleController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { dietPlanBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/diet-plans - Get all diet plans
router.get('/', getAllDietPlans);

// GET /api/diet-plans/search - Search diet plans
router.get('/search', searchDietPlans);

// GET /api/diet-plans/:id - Get diet plan by ID
router.get('/:id', getDietPlanById);

// GET /api/diet-plans/:id/schedule - Days and meals of a plan (admin editor)
router.get('/:id/schedule', authenticate, authorize(['admin']), getDietPlanSchedule);

// PUT /api/diet-plans/:id/schedule - Replace a plan's days and meals in one save
router.put('/:id/schedule', authenticate, authorize(['admin']), saveDietPlanSchedule);

// POST /api/diet-plans - Create new diet plan
router.post('/', authenticate, authorize(['admin']), validateBody(dietPlanBody), createDietPlan);

// PUT /api/diet-plans/:id - Update diet plan
router.put('/:id', authenticate, authorize(['admin']), validateBody(dietPlanBody), updateDietPlan);

// DELETE /api/diet-plans/:id - Delete diet plan
router.delete('/:id', authenticate, authorize(['admin']), deleteDietPlan);

export default router;
