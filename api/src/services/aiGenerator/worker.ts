import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { dropJobDraft } from './batchService.js';
import { BATCH_STATUS, JOB_STATUS, LIMITS, OPEN_JOB_STATUSES } from './constants.js';

/**
 * Runs AI generation jobs one at a time inside the API process (there is no separate queue
 * service). Each tick recovers jobs cut off by a restart, claims the next queued job, runs the
 * registered handler with a timeout, and records the outcome on the job and its batch.
 */

export type JobContext = {
  /** resultPlanId is set when an earlier try of this job left a draft behind. */
  job: { id: string; batchId: string; position: number; attempts: number; spec: Prisma.JsonValue; resultPlanId?: string | null };
  batch: { id: string; kind: string; mediaSource: string; settings: Prisma.JsonValue };
  /** Aborted when the job runs past LIMITS.jobTimeoutMs; long calls should pass it on. */
  signal: AbortSignal;
  /**
   * Stops the job clock once the plan is written and reviewed, so slow pictures can't fail (and
   * redo) the whole plan. The handler times the picture step itself after calling this.
   */
  stopClock?: () => void;
};

export type JobOutcome = {
  /** succeeded, or needs_attention when a draft was saved but still fails some checks. */
  status: typeof JOB_STATUS.succeeded | typeof JOB_STATUS.needsAttention;
  resultPlanId: string | null;
  costUsd: number;
  log: unknown[];
  message?: string;
};

/** Thrown by a handler; `retryable` jobs go back to the queue until LIMITS.maxAttempts. */
export class JobError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly costUsd = 0,
    readonly log: unknown[] = [],
  ) {
    super(message);
  }
}

export type JobHandler = (ctx: JobContext) => Promise<JobOutcome>;

let handler: JobHandler | null = null;
let ticking = false;

/** Registers the code that generates one plan. Until one is registered, jobs stay queued. */
export const setJobHandler = (next: JobHandler | null) => {
  handler = next;
};

/** Jobs marked running whose lock is older than LIMITS.staleJobMs were cut off mid-run. */
export const recoverStaleJobs = async (now = new Date()) => {
  const staleBefore = new Date(now.getTime() - LIMITS.staleJobMs);
  const stale = await prisma.aiGenerationJob.findMany({
    where: { status: JOB_STATUS.running, lockedAt: { lt: staleBefore } },
    select: { id: true, batchId: true, attempts: true },
  });
  for (const job of stale) {
    const giveUp = job.attempts >= LIMITS.maxAttempts;
    await prisma.aiGenerationJob.updateMany({
      where: { id: job.id, status: JOB_STATUS.running },
      data: giveUp
        ? { status: JOB_STATUS.failed, lockedAt: null, finishedAt: now, errorMessage: 'Stopped before finishing (the server restarted or the job hung).' }
        : { status: JOB_STATUS.queued, lockedAt: null, errorMessage: 'Restarted after an interruption.' },
    });
    // A half-made draft from the interrupted try must not stay around where it could be published.
    await dropJobDraft(job.id).catch((error) => console.error(`Could not remove the draft of interrupted job ${job.id}:`, error));
    await finalizeBatchIfDone(job.batchId);
  }
  return stale.length;
};

/** Cancels a batch's waiting jobs once it has spent its cost cap. */
const stopAtCostCap = async (batch: { id: string; costUsd: number; costCapUsd: number | null }) => {
  if (batch.costCapUsd == null || batch.costUsd < batch.costCapUsd) return false;
  await prisma.aiGenerationJob.updateMany({
    where: { batchId: batch.id, status: JOB_STATUS.queued },
    data: { status: JOB_STATUS.cancelled, finishedAt: new Date(), errorMessage: `Batch cost cap of $${batch.costCapUsd} reached.` },
  });
  await finalizeBatchIfDone(batch.id);
  return true;
};

