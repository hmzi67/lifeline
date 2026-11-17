export {};

const mockTx: any = {
  dietPlan: { findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  dietPlanDay: { deleteMany: jest.fn() },
  dietPlanMeal: { deleteMany: jest.fn() },
  exercisePlan: { findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  exercisePlanWeek: { deleteMany: jest.fn() },
  exercisePlanSchedule: { deleteMany: jest.fn() },
  exercise: { updateMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  aiGenerationJob: { updateMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  aiGenerationBatch: { findUnique: jest.fn(), update: jest.fn() },
};
const mockPrisma: any = { $transaction: jest.fn((fn: (tx: any) => unknown) => fn(mockTx)) };

jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

import { buildJobSpecs, createBatchSchema, discardBatch, dropJobDraft, publishBatch, retryJob, RetryJobError } from '../src/services/aiGenerator/batchService';

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.exercise.updateMany.mockResolvedValue({ count: 3 });
  mockTx.exercise.deleteMany.mockResolvedValue({ count: 2 });
  mockTx.aiGenerationJob.findMany.mockResolvedValue([]);
  mockTx.aiGenerationJob.count.mockResolvedValue(0);
  mockTx.exercisePlan.count.mockResolvedValue(1);
  mockTx.dietPlan.count.mockResolvedValue(1);
});

describe('batch input', () => {
  it('accepts an exercise batch and fills in defaults', () => {
    const parsed = createBatchSchema.parse({
      kind: 'exercise',
      mediaSource: 'stock',
      planCount: 3,
      settings: { levels: ['beginner'], focusAreas: ['Full Body'] },
    });
    expect(parsed.kind === 'exercise' && parsed.settings.weeks).toBe(4);
  });

  it('rejects unknown options, too many plans and a missing choice', () => {
    const base = { kind: 'diet', mediaSource: 'ai_generated', planCount: 2, settings: { goals: ['weight_loss'], dietTypes: ['Keto'] } };
    expect(createBatchSchema.safeParse(base).success).toBe(true);
    expect(createBatchSchema.safeParse({ ...base, planCount: 31 }).success).toBe(false);
    expect(createBatchSchema.safeParse({ ...base, mediaSource: 'midjourney' }).success).toBe(false);
    expect(createBatchSchema.safeParse({ ...base, settings: { ...base.settings, dietTypes: ['Carnivore'] } }).success).toBe(false);
    expect(createBatchSchema.safeParse({ ...base, settings: { ...base.settings, goals: [] } }).success).toBe(false);
  });
});

describe('job specs', () => {
  it('spreads plans over every picked combination before repeating one', () => {
    const input = createBatchSchema.parse({
      kind: 'exercise',
      mediaSource: 'stock',
      planCount: 5,
      settings: { levels: ['beginner', 'advanced'], focusAreas: ['Legs', 'Back'] },
    });
    const specs = buildJobSpecs(input);
    expect(specs.map((s) => `${s.level}/${s.focusArea}/${s.variant}`)).toEqual([
      'beginner/Legs/1',
      'beginner/Back/1',
      'advanced/Legs/1',
      'advanced/Back/1',
      'beginner/Legs/2',
    ]);
    expect(specs[4]).toEqual(expect.objectContaining({ position: 5, of: 5, weeks: 4 }));
  });
});

describe('publishing', () => {
  it('publishes the draft exercise plans and the draft exercises they use', async () => {
    mockTx.exercisePlan.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    expect(await publishBatch('batch-1', 'exercise')).toEqual({ plans: 2, exercises: 3, pictures: 0 });
    expect(mockTx.exercisePlan.findMany).toHaveBeenCalledWith({ where: { aiBatchId: 'batch-1', status: 'draft' }, select: { id: true } });
    expect(mockTx.exercise.updateMany).toHaveBeenCalledWith({
      where: { status: 'draft', exercisePlanSchedule: { some: { week: { planId: { in: ['p1', 'p2'] } } } } },
      data: { status: 'published' },
    });
  });

  it('only publishes the plans the admin picked', async () => {
    mockTx.dietPlan.findMany.mockResolvedValue([{ id: 'd1' }]);

    expect(await publishBatch('batch-1', 'diet', ['d1'])).toEqual({ plans: 1, exercises: 0 });
    expect(mockTx.dietPlan.findMany).toHaveBeenCalledWith({
      where: { aiBatchId: 'batch-1', status: 'draft', id: { in: ['d1'] } },
      select: { id: true },
    });
  });
});

describe('discarding', () => {
  it('deletes workouts before weeks before plans, then unused draft exercises of the batch', async () => {
    mockTx.exercisePlan.findMany.mockResolvedValue([{ id: 'p1' }]);
    const order: string[] = [];
    mockTx.exercisePlanSchedule.deleteMany.mockImplementation(async () => order.push('schedule'));
    mockTx.exercisePlanWeek.deleteMany.mockImplementation(async () => order.push('week'));
    mockTx.exercisePlan.deleteMany.mockImplementation(async () => order.push('plan'));

    expect(await discardBatch('batch-1', 'exercise')).toEqual({ plans: 1, exercises: 2 });
    expect(order).toEqual(['schedule', 'week', 'plan']);
    expect(mockTx.exercise.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ aiBatchId: 'batch-1', status: 'draft', exercisePlanSchedule: { none: {} } }),
    });
    expect(mockTx.aiGenerationJob.updateMany).toHaveBeenCalled();
  });
});

