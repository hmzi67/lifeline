export {};

const mockPrisma = {
  sleepSound: { findUnique: jest.fn() },
  sleepStory: { findUnique: jest.fn() },
  userFavoriteSleepItem: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  addFavoriteSleepItem,
  getFavoriteSleepItems,
  removeFavoriteSleepItem,
} from '../src/controllers/userFavoriteSleepItemController';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const request = (overrides: Record<string, unknown> = {}) =>
  ({ user: { id: 'user-1', role: 'user' }, params: {}, body: {}, ...overrides }) as any;

const soundRow = {
  id: 'fav-1',
  soundId: 'sound-1',
  storyId: null,
  favoritedAt: new Date('2026-11-04T10:00:00Z'),
  sound: { id: 'sound-1', name: 'Rain', description: 'Soft rain', image: null, soundUrl: 'https://x/rain.mp3', duration: 10 },
  story: null,
};

const storyRow = {
  id: 'fav-2',
  soundId: null,
  storyId: 'story-1',
  favoritedAt: new Date('2026-11-04T09:00:00Z'),
  sound: null,
  story: { id: 'story-1', title: 'The Lighthouse', description: null, image: 'https://x/l.jpg', audioUrl: 'https://x/l.mp3', duration: 20 },
};

describe('favourite sleep sounds and stories', () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists only the caller's favourites in one shape for sounds and stories", async () => {
    mockPrisma.userFavoriteSleepItem.findMany.mockResolvedValue([soundRow, storyRow]);
    const res = mockResponse();

    await getFavoriteSleepItems(request(), res);

    expect(mockPrisma.userFavoriteSleepItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    const { data } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({ type: 'sound', itemId: 'sound-1', item: { title: 'Rain', audioUrl: 'https://x/rain.mp3' } });
    expect(data[1]).toMatchObject({ type: 'story', itemId: 'story-1', item: { title: 'The Lighthouse', audioUrl: 'https://x/l.mp3' } });
  });

  it('adds a sound for the caller without failing on a repeat', async () => {
    mockPrisma.sleepSound.findUnique.mockResolvedValue({ id: 'sound-1' });
    mockPrisma.userFavoriteSleepItem.upsert.mockResolvedValue(soundRow);
    const res = mockResponse();

    await addFavoriteSleepItem(request({ body: { type: 'sound', itemId: 'sound-1' } }), res);

    expect(mockPrisma.userFavoriteSleepItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_soundId: { userId: 'user-1', soundId: 'sound-1' } },
      create: { userId: 'user-1', soundId: 'sound-1' },
      update: {},
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('adds a story against the story id, not the sound id', async () => {
    mockPrisma.sleepStory.findUnique.mockResolvedValue({ id: 'story-1' });
    mockPrisma.userFavoriteSleepItem.upsert.mockResolvedValue(storyRow);
    const res = mockResponse();

    await addFavoriteSleepItem(request({ body: { type: 'story', itemId: 'story-1' } }), res);

    expect(mockPrisma.sleepSound.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.userFavoriteSleepItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'user-1', storyId: 'story-1' },
    }));
  });

  it('rejects a missing or unknown type', async () => {
    for (const body of [{ itemId: 'sound-1' }, { type: 'meditation', itemId: 'm-1' }, { type: 'sound' }]) {
      const res = mockResponse();
      await addFavoriteSleepItem(request({ body }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mockPrisma.userFavoriteSleepItem.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 for a sound that does not exist', async () => {
    mockPrisma.sleepSound.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await addFavoriteSleepItem(request({ body: { type: 'sound', itemId: 'gone' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.userFavoriteSleepItem.upsert).not.toHaveBeenCalled();
  });

  it("removes only the caller's own favourite", async () => {
    mockPrisma.userFavoriteSleepItem.deleteMany.mockResolvedValue({ count: 1 });
    const res = mockResponse();

    await removeFavoriteSleepItem(request({ params: { type: 'story', itemId: 'story-1' } }), res);

    expect(mockPrisma.userFavoriteSleepItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', storyId: 'story-1' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('requires a signed-in user', async () => {
    const res = mockResponse();
    await getFavoriteSleepItems(request({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockPrisma.userFavoriteSleepItem.findMany).not.toHaveBeenCalled();
  });
});
