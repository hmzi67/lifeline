import { Router } from 'express';
import {
  getAppAccountToken,
  handleAppStoreServerNotification,
  syncInAppPurchase,
} from '../controllers/inAppPurchaseController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { appStoreNotificationBody, inAppPurchaseSyncBody } from '../validators/trackingSchemas.js';

const router = Router();

router.get('/apple/account-token', authenticate, getAppAccountToken);
router.post('/sync', authenticate, validateBody(inAppPurchaseSyncBody), syncInAppPurchase);
// Configure this URL in App Store Connect (App Store Server Notifications V2)
// for both Production and Sandbox.
router.post('/apple/notifications', validateBody(appStoreNotificationBody), handleAppStoreServerNotification);

export default router;
