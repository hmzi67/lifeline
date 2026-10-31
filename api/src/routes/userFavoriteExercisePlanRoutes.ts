import { Router } from 'express';
import {
    addFavoriteExercisePlan,
    getFavoriteExercisePlans,
    removeFavoriteExercisePlan,
} from '../controllers/userFavoriteExercisePlanController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// Always the authenticated user's own favourites; like diet plan favourites, no subscription needed.
router.use(authenticate);

// GET /api/favorite-exercise-plans - List the caller's favourite exercise plans
router.get('/', getFavoriteExercisePlans);

// POST /api/favorite-exercise-plans - Add an exercise plan to favourites
router.post('/', addFavoriteExercisePlan);

// DELETE /api/favorite-exercise-plans/:planId - Remove an exercise plan from favourites
router.delete('/:planId', removeFavoriteExercisePlan);

export default router;
