import { Router } from 'express';
import {
  getOnboardingProgress,
  updateOnboardingProgress,
} from '../controllers/onboardingProgressController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.get('/', getOnboardingProgress);
router.patch('/', updateOnboardingProgress);

export default router;
