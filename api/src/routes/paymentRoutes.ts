import { Router } from 'express';
import {
  confirmSubscriptionPayment,
  createSubscription,
  getPublishableKey,
} from '../controllers/paymentController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// Payments are always priced on the server from a pricing plan (and an optional coupon).

// Create recurring subscription
router.post('/subscriptions', authenticate, createSubscription);

// Confirm recurring subscription first payment
router.post('/subscriptions/confirm', authenticate, confirmSubscriptionPayment);

// Get Stripe publishable key
router.get('/publishable-key', getPublishableKey);

export default router;
