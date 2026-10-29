export {};

const mockPrisma: any = {
  notification: { create: jest.fn() },
  appSetting: { findMany: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn((args: unknown) => args) },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(() => ({ getAccessToken: jest.fn(async () => 'test-access-token') })),
  OAuth2Client: jest.fn(),
}));

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  project_id: 'lifeline-test',
  client_email: 'push@lifeline-test.iam.gserviceaccount.com',
  private_key: 'not-a-real-key',
});

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const { config } = require('../src/config/index') as typeof import('../src/config/index');
const { createNotification } = require('../src/services/notificationService') as typeof import('../src/services/notificationService');
const { registerPushToken } = require('../src/controllers/userController') as typeof import('../src/controllers/userController');

const FCM_TOKEN = 'fcm-device-token:APA91b-example';
const EXPO_TOKEN = 'ExponentPushToken[abc123]';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const storedSettings = (pushToken: string | null, enabled = true) => {
  mockPrisma.appSetting.findMany.mockResolvedValue([
    ...(pushToken ? [{ key: 'push_token', value: pushToken }] : []),
    { key: 'notifications_enabled', value: String(enabled) },
  ]);
};

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const authed = (body: unknown) => ({
  headers: { authorization: `Bearer ${jwt.sign({ userId: 'user-1' }, config.jwt.secret)}` },
  body,
}) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});

describe('push delivery', () => {
  it('sends to an FCM token through the FCM v1 API, with string data the app can route on', async () => {
    storedSettings(FCM_TOKEN);

    await createNotification('user-1', {
      title: 'Challenge approved',
      body: 'Your challenge is live',
      type: 'challenge',
      data: { screen: '/(main)/ChallengeSpace', challengeId: 42 },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/lifeline-test/messages:send');
    expect(init.headers.Authorization).toBe('Bearer test-access-token');
    const { message } = JSON.parse(init.body);
    expect(message.token).toBe(FCM_TOKEN);
    expect(message.notification).toEqual({ title: 'Challenge approved', body: 'Your challenge is live' });
    expect(message.data).toEqual({
      notificationId: 'notif-1',
      type: 'challenge',
      screen: '/(main)/ChallengeSpace',
      challengeId: '42',
    });
    expect(message.android.notification.channel_id).toBe('default');
  });

  it('keeps sending Expo tokens from older app builds through Expo', async () => {
    storedSettings(EXPO_TOKEN);

    await createNotification('user-1', { title: 'Hi' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://exp.host/--/api/v2/push/send');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).to).toBe(EXPO_TOKEN);
  });

  it('forgets a token FCM reports as unregistered, and only that token', async () => {
    storedSettings(FCM_TOKEN);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }),
    });

    const notification = await createNotification('user-1', { title: 'Hi' });

    expect(notification.id).toBe('notif-1');
    expect(mockPrisma.appSetting.deleteMany).toHaveBeenCalledWith({
      where: { scope: 'user:user-1', key: 'push_token', value: FCM_TOKEN },
    });
  });

  it('keeps the token and the inbox notification when FCM fails for another reason', async () => {
    storedSettings(FCM_TOKEN);
    mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { status: 'UNAVAILABLE' } }) });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const notification = await createNotification('user-1', { title: 'Hi' });

    expect(notification.id).toBe('notif-1');
    expect(mockPrisma.appSetting.deleteMany).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('sends nothing when the user turned notifications off', async () => {
    storedSettings(FCM_TOKEN, false);

    await createNotification('user-1', { title: 'Hi' });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('POST /api/user/push-token', () => {
  it('stores an FCM token', async () => {
    const res = createResponse();
    await registerPushToken(authed({ pushToken: FCM_TOKEN, platform: 'android' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user:user-1:push_token' },
      update: expect.objectContaining({ value: FCM_TOKEN }),
    }));
  });

  it('still accepts the Expo token field sent by older app builds', async () => {
    const res = createResponse();
    await registerPushToken(authed({ expoPushToken: EXPO_TOKEN, platform: 'ios' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ value: EXPO_TOKEN }),
    }));
  });

  it('rejects a missing or non-string token', async () => {
    for (const body of [{}, { pushToken: 123 }, { pushToken: '  ' }]) {
      const res = createResponse();
      await registerPushToken(authed(body), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('does not answer 401 on a server error, which would sign the user out', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = createResponse();

    await registerPushToken(authed({ pushToken: FCM_TOKEN }), res);

    expect(res.statusCode).toBe(500);
    consoleError.mockRestore();
  });
});
