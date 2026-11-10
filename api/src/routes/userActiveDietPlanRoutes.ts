import { Router } from 'express';
import {
    deleteActiveDietPlan,
    endActiveDietPlan,
    getUserActiveDietPlan,
    pauseActiveDietPlan,
    resumeActiveDietPlan,
    startActiveDietPlan,
    updateCurrentDay
} from '../controllers/userActiveDietPlanController.js';
import authenticate from '../middleware/authenticate.js';
import { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } from '../middleware/ownership.js';
import { validateBody } from '../middleware/validateRequest.js';
import { activeDietPlanDayBody, startActiveDietPlanBody } from '../validators/trackingSchemas.js';

const router = Router();

router.use(authenticate);

const ownsPlan = requireRecordOwner('userActiveDietPlan');

// GET /api/active-diet-plans/user/:userId - Get user's active diet plan
router.get('/user/:userId', requireSelfOrAdmin(), getUserActiveDietPlan);

// POST /api/active-diet-plans/start - Start a new active diet plan for the caller
router.post('/start', bindBodyUserIdToCaller, validateBody(startActiveDietPlanBody), startActiveDietPlan);

// PUT /api/active-diet-plans/:id/pause - Pause active diet plan
router.put('/:id/pause', ownsPlan, pauseActiveDietPlan);

// PUT /api/active-diet-plans/:id/resume - Resume active diet plan
router.put('/:id/resume', ownsPlan, resumeActiveDietPlan);

// PUT /api/active-diet-plans/:id/current-day - Update current day
router.put('/:id/current-day', ownsPlan, validateBody(activeDietPlanDayBody), updateCurrentDay);

// PUT /api/active-diet-plans/:id/end - Deactivate the plan, keeping its meal logs
router.put('/:id/end', ownsPlan, endActiveDietPlan);

// DELETE /api/active-diet-plans/:id - Delete active diet plan
router.delete('/:id', ownsPlan, deleteActiveDietPlan);

export default router;
