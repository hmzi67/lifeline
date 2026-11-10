export {};

const mockPrisma = {
  meditation: {
    findUnique: jest.fn(),
  },
  meditationSession: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  userFavoriteMeditation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { getMeditationById } = require('../src/controllers/meditationController') as typeof import('../src/controllers/meditationController');
const {
  getMeditationSessionById,
  getMeditationSessions,
} = require('../src/controllers/meditationSessionController') as typeof import('../src/controllers/meditationSessionController');
const {
  addFavoriteMeditation,
  checkFavoriteMeditation,
  getUserFavoriteMeditations,
  removeFavoriteMeditation,
} = require('../src/controllers/userFavoriteMeditationController') as typeof import('../src/controllers/userFavoriteMeditationController');

type MockResponse = {
  statusCode: number;
  body: any;
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = (): MockResponse => {
  const response = { statusCode: 0, body: null } as MockResponse;
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: any) => {
    response.body = body;
    return response;
  });
  return response;
};

const authenticatedRequest = (
  overrides: Record<string, unknown> = {},
  role = '',
) => ({
  body: {},
  params: {},
  user: { id: 'user-one', email: 'user@example.com', role },
  ...overrides,
});

describe('meditation controller data security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not load user routines or user PII with meditation details', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'meditation-one' });
    const response = createResponse();

    await getMeditationById(
      { params: { id: 'meditation-one' } } as any,
      response as any,
    );

    // Only the meditation and its sessions' ids and lengths (for `duration`); no user data.
    expect(mockPrisma.meditation.findUnique).toHaveBeenCalledWith({
      where: { id: 'meditation-one' },
      include: { meditationSessions: { select: { id: true, durationMinutes: true }, orderBy: { durationMinutes: 'asc' } } },
    });
    expect(response.body.data).toEqual({ id: 'meditation-one', duration: null });
  });

  it('does not load other users favorites with meditation session lists', async () => {
    mockPrisma.meditationSession.findMany.mockResolvedValue([]);
    const response = createResponse();

    await getMeditationSessions(
      { params: { meditationId: 'meditation-one' } } as any,
      response as any,
    );

    expect(mockPrisma.meditationSession.findMany).toHaveBeenCalledWith({
      where: { meditationId: 'meditation-one' },
      include: { meditation: true },
    });
  });

  it('does not load other users favorites with individual meditation sessions', async () => {
    mockPrisma.meditationSession.findUnique.mockResolvedValue({ id: 'session-one' });
    const response = createResponse();

    await getMeditationSessionById(
      { params: { id: 'session-one' } } as any,
      response as any,
    );

    expect(mockPrisma.meditationSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-one' },
      include: { meditation: true },
    });
  });
});

describe('favorite meditation ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-admin reading another users favorites', async () => {
    const response = createResponse();

    await getUserFavoriteMeditations(
      authenticatedRequest({ params: { userId: 'user-two' } }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.userFavoriteMeditation.findMany).not.toHaveBeenCalled();
  });

  it('uses the authenticated user for the canonical favorites collection', async () => {
    mockPrisma.userFavoriteMeditation.findMany.mockResolvedValue([]);
    const response = createResponse();

    await getUserFavoriteMeditations(authenticatedRequest() as any, response as any);

    expect(mockPrisma.userFavoriteMeditation.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-one' },
      select: {
        id: true,
        sessionId: true,
        favoritedAt: true,
        session: { include: { meditation: true } },
      },
      orderBy: { favoritedAt: 'desc' },
    });
  });

  it('ignores a caller supplied user ID when creating a favorite', async () => {
    mockPrisma.meditationSession.findUnique.mockResolvedValue({ id: 'session-one' });
    mockPrisma.userFavoriteMeditation.findFirst.mockResolvedValue(null);
    mockPrisma.userFavoriteMeditation.create.mockResolvedValue({ id: 'favorite-one' });
    const response = createResponse();

    await addFavoriteMeditation(
      authenticatedRequest({
        body: {
          sessionId: 'session-one',
          userId: 'user-two',
        },
      }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(201);
    expect(mockPrisma.userFavoriteMeditation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-one',
        sessionId: 'session-one',
      }),
    }));
  });

  it('does not let a consumer create missing meditation-session catalog data', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'meditation-one' });
    mockPrisma.meditationSession.findFirst.mockResolvedValue(null);
    const response = createResponse();

    await addFavoriteMeditation(
      authenticatedRequest({ body: { meditationId: 'meditation-one' } }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.meditationSession.create).not.toHaveBeenCalled();
    expect(mockPrisma.userFavoriteMeditation.create).not.toHaveBeenCalled();
  });

  it('rejects deletion of another users favorite', async () => {
    mockPrisma.userFavoriteMeditation.findUnique.mockResolvedValue({
      id: 'favorite-one',
      userId: 'user-two',
    });
    const response = createResponse();

    await removeFavoriteMeditation(
      authenticatedRequest({ params: { id: 'favorite-one' } }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.userFavoriteMeditation.delete).not.toHaveBeenCalled();
  });

  it('allows an admin to delete another users favorite', async () => {
    mockPrisma.userFavoriteMeditation.findUnique.mockResolvedValue({
      id: 'favorite-one',
      userId: 'user-two',
    });
    mockPrisma.userFavoriteMeditation.delete.mockResolvedValue({ id: 'favorite-one' });
    const response = createResponse();

    await removeFavoriteMeditation(
      authenticatedRequest({ params: { id: 'favorite-one' } }, 'admin') as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.userFavoriteMeditation.delete).toHaveBeenCalledWith({
      where: { id: 'favorite-one' },
    });
  });

  it('rejects a non-admin checking another users favorite state', async () => {
    const response = createResponse();

    await checkFavoriteMeditation(
      authenticatedRequest({
        params: { userId: 'user-two', sessionId: 'session-one' },
      }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.userFavoriteMeditation.findFirst).not.toHaveBeenCalled();
  });
});
