import { Router } from 'express';
import {
  getAllUserExercises,
  getUserExercisesByUserId,
  getUserExerciseById,
  assignExerciseToUser,
  updateUserExercise,
  removeUserExercise,
  removeUserFromExercise,
  getUsersByExerciseId,
  getUserExercisesByPurpose
} from '../controllers/userExerciseController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } from '../middleware/ownership.js';
import { validateBody } from '../middleware/validateRequest.js';
import { userExerciseBody } from '../validators/trackingSchemas.js';

const router = Router();

// Every route acts on a user's own assignments; listings across users are admin-only.
router.use(authenticate);

// GET /api/user-exercises - Get all user exercise assignments
router.get('/', authorize(['admin']), getAllUserExercises);

// GET /api/user-exercises/:id - Get user exercise assignment by ID
router.get('/:id', requireRecordOwner('userExercise'), getUserExerciseById);

// GET /api/user-exercises/user/:userId - Get exercises for specific user
router.get('/user/:userId', requireSelfOrAdmin(), getUserExercisesByUserId);

// GET /api/user-exercises/user/:userId/purpose/:purpose - Get user exercises by purpose
router.get('/user/:userId/purpose/:purpose', requireSelfOrAdmin(), getUserExercisesByPurpose);

// GET /api/user-exercises/exercise/:exerciseId/users - Get users for specific exercise
router.get('/exercise/:exerciseId/users', authorize(['admin']), getUsersByExerciseId);

// POST /api/user-exercises/assign - Assign exercise to the caller
router.post('/assign', bindBodyUserIdToCaller, validateBody(userExerciseBody), assignExerciseToUser);

// PUT /api/user-exercises/:id - Update user exercise assignment (can move it between users)
router.put('/:id', authorize(['admin']), validateBody(userExerciseBody), updateUserExercise);

// DELETE /api/user-exercises/:id - Remove user exercise assignment
router.delete('/:id', requireRecordOwner('userExercise'), removeUserExercise);

// DELETE /api/user-exercises/user/:userId/exercise/:exerciseId - Remove specific user from exercise
router.delete('/user/:userId/exercise/:exerciseId', requireSelfOrAdmin(), removeUserFromExercise);

export default router;
