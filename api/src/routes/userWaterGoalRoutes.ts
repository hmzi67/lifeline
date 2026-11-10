import { Router } from 'express';
import {
    deleteUserWaterGoal,
    getAllWaterGoals,
    getUserWaterGoal,
    setUserWaterGoal
} from '../controllers/userWaterGoalController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } from '../middleware/ownership.js';
import { validateBody } from '../middleware/validateRequest.js';
import { waterGoalBody } from '../validators/trackingSchemas.js';

const router = Router();

router.use(authenticate);

// GET /api/water-goals - Get all water goals (admin)
router.get('/', authorize(['admin']), getAllWaterGoals);

// GET /api/water-goals/user/:userId - Get user's water goal
router.get('/user/:userId', requireSelfOrAdmin(), getUserWaterGoal);

// POST /api/water-goals - Set or update user's water goal
router.post('/', bindBodyUserIdToCaller, validateBody(waterGoalBody), setUserWaterGoal);

// DELETE /api/water-goals/:id - Delete water goal
router.delete('/:id', requireRecordOwner('userWaterGoal'), deleteUserWaterGoal);

export default router;