/** Claims the oldest queued job of a live batch, or returns null when there is none. */
export const claimNextJob = async (now = new Date()) => {
  // A few candidates, in case another claim or a cost cap removes the first one.
  const candidates = await prisma.aiGenerationJob.findMany({
    where: { status: JOB_STATUS.queued, batch: { status: { in: [BATCH_STATUS.queued, BATCH_STATUS.running] } } },
    orderBy: [{ createdAt: 'asc' }, { position: 'asc' }],
    take: 5,
    include: { batch: true },
  });

  for (const candidate of candidates) {
    if (await stopAtCostCap(candidate.batch)) continue;

    const claimed = await prisma.aiGenerationJob.updateMany({
      where: { id: candidate.id, status: JOB_STATUS.queued },
      data: { status: JOB_STATUS.running, lockedAt: now, startedAt: now, attempts: { increment: 1 }, errorMessage: null },
    });
    if (claimed.count !== 1) continue;

    if (candidate.batch.status === BATCH_STATUS.queued) {
      await prisma.aiGenerationBatch.updateMany({
        where: { id: candidate.batchId, status: BATCH_STATUS.queued },
        data: { status: BATCH_STATUS.running },
      });
    }
    return { ...candidate, attempts: candidate.attempts + 1 };
  }
  return null;
};

/** Marks the batch completed once none of its jobs is waiting or running. */
export const finalizeBatchIfDone = async (batchId: string) => {
  const open = await prisma.aiGenerationJob.count({ where: { batchId, status: { in: OPEN_JOB_STATUSES } } });
  if (open) return false;
  await prisma.aiGenerationBatch.updateMany({
    where: { id: batchId, finishedAt: null },
    data: { finishedAt: new Date() },
  });
  await prisma.aiGenerationBatch.updateMany({
    where: { id: batchId, status: { in: [BATCH_STATUS.queued, BATCH_STATUS.running] } },
    data: { status: BATCH_STATUS.completed },
  });
  return true;
};

const withTimeout = async <T>(run: (signal: AbortSignal, stopClock: () => void) => Promise<T>, ms: number): Promise<T> => {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JobError(`Took longer than ${Math.round(ms / 60_000)} minutes.`, true));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal, () => clearTimeout(timer)), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const asJson = (value: unknown[]) => value as Prisma.InputJsonValue;

/** Runs one claimed job and stores what happened. Never throws. */
export const runJob = async (job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>, run: JobHandler) => {
  try {
    const outcome = await withTimeout(
      (signal, stopClock) =>
        run({
          job: { id: job.id, batchId: job.batchId, position: job.position, attempts: job.attempts, spec: job.spec, resultPlanId: job.resultPlanId },
          batch: { id: job.batch.id, kind: job.batch.kind, mediaSource: job.batch.mediaSource, settings: job.batch.settings },
          signal,
          stopClock,
        }),
      LIMITS.jobTimeoutMs,
    );
    await prisma.$transaction([
      prisma.aiGenerationJob.update({
        where: { id: job.id },
        data: {
          status: outcome.status,
          resultPlanId: outcome.resultPlanId,
          costUsd: { increment: outcome.costUsd },
          log: asJson(outcome.log),
          errorMessage: outcome.message ?? null,
          lockedAt: null,
          finishedAt: new Date(),
        },
      }),
      prisma.aiGenerationBatch.update({ where: { id: job.batchId }, data: { costUsd: { increment: outcome.costUsd } } }),
    ]);
  } catch (error) {
    const jobError = error instanceof JobError ? error : null;
    const retry = !!jobError?.retryable && job.attempts < LIMITS.maxAttempts;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!jobError) console.error(`AI generation job ${job.id} failed:`, error);
    const costUsd = jobError?.costUsd ?? 0;
    await prisma.$transaction([
      prisma.aiGenerationJob.update({
        where: { id: job.id },
        data: {
          status: retry ? JOB_STATUS.queued : JOB_STATUS.failed,
          errorMessage: message,
          costUsd: { increment: costUsd },
          ...(jobError?.log.length ? { log: asJson(jobError.log) } : {}),
          lockedAt: null,
          ...(retry ? {} : { finishedAt: new Date() }),
        },
      }),
      prisma.aiGenerationBatch.update({ where: { id: job.batchId }, data: { costUsd: { increment: costUsd } } }),
    ]);
  } finally {
    await finalizeBatchIfDone(job.batchId);
  }
};

/** One pass of the worker; overlapping calls are skipped. */
export const runAiGenerationTick = async () => {
  if (!handler || ticking) return;
  ticking = true;
  try {
    await recoverStaleJobs();
    const job = await claimNextJob();
    if (job) await runJob(job, handler);
  } catch (error) {
    console.error('AI generation worker tick failed:', error);
  } finally {
    ticking = false;
  }
};
