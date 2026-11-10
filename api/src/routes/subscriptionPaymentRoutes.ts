import { Router } from 'express';
import {
    createSubscriptionPayment,
    deleteSubscriptionPayment,
    getAllSubscriptionPayments,
    getMySubscriptionPayments,
    getPaymentsByUserId,
    getSubscriptionPaymentById,
    updateSubscriptionPayment
} from '../controllers/subscriptionPaymentController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// Authenticated users may only read their own payment history.
router.get('/me', authenticate, getMySubscriptionPayments);

// Payment administration is restricted to admins. Payment status is still
// provider-controlled and cannot be set through these CRUD endpoints.
router.get('/', authenticate, authorize(['admin']), getAllSubscriptionPayments);

// Get all payments for a specific user
router.get('/user/:userId', authenticate, authorize(['admin']), getPaymentsByUserId);

// Get a specific subscription payment by ID
router.get('/:id', authenticate, authorize(['admin']), getSubscriptionPaymentById);

// Create a new subscription payment
router.post('/', authenticate, authorize(['admin']), createSubscriptionPayment);

// Update a subscription payment
router.put('/:id', authenticate, authorize(['admin']), updateSubscriptionPayment);

// Delete a subscription payment
router.delete('/:id', authenticate, authorize(['admin']), deleteSubscriptionPayment);

export default router;
