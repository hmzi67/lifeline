import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { createNotification } from '../services/notificationService.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const getUserId = (req: Request) => (req as AuthenticatedRequest).user?.id;

// GET /api/notifications?limit=&before= — newest first; `before` is an ISO date cursor
export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const requestedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
      message: 'Notifications retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('Error counting notifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/notifications — the app records its own notifications (e.g. local reminders)
export const createMyNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { title, body, type, data } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || title.length > 150) {
      res.status(400).json({ success: false, message: 'title is required (max 150 characters)' });
      return;
    }
    if (body !== undefined && body !== null && typeof body !== 'string') {
      res.status(400).json({ success: false, message: 'body must be a string' });
      return;
    }
    if (type !== undefined && (typeof type !== 'string' || type.length > 50)) {
      res.status(400).json({ success: false, message: 'type must be a string (max 50 characters)' });
      return;
    }

    // The app already showed this notification on the device, so don't push it again.
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: title.trim(),
        body: body ?? null,
        type: type ?? 'general',
        data: data && typeof data === 'object' ? data : undefined,
      },
    });

    res.status(201).json({ success: true, data: notification, message: 'Notification created' });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.status(200).json({ success: true, data: { updated: result.count } });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/notifications/:id/read
export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Scoping by userId means another user's notification is simply "not found".
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await prisma.notification.count({ where: { id: req.params.id, userId } });
      if (!exists) {
        res.status(404).json({ success: false, message: 'Notification not found' });
        return;
      }
    }

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await prisma.notification.deleteMany({ where: { id: req.params.id, userId } });
    if (result.count === 0) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/notifications/send (admin) — notify a user from the admin panel or ops scripts
export const sendNotificationToUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, title, body, type, data } = req.body ?? {};
    if (typeof userId !== 'string' || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, message: 'userId and title are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const notification = await createNotification(userId, {
      title: title.trim().slice(0, 150),
      body: typeof body === 'string' ? body : null,
      type: typeof type === 'string' ? type.slice(0, 50) : 'general',
      data: data && typeof data === 'object' ? data : undefined,
    });

    res.status(201).json({ success: true, data: notification, message: 'Notification sent' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
