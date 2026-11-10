import { Router } from 'express';
import {
  getAllUserDietPlans,
  getUserDietPlansByUserId,
  getUserDietPlanById,
  assignDietPlanToUser,
  updateUserDietPlan,
  removeUserDietPlan,
  removeUserFromDietPlan,
  getUsersByDietPlanId
} from '../controllers/userDietPlanController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } from '../middleware/ownership.js';

const router = Router();

// Every route acts on a user's own assignments; listings across users are admin-only.
router.use(authenticate);

// GET /api/user-diet-plans - Get all user diet plan assignments
router.get('/', authorize(['admin']), getAllUserDietPlans);

// GET /api/user-diet-plans/:id - Get user diet plan assignment by ID
router.get('/:id', requireRecordOwner('userDietPlan'), getUserDietPlanById);

// GET /api/user-diet-plans/user/:userId - Get diet plans for specific user
router.get('/user/:userId', requireSelfOrAdmin(), getUserDietPlansByUserId);

// GET /api/user-diet-plans/diet/:dietId/users - Get users for specific diet plan
router.get('/diet/:dietId/users', authorize(['admin']), getUsersByDietPlanId);

// POST /api/user-diet-plans/assign - Assign diet plan to the caller
router.post('/assign', bindBodyUserIdToCaller, assignDietPlanToUser);

// PUT /api/user-diet-plans/:id - Update user diet plan assignment (can move it between users)
router.put('/:id', authorize(['admin']), updateUserDietPlan);

// DELETE /api/user-diet-plans/:id - Remove user diet plan assignment
router.delete('/:id', requireRecordOwner('userDietPlan'), removeUserDietPlan);

// DELETE /api/user-diet-plans/user/:userId/diet/:dietId - Remove specific user from diet plan
router.delete('/user/:userId/diet/:dietId', requireSelfOrAdmin(), removeUserFromDietPlan);

export default router;