describe('retrying one plan', () => {
  const batch = { id: 'b1', kind: 'exercise', costUsd: 0.5, costCapUsd: 2 };

  it('replaces the old draft and queues the plan again with the same settings', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue(batch);
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'needs_attention', resultPlanId: 'p1' });
    mockTx.exercisePlan.findMany.mockResolvedValue([{ id: 'p1' }]);

    await retryJob('b1', 'j1');

    expect(mockTx.exercisePlan.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] } } });
    expect(mockTx.aiGenerationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'j1' }, data: expect.objectContaining({ status: 'queued', attempts: 0, resultPlanId: null }) }),
    );
    expect(mockTx.aiGenerationBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'running', finishedAt: null }) }));
  });

  it('refuses a plan that is already published, and leaves it alone', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue(batch);
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'succeeded', resultPlanId: 'p1' });
    mockTx.exercisePlan.findMany.mockResolvedValue([]); // p1 is no longer a draft

    await expect(retryJob('b1', 'j1')).rejects.toMatchObject({ code: 'PUBLISHED', httpStatus: 409 });
    expect(mockTx.exercisePlan.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.aiGenerationJob.update).not.toHaveBeenCalled();
  });

  it('makes the plan again when its draft was already discarded', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue(batch);
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'needs_attention', resultPlanId: 'p1' });
    mockTx.exercisePlan.findMany.mockResolvedValue([]);
    mockTx.exercisePlan.count.mockResolvedValue(0);

    await retryJob('b1', 'j1');
    expect(mockTx.aiGenerationJob.update).toHaveBeenCalled();
  });

  it('removes exercises a failed try left behind, unless another plan of the batch is being made', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue(batch);
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'failed', resultPlanId: null });

    await retryJob('b1', 'j1');
    expect(mockTx.exercise.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ aiBatchId: 'b1', status: 'draft', exercisePlanSchedule: { none: {} } }) });

    mockTx.exercise.deleteMany.mockClear();
    mockTx.aiGenerationJob.count.mockResolvedValue(1);
    await retryJob('b1', 'j1');
    expect(mockTx.exercise.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses at the spending limit, and goes ahead once the admin raises it', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue({ ...batch, costUsd: 2.1 });
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'failed', resultPlanId: null });

    await expect(retryJob('b1', 'j1')).rejects.toMatchObject({ code: 'COST_CAP', httpStatus: 409 });
    await expect(retryJob('b1', 'j1')).rejects.toBeInstanceOf(RetryJobError);

    const result = await retryJob('b1', 'j1', 1);
    expect(result.costCapUsd).toBeCloseTo(3.1);
  });

  it('refuses a plan that is still waiting or being made', async () => {
    mockTx.aiGenerationBatch.findUnique.mockResolvedValue(batch);
    mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', status: 'running', resultPlanId: null });
    await expect(retryJob('b1', 'j1')).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe('pictures held until publish', () => {
  it('gives live exercises their new pictures on publish, but keeps one an admin uploaded meanwhile', async () => {
    mockTx.exercisePlan.findMany.mockResolvedValue([{ id: 'p1' }]);
    mockTx.aiGenerationJob.findMany.mockResolvedValue([
      {
        id: 'j1',
        reviewData: {
          nutritionSources: [],
          pendingMedia: {
            placeholder: { image: 'http://x/uploads/image/new1.jpg' },
            uploaded: { image: 'http://x/uploads/image/new2.jpg' },
          },
        },
      },
    ]);
    mockTx.exercise.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'placeholder' ? { image: 'https://images.unsplash.com/p', videoUrl: null } : { image: 'http://x/uploads/image/admin.jpg', videoUrl: null },
    );

    const result = await publishBatch('batch-1', 'exercise', ['p1']);

    expect(result.pictures).toBe(1);
    expect(mockTx.exercise.update).toHaveBeenCalledTimes(1);
    expect(mockTx.exercise.update).toHaveBeenCalledWith({ where: { id: 'placeholder' }, data: { image: 'http://x/uploads/image/new1.jpg' } });
    // The held pictures are cleared from the job; other review data stays.
    expect(mockTx.aiGenerationJob.update).toHaveBeenCalledWith({ where: { id: 'j1' }, data: { reviewData: { nutritionSources: [] } } });
  });
});

describe('dropping a failed try', () => {
  it("deletes the job's draft and forgets it on the job", async () => {
    mockTx.aiGenerationJob.findUnique.mockResolvedValue({ resultPlanId: 'p1', batchId: 'b1', batch: { kind: 'diet' } });
    mockTx.dietPlan.findMany.mockResolvedValue([{ id: 'p1' }]);

    expect(await dropJobDraft('j1')).toBe(1);

    expect(mockTx.dietPlan.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] } } });
    expect(mockTx.aiGenerationJob.updateMany).toHaveBeenCalledWith({ where: { id: 'j1', resultPlanId: 'p1' }, data: { resultPlanId: null, reviewData: {} } });
  });

  it('never deletes a plan that was already published', async () => {
    mockTx.aiGenerationJob.findUnique.mockResolvedValue({ resultPlanId: 'p1', batchId: 'b1', batch: { kind: 'exercise' } });
    mockTx.exercisePlan.findMany.mockResolvedValue([]); // not a draft any more

    expect(await dropJobDraft('j1')).toBe(0);
    expect(mockTx.exercisePlan.deleteMany).not.toHaveBeenCalled();
  });
});

describe('exercise rules in the form', () => {
  it('carries the yes/no rules into every plan of the batch', () => {
    const parsed = createBatchSchema.parse({
      kind: 'exercise',
      mediaSource: 'admin_upload',
      planCount: 2,
      settings: { levels: ['beginner'], focusAreas: ['Chest'], noFloorExercises: true, lowImpactOnly: true },
    });
    const specs = buildJobSpecs(parsed);
    expect(specs.every((spec) => spec.noFloorExercises === true && spec.lowImpactOnly === true && spec.bodyweightOnly === undefined)).toBe(true);
  });
});
