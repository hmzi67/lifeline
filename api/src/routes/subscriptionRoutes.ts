import { Router } from 'express';
import { getSubscriptionStatus, startFreeWeekAccess } from '../controllers/subscriptionController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getSubscriptionStatus);
router.post('/free-week', authenticate, startFreeWeekAccess);

export default router;
