export {};

const mockPrisma: any = {
  aiGenerationJob: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn((args: unknown) => ({ op: 'jobUpdate', args })),
    count: jest.fn(),
  },
  aiGenerationBatch: {
    updateMany: jest.fn(),
    update: jest.fn((args: unknown) => ({ op: 'batchUpdate', args })),
  },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};

jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

import { JOB_STATUS, LIMITS } from '../src/services/aiGenerator/constants';
import {
  claimNextJob,
  finalizeBatchIfDone,
  JobError,
  recoverStaleJobs,
  runAiGenerationTick,
  runJob,
  setJobHandler,
} from '../src/services/aiGenerator/worker';

const batch = { id: 'batch-1', kind: 'exercise', mediaSource: 'stock', settings: {}, status: 'queued', costUsd: 0, costCapUsd: null };
const queuedJob = { id: 'job-1', batchId: 'batch-1', position: 0, attempts: 0, spec: { level: 'beginner' }, status: 'queued', batch };

const jobUpdateData = () => mockPrisma.aiGenerationJob.update.mock.calls.at(-1)[0].data;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiGenerationJob.findMany.mockResolvedValue([]);
  mockPrisma.aiGenerationJob.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.aiGenerationJob.count.mockResolvedValue(0);
  mockPrisma.aiGenerationBatch.updateMany.mockResolvedValue({ count: 1 });
  setJobHandler(null);
});

describe('claiming a job', () => {
  it('claims the oldest queued job, counts the attempt and starts its batch', async () => {
    mockPrisma.aiGenerationJob.findMany.mockResolvedValue([queuedJob]);

    const job = await claimNextJob(new Date('2026-11-08T10:00:00Z'));

    expect(job?.id).toBe('job-1');
    expect(job?.attempts).toBe(1);
    expect(mockPrisma.aiGenerationJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: JOB_STATUS.queued },
      data: expect.objectContaining({ status: JOB_STATUS.running, attempts: { increment: 1 } }),
    });
    expect(mockPrisma.aiGenerationBatch.updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-1', status: 'queued' },
      data: { status: 'running' },
    });
  });

  it('skips a job another tick already claimed', async () => {
    mockPrisma.aiGenerationJob.findMany.mockResolvedValue([queuedJob]);
    mockPrisma.aiGenerationJob.updateMany.mockResolvedValue({ count: 0 });

    expect(await claimNextJob()).toBeNull();
  });

  it('cancels the waiting jobs of a batch that reached its cost cap instead of starting one', async () => {
    mockPrisma.aiGenerationJob.findMany.mockResolvedValue([{ ...queuedJob, batch: { ...batch, costUsd: 5, costCapUsd: 5 } }]);

    expect(await claimNextJob()).toBeNull();
    expect(mockPrisma.aiGenerationJob.updateMany).toHaveBeenCalledWith({
      where: { batchId: 'batch-1', status: JOB_STATUS.queued },
      data: expect.objectContaining({ status: JOB_STATUS.cancelled }),
    });
  });
});

describe('running a job', () => {
  const claimed = { ...queuedJob, attempts: 1 };

  it('stores the outcome and adds its cost to the batch', async () => {
    await runJob(claimed as any, async () => ({
      status: JOB_STATUS.succeeded,
      resultPlanId: 'plan-9',
      costUsd: 0.12,
      log: [{ step: 'done' }],
    }));

    expect(jobUpdateData()).toEqual(expect.objectContaining({ status: 'succeeded', resultPlanId: 'plan-9', costUsd: { increment: 0.12 } }));
    expect(mockPrisma.aiGenerationBatch.update).toHaveBeenCalledWith({ where: { id: 'batch-1' }, data: { costUsd: { increment: 0.12 } } });
  });

  it('puts a retryable failure back in the queue while attempts remain', async () => {
    await runJob(claimed as any, async () => {
      throw new JobError('Rate limited', true, 0.03);
    });

    expect(jobUpdateData()).toEqual(expect.objectContaining({ status: 'queued', errorMessage: 'Rate limited', costUsd: { increment: 0.03 } }));
  });

  it('fails the job once its attempts are used up', async () => {
    await runJob({ ...claimed, attempts: LIMITS.maxAttempts } as any, async () => {
      throw new JobError('Rate limited', true);
    });

    expect(jobUpdateData()).toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('fails an unexpected error without retrying', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await runJob(claimed as any, async () => {
      throw new Error('boom');
    });

    expect(jobUpdateData()).toEqual(expect.objectContaining({ status: 'failed', errorMessage: 'boom' }));
    consoleError.mockRestore();
  });
});

describe('interrupted jobs', () => {
  it('requeues a stale running job, or fails it after the last attempt', async () => {
    mockPrisma.aiGenerationJob.findMany.mockResolvedValue([
      { id: 'job-a', batchId: 'batch-1', attempts: 1 },
      { id: 'job-b', batchId: 'batch-1', attempts: LIMITS.maxAttempts },
    ]);
    mockPrisma.aiGenerationJob.count.mockResolvedValue(1);

    expect(await recoverStaleJobs(new Date('2026-11-08T10:00:00Z'))).toBe(2);
    const updates = mockPrisma.aiGenerationJob.updateMany.mock.calls.map((call: any[]) => [call[0].where.id, call[0].data.status]);
    expect(updates).toEqual([
      ['job-a', 'queued'],
      ['job-b', 'failed'],
    ]);
  });
});

describe('finishing a batch', () => {
  it('stays open while jobs are queued or running', async () => {
    mockPrisma.aiGenerationJob.count.mockResolvedValue(2);
    expect(await finalizeBatchIfDone('batch-1')).toBe(false);
    expect(mockPrisma.aiGenerationBatch.updateMany).not.toHaveBeenCalled();
  });

  it('completes once every job is done, without overriding a cancelled batch', async () => {
    expect(await finalizeBatchIfDone('batch-1')).toBe(true);
    expect(mockPrisma.aiGenerationBatch.updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-1', status: { in: ['queued', 'running'] } },
      data: { status: 'completed' },
    });
  });
});

describe('the worker tick', () => {
  it('does nothing until a handler is registered', async () => {
    await runAiGenerationTick();
    expect(mockPrisma.aiGenerationJob.findMany).not.toHaveBeenCalled();
  });

  it('runs one claimed job through the registered handler', async () => {
    const handler = jest.fn(async (_ctx: any) => ({ status: JOB_STATUS.succeeded, resultPlanId: 'p', costUsd: 0, log: [] as unknown[] }));
    setJobHandler(handler);
    mockPrisma.aiGenerationJob.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([queuedJob]);

    await runAiGenerationTick();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual(expect.objectContaining({ job: expect.objectContaining({ id: 'job-1', attempts: 1 }) }));
  });
});

describe('what the handler is given', () => {
  it("passes the earlier try's draft and a way to stop the job clock", async () => {
    let seen: any;
    await runJob({ ...queuedJob, attempts: 2, resultPlanId: 'old-plan' } as any, async (ctx) => {
      seen = ctx;
      ctx.stopClock?.();
      return { status: JOB_STATUS.succeeded, resultPlanId: 'plan-1', costUsd: 0, log: [] };
    });

    expect(seen.job.resultPlanId).toBe('old-plan');
    expect(typeof seen.stopClock).toBe('function');
    expect(jobUpdateData()).toEqual(expect.objectContaining({ status: 'succeeded' }));
  });
});
