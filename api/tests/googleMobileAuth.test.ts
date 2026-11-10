import { OAuth2Client, TokenPayload } from 'google-auth-library';
import jwt, { JwtPayload } from 'jsonwebtoken';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockTransaction = (operations: Promise<unknown>[] | ((tx: unknown) => unknown)) =>
  typeof operations === 'function' ? operations(mockPrisma) : Promise.all(operations);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ ...mockPrisma, $transaction: mockTransaction })),
}));

const {
  googleMobileAuth,
  refreshToken: refreshSession,
} = require('../src/controllers/authController') as typeof import('../src/controllers/authController');

type MockResponse = {
  statusCode: number;
  body: any;
  status: jest.Mock;
  json: jest.Mock;
  cookie: jest.Mock;
  set: jest.Mock;
};

const createResponse = (): MockResponse => {
  const response = {
    statusCode: 0,
    body: null,
  } as MockResponse;

  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: any) => {
    response.body = body;
    return response;
  });
  response.cookie = jest.fn(() => response);
  response.set = jest.fn(() => response);

  return response;
};

const mockGoogleToken = (overrides: Partial<TokenPayload> = {}) => {
  const payload: TokenPayload = {
    iss: 'https://accounts.google.com',
    aud: 'android-client',
    sub: 'google-subject',
    email: 'new.user@example.com',
    email_verified: true,
    name: 'New User',
    picture: 'https://images.example.test/avatar.png',
    iat: 1,
    exp: 2,
    ...overrides,
  };

  const verifyIdToken = jest.spyOn(
    OAuth2Client.prototype,
    'verifyIdToken',
  ) as unknown as jest.Mock;
  verifyIdToken.mockResolvedValue({ getPayload: () => payload });
  return verifyIdToken;
};

const selectedUser = {
  id: 'user-new',
  email: 'new.user@example.com',
  username: 'newuser',
  googleId: 'google-subject',
  profileImage: 'https://images.example.test/avatar.png',
  roleId: null,
  isEmailVerified: true,
  status: 'active',
};

describe('Google mobile authentication', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'web-client';
    process.env.GOOGLE_ANDROID_CLIENT_ID = 'android-client';
    for (const group of Object.values(mockPrisma)) {
      for (const mock of Object.values(group)) {
        mock.mockReset();
      }
    }
  });

  it('fails closed when no Google token audience is configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_ANDROID_CLIENT_ID;
    const verifyIdToken = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = createResponse();
    await googleMobileAuth(
      { body: { idToken: 'google-id-token' } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Google authentication is not configured',
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a token for an unconfigured audience without writing user data', async () => {
    const verifyIdToken = jest.spyOn(
      OAuth2Client.prototype,
      'verifyIdToken',
    ) as unknown as jest.Mock;
    verifyIdToken.mockRejectedValue(
      new Error('Wrong recipient, payload audience != requiredAudience'),
    );
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = createResponse();
    await googleMobileAuth(
      { body: { idToken: 'wrong-audience-token' } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Invalid or expired Google ID token',
    });
    expect(logError).toHaveBeenCalledWith(
      'Google ID token audience mismatch. Ensure GOOGLE_ANDROID_CLIENT_ID matches the mobile app EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('creates a first-time Google user and returns a refreshable session', async () => {
    const verifyIdToken = mockGoogleToken();
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValue(selectedUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh-record' });

    const response = createResponse();
    await googleMobileAuth(
      { body: { idToken: 'google-id-token' } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-id-token',
      audience: ['web-client', 'android-client'],
    });
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        username: 'newuser',
        email: 'new.user@example.com',
        profileImage: 'https://images.example.test/avatar.png',
        googleId: 'google-subject',
        isEmailVerified: true,
        status: 'active',
      },
    }));

    const { accessToken, refreshToken } = response.body.data;
    expect(jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload).toMatchObject({
      userId: 'user-new',
      email: 'new.user@example.com',
    });
    expect(jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload).toMatchObject({
      userId: 'user-new',
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        token: refreshToken,
        userId: 'user-new',
        expiresAt: expect.any(Date),
      },
    });

    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.refreshToken.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rotated-record', token: data.token }));
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'refresh-record',
      token: refreshToken,
      replacedById: null,
      user: {
        id: 'user-new',
        email: 'new.user@example.com',
        roleId: null,
      },
    });

    const refreshResponse = createResponse();
    await refreshSession(
      { body: { refreshToken }, cookies: {} } as any,
      refreshResponse as any,
    );

    expect(refreshResponse.statusCode).toBe(200);
    expect(jwt.verify(
      refreshResponse.body.data.accessToken,
      process.env.JWT_SECRET!,
    ) as JwtPayload).toMatchObject({
      userId: 'user-new',
      email: 'new.user@example.com',
    });

    // The refresh token is rotated so active sessions keep extending
    const rotatedRefreshToken = refreshResponse.body.data.refreshToken;
    expect(rotatedRefreshToken).toEqual(expect.any(String));
    expect(rotatedRefreshToken).not.toBe(refreshToken);
    expect(mockPrisma.refreshToken.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: {
        token: rotatedRefreshToken,
        userId: 'user-new',
        expiresAt: expect.any(Date),
      },
    }));
    // The old token stays valid, linked to its replacement until that is first used
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'refresh-record', replacedById: null },
      data: { replacedById: 'rotated-record' },
    });
  });

  it('logs in a returning Google user without creating or relinking the account', async () => {
    mockGoogleToken({
      email: 'returning@example.com',
      sub: 'existing-google-subject',
    });
    const existingUser = {
      ...selectedUser,
      id: 'user-existing',
      email: 'returning@example.com',
      googleId: 'existing-google-subject',
    };
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh-record' });

    const response = createResponse();
    await googleMobileAuth(
      { body: { idToken: 'returning-id-token' } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.data.user).toEqual(existingUser);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        token: response.body.data.refreshToken,
        userId: 'user-existing',
        expiresAt: expect.any(Date),
      },
    });
  });

  it('links Google to an existing email account before logging in', async () => {
    mockGoogleToken({ email: 'linked@example.com' });
    const existingUser = {
      ...selectedUser,
      id: 'user-linked',
      email: 'linked@example.com',
      googleId: null,
    };
    const linkedUser = {
      ...existingUser,
      googleId: 'google-subject',
    };
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    mockPrisma.user.update.mockResolvedValue(linkedUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh-record' });

    const response = createResponse();
    await googleMobileAuth(
      { body: { idToken: 'link-id-token' } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-linked' },
      data: { googleId: 'google-subject' },
    }));
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(response.body.data.user.googleId).toBe('google-subject');
  });
});
