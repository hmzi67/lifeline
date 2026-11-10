import { Router } from 'express';
import {
  getAppAccountToken,
  handleAppStoreServerNotification,
  syncInAppPurchase,
} from '../controllers/inAppPurchaseController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.get('/apple/account-token', authenticate, getAppAccountToken);
router.post('/sync', authenticate, syncInAppPurchase);
// Configure this URL in App Store Connect (App Store Server Notifications V2)
// for both Production and Sandbox.
router.post('/apple/notifications', handleAppStoreServerNotification);

export default router;
