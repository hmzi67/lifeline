import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { createNotification } from '../services/notificationService.js';
import { SUSPENDED_STATUSES } from '../utils/accountAccess.js';

const router = Router();
router.use(authenticate, authorize(['admin']));

export const ANNOUNCEMENT_TYPE = 'announcement';

/**
 * Screens an announcement may open when tapped. Each must be allowed in the app both for push
 * taps (VALID_NOTIFICATION_ROUTES in app/_layout.tsx) and in the inbox drawer
 * (KNOWN_ROUTES in components/NotificationDrawer.tsx), or the tap just opens the app.
 */
export const ANNOUNCEMENT_SCREENS: Record<string, string> = {
  '/(tabs)/diet': 'Diet',
  '/(main)/meditation': 'Meditation',
  '/(main)/Analysis': 'Sleep',
  '/(tabs)/Progress': 'Progress',
  '/waterIntake': 'Water intake',
  '/(main)/Medication': 'Medication',
  '/(main)/Fasting': 'Fasting',
};

const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(150, 'The title must be 150 characters or fewer'),
  body: z.string().trim().max(1000, 'The message must be 1000 characters or fewer').optional().nullable(),
  screen: z.string().refine(screen => screen in ANNOUNCEMENT_SCREENS, 'Unknown screen').optional().nullable(),
});

const BATCH_SIZE = 25;

/** Inbox entry plus push for each user, a batch at a time so pushes don't all go out at once. */
export const deliverAnnouncement = async (userIds: string[], input: { title: string; body?: string | null; screen?: string | null }) => {
  let failed = 0;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const results = await Promise.allSettled(userIds.slice(i, i + BATCH_SIZE).map(userId =>
      createNotification(userId, {
        title: input.title,
        body: input.body || null,
        type: ANNOUNCEMENT_TYPE,
        ...(input.screen ? { data: { screen: input.screen } } : {}),
      })));
    failed += results.filter(r => r.status === 'rejected').length;
  }
  if (failed) console.error(`Announcement "${input.title}": ${failed} of ${userIds.length} could not be saved`);
};

// GET /api/admin/notifications/screens - Screens an announcement can open
router.get('/screens', (_req: Request, res: Response) => {
  res.json({ success: true, data: Object.entries(ANNOUNCEMENT_SCREENS).map(([value, label]) => ({ value, label })) });
});

// GET /api/admin/notifications/announcements - Recent announcements and how many users got each
router.get('/announcements', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.notification.groupBy({
      by: ['title', 'body'],
      where: { type: ANNOUNCEMENT_TYPE },
      _count: { _all: true },
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      take: 20,
    });
    res.json({
      success: true,
      data: groups.map(g => ({ title: g.title, body: g.body, recipients: g._count._all, sentAt: g._min.createdAt })),
    });
  } catch (error) {
    console.error('Error listing announcements:', error);
    res.status(500).json({ success: false, message: 'Failed to load announcements' });
  }
});

// POST /api/admin/notifications/broadcast { title, body?, screen? } - Send to every active user
router.post('/broadcast', async (req: Request, res: Response) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid announcement' });
    return;
  }
  try {
    // Verified accounts that aren't suspended or blocked.
    const users = await prisma.user.findMany({
      where: { isEmailVerified: true, OR: [{ status: null }, { status: { notIn: [...SUSPENDED_STATUSES] } }] },
      select: { id: true },
    });
    const userIds = users.map(u => u.id);
    // Answer now; delivery to a large audience continues in the background.
    res.status(202).json({ success: true, data: { recipients: userIds.length }, message: `Sending to ${userIds.length} users` });
    void deliverAnnouncement(userIds, parsed.data).catch(error => console.error('Announcement delivery failed:', error));
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to send the announcement' });
  }
});

export default router;
