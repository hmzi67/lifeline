import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';

// The admin AI generator router on its own, with auth passed through and a stand-in database.
const mockPrisma: any = {
  aiGenerationBatch: { findUnique: jest.fn() },
  aiGenerationJob: { findFirst: jest.fn() },
  dietPlan: { findFirst: jest.fn(), updateMany: jest.fn() },
  exercisePlan: { findFirst: jest.fn(), updateMany: jest.fn() },
  dietPlanMeal: { findFirst: jest.fn(), updateMany: jest.fn() },
  exercise: { updateMany: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/middleware/authenticate', () => ({ __esModule: true, default: (_req: any, _res: any, next: any) => next() }));
jest.mock('../src/middleware/authorize', () => ({ __esModule: true, default: () => (_req: any, _res: any, next: any) => next() }));

import router from '../src/routes/adminAiGeneratorRoutes';

let server: Server;
let base: string;

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use('/ai', router);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiGenerationBatch.findUnique.mockResolvedValue({ id: 'b1', kind: 'diet', status: 'completed' });
  mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(null);
});

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('status', () => {
  it('reports which services are set up without their keys', async () => {
    const previous = process.env.PIXABAY_API_KEY;
    delete process.env.PIXABAY_API_KEY;
    const body = await (await fetch(`${base}/status`)).json();
    expect(body.data.pixabay).toBe(false);
    expect(body.data.choices.dietGoals).toEqual(['weight_loss', 'weight_gain', 'build_muscle']);
    expect(JSON.stringify(body)).not.toMatch(/sk-/);
    if (previous !== undefined) process.env.PIXABAY_API_KEY = previous;
  });
});

describe('media', () => {
  it('gives the same picture to every copy of a meal in the plan', async () => {
    mockPrisma.dietPlanMeal.findFirst.mockResolvedValue({ name: 'Oat bowl', day: { dietId: 'd1' } });
    mockPrisma.dietPlanMeal.updateMany.mockResolvedValue({ count: 7 });

    const res = await post('/batches/b1/media', { target: 'meal', id: 'm1', image: 'https://makelifeline.com/uploads/image/a.jpg' });

    expect(res.status).toBe(200);
    expect(mockPrisma.dietPlanMeal.findFirst.mock.calls[0][0].where).toEqual({ id: 'm1', day: { diet: { aiBatchId: 'b1' } } });
    expect(mockPrisma.dietPlanMeal.updateMany.mock.calls[0][0]).toEqual({
      where: { name: 'Oat bowl', day: { dietId: 'd1' } },
      data: { image: 'https://makelifeline.com/uploads/image/a.jpg' },
    });
  });

  it('only changes exercises this batch created', async () => {
    mockPrisma.aiGenerationBatch.findUnique.mockResolvedValue({ id: 'b1', kind: 'exercise', status: 'completed' });
    mockPrisma.exercise.updateMany.mockResolvedValue({ count: 0 });

    const res = await post('/batches/b1/media', { target: 'exercise', id: 'library-squat', videoUrl: 'https://x.test/v.mp4' });

    expect(res.status).toBe(404);
    expect(mockPrisma.exercise.updateMany.mock.calls[0][0]).toEqual({ where: { id: 'library-squat', aiBatchId: 'b1' }, data: { videoUrl: 'https://x.test/v.mp4' } });
  });

  it('rejects a body without a picture or video', async () => {
    const res = await post('/batches/b1/media', { target: 'plan', id: 'p1' });
    expect(res.status).toBe(400);
  });
});

describe('plan preview', () => {
  it('groups an exercise plan by week and day and marks exercises the batch made', async () => {
    mockPrisma.aiGenerationBatch.findUnique.mockResolvedValue({ id: 'b1', kind: 'exercise', status: 'completed' });
    mockPrisma.exercisePlan.findFirst.mockResolvedValue({
      id: 'p1',
      name: 'Legs',
      exercisePlanWeeks: [
        {
          weekNumber: 1,
          exercisePlanSchedule: [
            { dayOfWeek: 'Monday', sets: 3, reps: '12', duration: '45 sec', exercise: { id: 'e1', name: 'Squat', aiBatchId: null } },
            { dayOfWeek: 'Monday', sets: 3, reps: null, duration: '1 min', exercise: { id: 'e2', name: 'Wall Sit', aiBatchId: 'b1' } },
          ],
        },
      ],
    });

    const body = await (await fetch(`${base}/batches/b1/plans/p1`)).json();

    expect(mockPrisma.exercisePlan.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', aiBatchId: 'b1' });
    expect(body.data.weeks[0].days).toHaveLength(1);
    expect(body.data.weeks[0].days[0].exercises.map((e: any) => e.exercise.createdByBatch)).toEqual([false, true]);
  });

  it('refuses a plan from another batch', async () => {
    mockPrisma.dietPlan.findFirst.mockResolvedValue(null);
    expect((await fetch(`${base}/batches/b1/plans/other`)).status).toBe(404);
  });
});

describe('what the preview shows for review', () => {
  it('shows the picture a live exercise will get on publish, and says so', async () => {
    mockPrisma.aiGenerationBatch.findUnique.mockResolvedValue({ id: 'b1', kind: 'exercise', status: 'completed' });
    mockPrisma.aiGenerationJob.findFirst.mockResolvedValue({ reviewData: { pendingMedia: { e1: { image: 'http://x/uploads/image/new.jpg' } } } });
    mockPrisma.exercisePlan.findFirst.mockResolvedValue({
      id: 'p1',
      name: 'Legs',
      exercisePlanWeeks: [
        {
          weekNumber: 1,
          exercisePlanSchedule: [
            { dayOfWeek: 'Monday', sets: 3, reps: '12', duration: '45 sec', exercise: { id: 'e1', name: 'Squat', image: 'https://images.unsplash.com/old', aiBatchId: null } },
            { dayOfWeek: 'Monday', sets: 3, reps: null, duration: '1 min', exercise: { id: 'e2', name: 'Wall Sit', image: 'http://x/uploads/image/own.jpg', aiBatchId: null } },
          ],
        },
      ],
    });

    const body = await (await fetch(`${base}/batches/b1/plans/p1`)).json();
    const [squat, wallSit] = body.data.weeks[0].days[0].exercises.map((row: any) => row.exercise);

    expect(mockPrisma.aiGenerationJob.findFirst.mock.calls[0][0].where).toEqual({ batchId: 'b1', resultPlanId: 'p1' });
    expect(squat).toEqual(expect.objectContaining({ image: 'http://x/uploads/image/new.jpg', pictureOnPublish: true }));
    expect(wallSit).toEqual(expect.objectContaining({ image: 'http://x/uploads/image/own.jpg', pictureOnPublish: false }));
  });

  it('lists the USDA food behind each ingredient of a diet plan', async () => {
    const sources = [{ ingredient: 'rolled oats', usdaMatch: 'Oats, whole grain, rolled, old fashioned', kcalPer100g: 379 }];
    mockPrisma.aiGenerationJob.findFirst.mockResolvedValue({ reviewData: { nutritionSources: sources } });
    mockPrisma.dietPlan.findFirst.mockResolvedValue({ id: 'd1', name: 'Lean week', dietPlanDays: [] });

    const body = await (await fetch(`${base}/batches/b1/plans/d1`)).json();

    expect(body.data.nutritionSources).toEqual(sources);
  });
});
