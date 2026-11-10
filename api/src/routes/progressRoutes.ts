import { Router } from 'express';
import {
  getCaloriesIntake,
  getExerciseActiveDays,
  getMedicationStats,
  getUserChallengeProgress,
  getProgressSummary,
} from '../controllers/progressController.js';
import authenticate from '../middleware/authenticate.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';

const router = Router();

// Progress analytics are part of Lifeline VIP. Apply the check before any
// controller can load user-specific metrics.
router.use(authenticate, requireActiveLicense);

// Full progress summary (all stats in one call)
router.get('/summary', getProgressSummary);

// Calories intake aggregation
router.get('/calories-intake', getCaloriesIntake);

// Exercise active days - weekly summary
router.get('/exercise-active-days', getExerciseActiveDays);

// Medication stats / adherence
router.get('/medication-stats', getMedicationStats);

// User challenge progress
router.get('/challenges', getUserChallengeProgress);

export default router;
