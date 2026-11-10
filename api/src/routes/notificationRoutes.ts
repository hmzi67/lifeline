import { Router } from 'express';
import {
    createMyNotification,
    deleteNotification,
    getMyNotifications,
    getUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
    sendNotificationToUser,
} from '../controllers/notificationController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { adminNotificationBody, myNotificationBody } from '../validators/trackingSchemas.js';

const router = Router();

// GET /api/notifications - Current user's notifications, newest first
router.get('/', authenticate, getMyNotifications);

// GET /api/notifications/unread-count - Badge count for the bell icon
router.get('/unread-count', authenticate, getUnreadCount);

// POST /api/notifications - Record a notification the app showed locally
router.post('/', authenticate, validateBody(myNotificationBody), createMyNotification);

// POST /api/notifications/send - Admin: notify a user (stored + pushed)
router.post('/send', authenticate, authorize(['admin']), validateBody(adminNotificationBody), sendNotificationToUser);

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authenticate, markAllNotificationsRead);

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', authenticate, markNotificationRead);

// DELETE /api/notifications/:id - Delete one
router.delete('/:id', authenticate, deleteNotification);

export default router;
