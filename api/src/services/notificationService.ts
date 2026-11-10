import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { isExpoPushToken, sendFcm } from './fcmService.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotificationInput {
  title: string;
  body?: string | null;
  type?: string;
  data?: Prisma.InputJsonValue;
}

// Push settings are stored per user in app_settings (see userController).
const getPushTarget = async (userId: string): Promise<string | null> => {
  const scope = `user:${userId}`;
  const settings = await prisma.appSetting.findMany({
    where: { scope, key: { in: ['push_token', 'notifications_enabled'] } },
  });
  const valueByKey = new Map(settings.map(setting => [setting.key, setting.value]));

  // Notifications default to enabled until the user turns them off.
  if (valueByKey.get('notifications_enabled') === 'false') return null;
  return valueByKey.get('push_token') || null;
};

// The app was uninstalled or signed out on that device. Only removes the token that failed,
// in case the user registered a new one meanwhile.
const forgetPushToken = async (userId: string, token: string) => {
  await prisma.appSetting.deleteMany({ where: { scope: `user:${userId}`, key: 'push_token', value: token } });
};

const sendExpoPush = async (to: string, input: NotificationInput, notificationId: string) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      title: input.title,
      body: input.body ?? undefined,
      sound: 'default',
      data: { notificationId, type: input.type ?? 'general', ...((input.data as object) ?? {}) },
    }),
  });

  if (!response.ok) {
    throw new Error(`Expo push failed with status ${response.status}`);
  }
};

/**
 * Store a notification in the user's inbox and, when they have notifications
 * enabled and a registered device, deliver it as a push notification too.
 * Push delivery is best-effort: a failure is logged but never thrown.
 */
export const createNotification = async (userId: string, input: NotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title: input.title,
      body: input.body ?? null,
      type: input.type ?? 'general',
      data: input.data,
    },
  });

  try {
    const pushToken = await getPushTarget(userId);
    if (pushToken && isExpoPushToken(pushToken)) {
      // Registered by an app build from before FCM.
      await sendExpoPush(pushToken, input, notification.id);
    } else if (pushToken) {
      const result = await sendFcm(pushToken, {
        title: input.title,
        body: input.body ?? undefined,
        data: { notificationId: notification.id, type: input.type ?? 'general', ...((input.data as object) ?? {}) },
      });
      if (result === 'invalid-token') await forgetPushToken(userId, pushToken);
    }
  } catch (error) {
    console.error('Push notification delivery error:', error);
  }

  return notification;
};

/** Like createNotification, but never throws — for side effects of other actions. */
export const notifyUser = async (userId: string, input: NotificationInput) => {
  try {
    await createNotification(userId, input);
  } catch (error) {
    console.error('Create notification error:', error);
  }
};
