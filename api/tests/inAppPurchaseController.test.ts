export {};

const mockGetOrCreateAppAccountToken = jest.fn();
const mockHandleAppStoreNotification = jest.fn();
const mockSyncAppStoreTransactions = jest.fn();

jest.mock('../src/services/appStoreService', () => ({
  AppStoreServiceError: class AppStoreServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getOrCreateAppAccountToken: mockGetOrCreateAppAccountToken,
  handleAppStoreNotification: mockHandleAppStoreNotification,
  syncAppStoreTransactions: mockSyncAppStoreTransactions,
}));

const {
  getAppAccountToken,
  handleAppStoreServerNotification,
  syncInAppPurchase,
} = require('../src/controllers/inAppPurchaseController') as typeof import('../src/controllers/inAppPurchaseController');
const { AppStoreServiceError } = require('../src/services/appStoreService');

const createResponse = () => {
  const response: any = { body: null, statusCode: 0 };
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
};

const authed = (body: unknown = {}) => ({ body, user: { id: 'user-one' } });

describe('In-app purchase controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncAppStoreTransactions.mockResolvedValue({ active: true });
  });

  it('requires authentication for the account token', async () => {
    const response = createResponse();

    await getAppAccountToken({ body: {} } as any, response);

    expect(response.statusCode).toBe(401);
    expect(mockGetOrCreateAppAccountToken).not.toHaveBeenCalled();
  });

  it('returns the StoreKit appAccountToken', async () => {
    mockGetOrCreateAppAccountToken.mockResolvedValue('6f1c3c1e-8a52-4d5c-9a53-0d0c3b5f4c11');
    const response = createResponse();

    await getAppAccountToken(authed() as any, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual({ appAccountToken: '6f1c3c1e-8a52-4d5c-9a53-0d0c3b5f4c11' });
  });

  it('passes signed transactions to the sync service', async () => {
    const response = createResponse();

    await syncInAppPurchase(authed({ signedTransactions: ['jws-a', 'jws-b'] }) as any, response);

    expect(response.statusCode).toBe(200);
    expect(mockSyncAppStoreTransactions).toHaveBeenCalledWith('user-one', ['jws-a', 'jws-b']);
  });

  it('accepts a single signedTransaction and an empty body', async () => {
    await syncInAppPurchase(authed({ signedTransaction: 'jws-a' }) as any, createResponse());
    await syncInAppPurchase(authed(undefined) as any, createResponse());

    expect(mockSyncAppStoreTransactions).toHaveBeenNthCalledWith(1, 'user-one', ['jws-a']);
    expect(mockSyncAppStoreTransactions).toHaveBeenNthCalledWith(2, 'user-one', []);
  });

  it('rejects malformed transaction lists', async () => {
    const response = createResponse();

    await syncInAppPurchase(authed({ signedTransactions: [42] }) as any, response);

    expect(response.statusCode).toBe(400);
    expect(mockSyncAppStoreTransactions).not.toHaveBeenCalled();
  });

  it('maps service errors to their status code', async () => {
    mockSyncAppStoreTransactions.mockRejectedValue(new AppStoreServiceError('Linked elsewhere', 409));
    const response = createResponse();

    await syncInAppPurchase(authed({ signedTransactions: ['jws-a'] }) as any, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ success: false, message: 'Linked elsewhere' });
  });

  it('rejects notifications without a signed payload', async () => {
    const response = createResponse();

    await handleAppStoreServerNotification({ body: {} } as any, response);

    expect(response.statusCode).toBe(400);
    expect(mockHandleAppStoreNotification).not.toHaveBeenCalled();
  });

  it('acknowledges verified notifications', async () => {
    mockHandleAppStoreNotification.mockResolvedValue({ handled: true, notificationType: 'DID_RENEW' });
    const response = createResponse();

    await handleAppStoreServerNotification({ body: { signedPayload: 'signed' } } as any, response);

    expect(mockHandleAppStoreNotification).toHaveBeenCalledWith('signed');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ received: true, handled: true, notificationType: 'DID_RENEW' });
  });

  it('returns an error status so Apple retries failed notifications', async () => {
    mockHandleAppStoreNotification.mockRejectedValue(new AppStoreServiceError('Apple down', 503));
    const response = createResponse();

    await handleAppStoreServerNotification({ body: { signedPayload: 'signed' } } as any, response);

    expect(response.statusCode).toBe(503);
  });
});
