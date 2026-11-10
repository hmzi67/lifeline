export {};

const tx: any = {
  meditation: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
  meditationSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};
const mockPrisma: any = {
  meditation: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  meditationSession: { deleteMany: jest.fn() },
  userDailyRoutine: { count: jest.fn() },
  userFavoriteMeditation: { count: jest.fn() },
  userMeditationLog: { count: jest.fn() },
  challenge: { findUnique: jest.fn() },
  exercise: { count: jest.fn() },
  dietPlan: { count: jest.fn() },
  challengeExercise: { deleteMany: jest.fn(), createMany: jest.fn() },
  challengeDiet: { deleteMany: jest.fn(), createMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { groupBy: jest.fn() },
  $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
};
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma), Prisma: {} }));
const mockCreateNotification = jest.fn();
jest.mock('../src/services/notificationService', () => ({ createNotification: (...a: unknown[]) => mockCreateNotification(...a) }));

import { createMeditation, deleteMeditation, getMeditations, updateMeditation } from '../src/controllers/meditationController';
import { setChallengeContent } from '../src/controllers/challengeContentController';
import { deliverAnnouncement } from '../src/routes/adminNotificationRoutes';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const req = (params: Record<string, string>, body: unknown = {}, query: unknown = {}) => ({ params, body, query }) as any;

beforeEach(() => jest.clearAllMocks());

describe('meditations from the admin', () => {
  it('saves description, image and a session with the duration, so the app can favourite and time it', async () => {
    mockPrisma.meditation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'm1', ...data, meditationSessions: [{ id: 's1', durationMinutes: 12 }] }));
    const res = mockResponse();

    await createMeditation(req({}, { name: 'Calm', type: 'Sleep', soundUrl: 'https://x/a.mp3', description: ' Breathe ', image: 'https://x/i.jpg', durationMinutes: '12' }), res);

    expect(mockPrisma.meditation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: 'Breathe', image: 'https://x/i.jpg', meditationSessions: { create: { durationMinutes: 12 } } }),
    }));
    expect(res.json.mock.calls[0][0].data).toMatchObject({ id: 'm1', duration: 12 });
    expect(res.json.mock.calls[0][0].data.meditationSessions).toBeUndefined();
  });

  it('rejects a duration that is not whole minutes', async () => {
    const res = mockResponse();
    await createMeditation(req({}, { name: 'Calm', type: 'Sleep', soundUrl: 'u', durationMinutes: 'ten' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.meditation.create).not.toHaveBeenCalled();
  });

  it('lists each meditation with the shortest session length as duration', async () => {
    mockPrisma.meditation.findMany.mockResolvedValue([
      { id: 'm1', name: 'A', meditationSessions: [{ id: 's0', durationMinutes: null }, { id: 's1', durationMinutes: 5 }] },
      { id: 'm2', name: 'B', meditationSessions: [] },
    ]);
    mockPrisma.meditation.count.mockResolvedValue(2);
    const res = mockResponse();

    await getMeditations(req({}, {}, {}), res);

    expect(res.json.mock.calls[0][0].data.map((m: any) => m.duration)).toEqual([5, null]);
  });

  it('gives a meditation without a session one when it is edited', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'm1', name: 'A', type: 'Sleep', soundUrl: 'u' });
    tx.meditationSession.findFirst.mockResolvedValue(null);
    tx.meditation.findUniqueOrThrow.mockResolvedValue({ id: 'm1', meditationSessions: [{ id: 's1', durationMinutes: 8 }] });
    const res = mockResponse();

    await updateMeditation(req({ id: 'm1' }, { durationMinutes: 8 }), res);

    expect(tx.meditationSession.create).toHaveBeenCalledWith({ data: { meditationId: 'm1', durationMinutes: 8 } });
    expect(res.json.mock.calls[0][0].data.duration).toBe(8);
  });

  it('refuses to delete a meditation users have favourited', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'm1' });
    mockPrisma.userDailyRoutine.count.mockResolvedValue(0);
    mockPrisma.userFavoriteMeditation.count.mockResolvedValue(2);
    mockPrisma.userMeditationLog.count.mockResolvedValue(0);
    const res = mockResponse();

    await deleteMeditation(req({ id: 'm1' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockPrisma.meditation.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused meditation with its sessions", async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'm1' });
    mockPrisma.userDailyRoutine.count.mockResolvedValue(0);
    mockPrisma.userFavoriteMeditation.count.mockResolvedValue(0);
    mockPrisma.userMeditationLog.count.mockResolvedValue(0);
    const res = mockResponse();

    await deleteMeditation(req({ id: 'm1' }), res);

    expect(mockPrisma.meditationSession.deleteMany).toHaveBeenCalledWith({ where: { meditationId: 'm1' } });
    expect(mockPrisma.meditation.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});

describe('challenge exercises and diets', () => {
  beforeEach(() => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce({ id: 'c1' }).mockResolvedValueOnce({ challengeExercises: [], challengeDiets: [] });
  });

  it('replaces the exercise list and leaves diets alone when they are not sent', async () => {
    mockPrisma.exercise.count.mockResolvedValue(2);
    const res = mockResponse();

    await setChallengeContent(req({ id: 'c1' }, { exerciseIds: ['e1', 'e2', 'e1'] }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.challengeExercise.deleteMany).toHaveBeenCalledWith({ where: { challengeId: 'c1', exerciseId: { notIn: ['e1', 'e2'] } } });
    expect(mockPrisma.challengeExercise.createMany).toHaveBeenCalledWith({ data: [{ challengeId: 'c1', exerciseId: 'e1' }, { challengeId: 'c1', exerciseId: 'e2' }], skipDuplicates: true });
    expect(mockPrisma.challengeDiet.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a diet plan that does not exist', async () => {
    mockPrisma.dietPlan.count.mockResolvedValue(0);
    const res = mockResponse();
    await setChallengeContent(req({ id: 'c1' }, { dietIds: ['gone'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('announcements', () => {
  it('stores and pushes one per user, as an announcement that can open a screen', async () => {
    mockCreateNotification.mockResolvedValue({});
    const userIds = Array.from({ length: 60 }, (_, i) => `u${i}`);

    await deliverAnnouncement(userIds, { title: 'New plans', body: 'Try them', screen: '/(tabs)/diet' });

    expect(mockCreateNotification).toHaveBeenCalledTimes(60);
    expect(mockCreateNotification).toHaveBeenCalledWith('u0', { title: 'New plans', body: 'Try them', type: 'announcement', data: { screen: '/(tabs)/diet' } });
  });

  it('keeps going when one user fails', async () => {
    mockCreateNotification.mockRejectedValueOnce(new Error('db')).mockResolvedValue({});
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await deliverAnnouncement(['a', 'b', 'c'], { title: 'Hi' });
    expect(mockCreateNotification).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('1 of 3'));
    spy.mockRestore();
  });
});
