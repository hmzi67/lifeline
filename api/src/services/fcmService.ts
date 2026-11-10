import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

/**
 * Firebase Cloud Messaging (HTTP v1). Credentials come from a Firebase service account:
 * FIREBASE_SERVICE_ACCOUNT_JSON (the JSON itself) or FIREBASE_SERVICE_ACCOUNT_PATH (a path to it).
 */
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FcmMessage {
  title: string;
  body?: string;
  /** FCM data values must be strings; anything else is sent as JSON. */
  data?: Record<string, unknown>;
}

/** `invalid-token`: the device uninstalled the app or rotated its token, so it should be forgotten. */
export type FcmSendResult = 'sent' | 'invalid-token';

let client: { auth: GoogleAuth; projectId: string } | null | undefined;

const readServiceAccount = (): ServiceAccount | null => {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!inline && !path) return null;
  try {
    const account = JSON.parse(inline || readFileSync(path!, 'utf8')) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error('incomplete');
    return account;
  } catch {
    console.error('Firebase service account could not be read; push notifications through FCM are off.');
    return null;
  }
};

const getClient = () => {
  if (client === undefined) {
    const account = readServiceAccount();
    client = account
      ? {
          projectId: account.project_id,
          auth: new GoogleAuth({
            credentials: { client_email: account.client_email, private_key: account.private_key },
            scopes: [FCM_SCOPE],
          }),
        }
      : null;
  }
  return client;
};

export const isFcmConfigured = (): boolean => getClient() !== null;

/** Expo push tokens ("ExponentPushToken[…]") come from app builds without Firebase. */
export const isExpoPushToken = (token: string): boolean => /^Expo(nent)?PushToken\[.+\]$/.test(token);

const toDataStrings = (data: Record<string, unknown> = {}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
  );

interface FcmErrorBody {
  error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
}

// FCM reports a dead token as UNREGISTERED (404), or as INVALID_ARGUMENT naming the token.
const isInvalidTokenError = (status: number, body: FcmErrorBody) =>
  status === 404 ||
  body.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED') ||
  (body.error?.status === 'INVALID_ARGUMENT' && /registration token/i.test(body.error.message ?? ''));

/** Sends one notification to one device. Throws on configuration or delivery errors. */
export const sendFcm = async (token: string, message: FcmMessage): Promise<FcmSendResult> => {
  const fcm = getClient();
  if (!fcm) throw new Error('FCM is not configured (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH)');

  const accessToken = await fcm.auth.getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        data: toDataStrings(message.data),
        // "default" is the channel the app creates (expo-notifications).
        android: { priority: 'HIGH', notification: { channel_id: 'default', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
  });

  if (response.ok) return 'sent';
  const body = (await response.json().catch(() => ({}))) as FcmErrorBody;
  if (isInvalidTokenError(response.status, body)) return 'invalid-token';
  throw new Error(`FCM send failed with status ${response.status}${body.error?.status ? ` (${body.error.status})` : ''}`);
};

/** For tests: forget the cached credentials so env changes take effect. */
export const resetFcmClientForTests = () => {
  client = undefined;
};
