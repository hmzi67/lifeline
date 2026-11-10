import { Router } from 'express';
import { UserDailyRoutineController } from '../controllers/userDailyRoutineController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { dailyRoutineBody } from '../validators/accountSchemas.js';

const router = Router();

// Create a new user daily routine
router.post('/', authenticate, validateBody(dailyRoutineBody), UserDailyRoutineController.createUserDailyRoutine);

// Get all user daily routines with optional pagination and filtering
router.get('/', authenticate, UserDailyRoutineController.getAllUserDailyRoutines);

// Create-or-update the caller's routine for a given local day (must precede '/:id')
router.put('/today', authenticate, validateBody(dailyRoutineBody), UserDailyRoutineController.upsertTodayRoutine);

// Get user daily routine by ID
router.get('/:id', authenticate, UserDailyRoutineController.getUserDailyRoutineById);

// Update user daily routine by ID
router.put('/:id', authenticate, validateBody(dailyRoutineBody), UserDailyRoutineController.updateUserDailyRoutine);

// Delete user daily routine by ID
router.delete('/:id', authenticate, UserDailyRoutineController.deleteUserDailyRoutine);

// Get user daily routines by user ID
router.get('/user/:userId', authenticate, UserDailyRoutineController.getUserDailyRoutinesByUserId);

export default router;