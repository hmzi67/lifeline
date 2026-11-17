import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { CONTENT_STATUS } from '../../utils/contentStatus.js';
import {
  BATCH_STATUS,
  DIET_GOALS,
  DIET_TYPES,
  EXERCISE_LEVELS,
  FOCUS_AREAS,
  JOB_STATUS,
  LIMITS,
  MEDIA_SOURCES,
  OPEN_JOB_STATUSES,
} from './constants.js';
import type { ReviewData } from './constants.js';

const brief = z.string().trim().max(2000).optional();

const dietSettings = z.object({
  goals: z.array(z.enum(DIET_GOALS)).min(1, 'Pick at least one goal'),
  dietTypes: z.array(z.enum(DIET_TYPES)).min(1, 'Pick at least one diet type'),
  caloriesPerDay: z.number().int().min(1000).max(4500).optional(),
  /** Length of the menu; it repeats in the app. */
  days: z.number().int().min(1).max(14).default(7),
  mealsPerDay: z.number().int().min(3).max(6).default(4),
  cuisine: z.string().trim().max(50).optional(),
  brief,
});

const exerciseSettings = z.object({
  levels: z.array(z.enum(EXERCISE_LEVELS)).min(1, 'Pick at least one level'),
  focusAreas: z.array(z.enum(FOCUS_AREAS)).min(1, 'Pick at least one focus area'),
  weeks: z.number().int().min(1).max(12).default(4),
  daysPerWeek: z.number().int().min(2).max(6).default(4),
  minutesPerSession: z.number().int().min(10).max(90).default(30),
  equipment: z.string().trim().max(200).optional(),
  /** Rules our code checks on every exercise (from its labels), not left to the AI's judgement. */
  noFloorExercises: z.boolean().optional(),
  lowImpactOnly: z.boolean().optional(),
  bodyweightOnly: z.boolean().optional(),
  brief,
});

const common = {
  mediaSource: z.enum(MEDIA_SOURCES),
  planCount: z.number().int().min(1).max(LIMITS.maxPlansPerBatch),
  costCapUsd: z.number().positive().max(LIMITS.maxCostCapUsd).optional(),
};

export const createBatchSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('diet'), settings: dietSettings, ...common }),
  z.object({ kind: z.literal('exercise'), settings: exerciseSettings, ...common }),
]);
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

/** Every combination of the picked options, so the batch's plans differ from each other. */
const combinations = <A, B>(as: readonly A[], bs: readonly B[]) => as.flatMap((a) => bs.map((b) => [a, b] as const));

/**
 * What each plan in the batch should be: the batch settings plus one combination of the
 * picked options (round-robin), and its place in the batch so the agent can vary it.
 */
export const buildJobSpecs = (input: CreateBatchInput): Record<string, unknown>[] => {
  const specs: Record<string, unknown>[] = [];
  if (input.kind === 'diet') {
    const { goals, dietTypes, ...rest } = input.settings;
    const combos = combinations(dietTypes, goals);
    for (let i = 0; i < input.planCount; i++) {
      const [dietType, goal] = combos[i % combos.length];
      specs.push({ kind: 'diet', ...rest, dietType, goal, variant: Math.floor(i / combos.length) + 1, position: i + 1, of: input.planCount });
    }
  } else {
    const { levels, focusAreas, ...rest } = input.settings;
    const combos = combinations(levels, focusAreas);
    for (let i = 0; i < input.planCount; i++) {
      const [level, focusArea] = combos[i % combos.length];
      specs.push({ kind: 'exercise', ...rest, level, focusArea, variant: Math.floor(i / combos.length) + 1, position: i + 1, of: input.planCount });
    }
  }
  return specs;
};

export const createBatch = async (input: CreateBatchInput, createdById: string | null) => {
  const specs = buildJobSpecs(input);
  return prisma.aiGenerationBatch.create({
    data: {
      kind: input.kind,
      mediaSource: input.mediaSource,
      settings: input.settings as Prisma.InputJsonValue,
      planCount: input.planCount,
      costCapUsd: input.costCapUsd ?? null,
      createdById,
      jobs: { create: specs.map((spec, position) => ({ position, spec: spec as Prisma.InputJsonValue })) },
    },
    include: { jobs: { orderBy: { position: 'asc' } } },
  });
};

/** Stops jobs that haven't started; a running job finishes (its draft can still be discarded). */
export const cancelBatch = async (batchId: string) =>
  prisma.$transaction(async (tx) => {
    const cancelled = await tx.aiGenerationJob.updateMany({
      where: { batchId, status: JOB_STATUS.queued },
      data: { status: JOB_STATUS.cancelled, finishedAt: new Date(), errorMessage: 'Cancelled by an admin' },
    });
    const stillRunning = await tx.aiGenerationJob.count({ where: { batchId, status: JOB_STATUS.running } });
    await tx.aiGenerationBatch.update({
      where: { id: batchId },
      data: { status: BATCH_STATUS.cancelled, ...(stillRunning ? {} : { finishedAt: new Date() }) },
    });
    return { cancelledJobs: cancelled.count, stillRunning };
  });

/** The batch's draft plans, optionally narrowed to the ids the admin picked. */
const draftPlanIds = async (tx: Prisma.TransactionClient, batchId: string, kind: string, planIds?: string[]) => {
  const where = { aiBatchId: batchId, status: CONTENT_STATUS.draft, ...(planIds ? { id: { in: planIds } } : {}) };
  const rows =
    kind === 'diet'
      ? await tx.dietPlan.findMany({ where, select: { id: true } })
      : await tx.exercisePlan.findMany({ where, select: { id: true } });
  return rows.map((row) => row.id);
};

/**
 * Makes the batch's draft plans visible in the app. For exercise plans, the draft exercises
 * they use are published too, or the plan would point at hidden exercises.
 */
export const publishBatch = async (batchId: string, kind: string, planIds?: string[]) =>
  prisma.$transaction(async (tx) => {
    const ids = await draftPlanIds(tx, batchId, kind, planIds);
    if (!ids.length) return { plans: 0, exercises: 0 };

    if (kind === 'diet') {
      await tx.dietPlan.updateMany({ where: { id: { in: ids } }, data: { status: CONTENT_STATUS.published } });
      return { plans: ids.length, exercises: 0 };
    }

    const exercises = await tx.exercise.updateMany({
      where: {
        status: CONTENT_STATUS.draft,
        exercisePlanSchedule: { some: { week: { planId: { in: ids } } } },
      },
      data: { status: CONTENT_STATUS.published },
    });
    await tx.exercisePlan.updateMany({ where: { id: { in: ids } }, data: { status: CONTENT_STATUS.published } });
    const pictures = await applyPendingMedia(tx, batchId, ids);
    return { plans: ids.length, exercises: exercises.count, pictures };
  });

/** Deletes draft plans with their days/meals or weeks/workouts (children first). */
const deleteDraftPlans = async (tx: Prisma.TransactionClient, kind: string, ids: string[]) => {
  if (!ids.length) return;
  if (kind === 'diet') {
    await tx.dietPlanMeal.deleteMany({ where: { day: { dietId: { in: ids } } } });
    await tx.dietPlanDay.deleteMany({ where: { dietId: { in: ids } } });
    await tx.dietPlan.deleteMany({ where: { id: { in: ids } } });
    return;
  }
  await tx.exercisePlanSchedule.deleteMany({ where: { week: { planId: { in: ids } } } });
  await tx.exercisePlanWeek.deleteMany({ where: { planId: { in: ids } } });
  await tx.exercisePlan.deleteMany({ where: { id: { in: ids } } });
};

/** Draft exercises the batch created that no plan (or anything else) uses. */
const deleteUnusedDraftExercises = async (tx: Prisma.TransactionClient, batchId: string) =>
  (
    await tx.exercise.deleteMany({
      where: {
        aiBatchId: batchId,
        status: CONTENT_STATUS.draft,
        exercisePlanSchedule: { none: {} },
        exerciseDetails: { none: {} },
        userExercises: { none: {} },
        challengeExercises: { none: {} },
      },
    })
  ).count;

/**
 * Removes exercises a failed or cut-off try created that no plan uses. Call it only when none of
 * the batch's other jobs is running, since a running job may not have saved its plan yet.
 */
export const dropUnusedDraftExercises = (batchId: string) => prisma.$transaction((tx) => deleteUnusedDraftExercises(tx, batchId));

/**
 * Removes the draft a job saved (all of it, when it is still a draft) and forgets it on the job.
 * Used when a try fails or is cut off, so nothing half-made can be published. With `onlyPlanId`
 * the job row is only cleared if it still points at that plan (a newer try may have saved its own).
 */
export const dropJobDraft = async (jobId: string, onlyPlanId?: string) =>
  prisma.$transaction(async (tx) => {
    const job = await tx.aiGenerationJob.findUnique({
      where: { id: jobId },
      select: { resultPlanId: true, batchId: true, batch: { select: { kind: true } } },
    });
    const planId = onlyPlanId ?? job?.resultPlanId;
    if (!job || !planId) return 0;
    const drafts = await draftPlanIds(tx, job.batchId, job.batch.kind, [planId]);
    await deleteDraftPlans(tx, job.batch.kind, drafts);
    await tx.aiGenerationJob.updateMany({ where: { id: jobId, resultPlanId: planId }, data: { resultPlanId: null, reviewData: {} } });
    return drafts.length;
  });

const needsOwnMedia = (url: string | null | undefined) => !url || !/\/uploads\//.test(url);

/**
 * Gives live exercises the new pictures their plans were reviewed with. They were held back at
 * generation time so app users never see a picture no admin has looked at. A picture an admin
 * uploaded in the meantime is kept.
 */
const applyPendingMedia = async (tx: Prisma.TransactionClient, batchId: string, planIds: string[]) => {
  const jobs = await tx.aiGenerationJob.findMany({ where: { batchId, resultPlanId: { in: planIds } }, select: { id: true, reviewData: true } });
  let applied = 0;
  for (const job of jobs) {
    const review = (job.reviewData ?? {}) as ReviewData;
    const pending = Object.entries(review.pendingMedia ?? {});
    if (!pending.length) continue;
    for (const [exerciseId, media] of pending) {
      const exercise = await tx.exercise.findUnique({ where: { id: exerciseId }, select: { image: true, videoUrl: true } });
      if (!exercise) continue;
      const data = {
        ...(media.image && needsOwnMedia(exercise.image) ? { image: media.image } : {}),
        ...(media.videoUrl && needsOwnMedia(exercise.videoUrl) ? { videoUrl: media.videoUrl } : {}),
      };
      if (!Object.keys(data).length) continue;
      await tx.exercise.update({ where: { id: exerciseId }, data });
      applied += 1;
    }
    const { pendingMedia: _applied, ...rest } = review;
    await tx.aiGenerationJob.update({ where: { id: job.id }, data: { reviewData: rest as Prisma.InputJsonValue } });
  }
  return applied;
};

/** Why a retry was refused; `code` lets the admin page offer to raise the spending limit. */
export class RetryJobError extends Error {
  constructor(message: string, public readonly httpStatus: number, public readonly code?: 'COST_CAP' | 'PUBLISHED') {
    super(message);
  }
}

/**
 * Runs one plan of a batch again with the same settings. Its earlier draft (if still a draft) is
 * deleted, since the retry replaces it; a published plan is left alone. The job's spend so far is
 * kept, so the batch total stays honest. `raiseCapByUsd` lifts the batch's spending limit first.
 */
export const retryJob = async (batchId: string, jobId: string, raiseCapByUsd?: number) =>
  prisma.$transaction(async (tx) => {
    const batch = await tx.aiGenerationBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new RetryJobError('Batch not found', 404);
    const job = await tx.aiGenerationJob.findFirst({ where: { id: jobId, batchId } });
    if (!job) throw new RetryJobError('This plan is not part of the batch', 404);
    if (OPEN_JOB_STATUSES.includes(job.status)) throw new RetryJobError('This plan is already waiting or being made.', 409);

    let cap = batch.costCapUsd;
    if (cap != null && raiseCapByUsd) cap = Math.min(Math.round((Math.max(cap, batch.costUsd) + raiseCapByUsd) * 100) / 100, LIMITS.maxCostCapUsd);
    // Starting with less than one plan's cost left only makes a plan that stops half way, unreviewed.
    if (cap != null && cap - batch.costUsd < LIMITS.typicalPlanCostUsd) {
      throw new RetryJobError(
        `This batch has $${Math.max(0, cap - batch.costUsd).toFixed(2)} left of its $${cap.toFixed(2)} spending limit; one plan costs about $${LIMITS.typicalPlanCostUsd.toFixed(2)}.`,
        409,
        'COST_CAP',
      );
    }

    if (job.resultPlanId) {
      const stillDraft = await draftPlanIds(tx, batchId, batch.kind, [job.resultPlanId]);
      const where = { id: job.resultPlanId };
      const exists = batch.kind === 'diet' ? await tx.dietPlan.count({ where }) : await tx.exercisePlan.count({ where });
      // A published plan is in the app; making it again would leave the job pointing at a new draft.
      if (exists && !stillDraft.length) throw new RetryJobError('This plan is already published. Start a new batch to make another one.', 409, 'PUBLISHED');
      await deleteDraftPlans(tx, batch.kind, stillDraft);
    }
    await tx.aiGenerationJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.queued,
        attempts: 0,
        log: [],
        errorMessage: null,
        resultPlanId: null,
        reviewData: {},
        lockedAt: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    await tx.aiGenerationBatch.update({
      where: { id: batchId },
      data: { status: BATCH_STATUS.running, finishedAt: null, costCapUsd: cap },
    });
    const running = await tx.aiGenerationJob.count({ where: { batchId, status: { in: OPEN_JOB_STATUSES }, id: { not: job.id } } });
    if (batch.kind === 'exercise' && !running) await deleteUnusedDraftExercises(tx, batchId);
    return { jobId: job.id, costCapUsd: cap };
  });

/**
 * "Apply ideas": queues a new plan in the batch that revises this job's plan with the coach
 * review ideas the admin picked. The original plan is left as it is.
 */
export const reviseJob = async (batchId: string, jobId: string, ideas: string[], raiseCapByUsd?: number) =>
  prisma.$transaction(async (tx) => {
    const batch = await tx.aiGenerationBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new RetryJobError('Batch not found', 404);
    const job = await tx.aiGenerationJob.findFirst({ where: { id: jobId, batchId } });
    if (!job) throw new RetryJobError('This plan is not part of the batch', 404);
    if (!job.resultPlanId) throw new RetryJobError('This plan has no saved version to change.', 409);
    const jobs = await tx.aiGenerationJob.findMany({ where: { batchId }, select: { position: true } });
    if (jobs.length >= LIMITS.maxPlansPerBatch) throw new RetryJobError(`A batch can hold at most ${LIMITS.maxPlansPerBatch} plans. Start a new batch.`, 409);

    let cap = batch.costCapUsd;
    if (cap != null && raiseCapByUsd) cap = Math.min(Math.round((Math.max(cap, batch.costUsd) + raiseCapByUsd) * 100) / 100, LIMITS.maxCostCapUsd);
    // Starting with less than one plan's cost left only makes a plan that stops half way, unreviewed.
    if (cap != null && cap - batch.costUsd < LIMITS.typicalPlanCostUsd) {
      throw new RetryJobError(
        `This batch has $${Math.max(0, cap - batch.costUsd).toFixed(2)} left of its $${cap.toFixed(2)} spending limit; one plan costs about $${LIMITS.typicalPlanCostUsd.toFixed(2)}.`,
        409,
        'COST_CAP',
      );
    }

    const spec = (job.spec ?? {}) as Record<string, unknown>;
    // A revision of a revision starts from the latest plan, with the original's ideas already in it.
    const base = { ...spec };
    delete base.revision;
    const created = await tx.aiGenerationJob.create({
      data: {
        batchId,
        position: Math.max(...jobs.map((j) => j.position)) + 1,
        spec: { ...base, revision: { fromJobId: job.id, fromPlanId: job.resultPlanId, fromPosition: job.position, ideas } } as Prisma.InputJsonValue,
      },
    });
    await tx.aiGenerationBatch.update({ where: { id: batchId }, data: { status: BATCH_STATUS.running, finishedAt: null, costCapUsd: cap } });
    return { jobId: created.id, costCapUsd: cap };
  });

/**
 * Deletes the batch's draft plans (with their days/meals or weeks/workouts), and the draft
 * exercises the batch created that no remaining plan uses. Published rows are never touched.
 */
export const discardBatch = async (batchId: string, kind: string, planIds?: string[]) =>
  prisma.$transaction(async (tx) => {
    // Nothing new should start for plans that are being thrown away.
    if (!planIds) {
      await tx.aiGenerationJob.updateMany({
        where: { batchId, status: JOB_STATUS.queued },
        data: { status: JOB_STATUS.cancelled, finishedAt: new Date(), errorMessage: 'Discarded by an admin' },
      });
    }

    const ids = await draftPlanIds(tx, batchId, kind, planIds);
    await deleteDraftPlans(tx, kind, ids);
    if (kind === 'diet') return { plans: ids.length, exercises: 0 };

    return { plans: ids.length, exercises: await deleteUnusedDraftExercises(tx, batchId) };
  });

/** Counts of the batch's jobs by status, for the list page. */
export const jobCounts = async (batchIds: string[]) => {
  const rows = await prisma.aiGenerationJob.groupBy({
    by: ['batchId', 'status'],
    where: { batchId: { in: batchIds } },
    _count: { _all: true },
  });
  const counts: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    counts[row.batchId] ??= {};
    counts[row.batchId][row.status] = row._count._all;
  }
  return counts;
};

export const hasOpenJobs = async (batchId: string) =>
  (await prisma.aiGenerationJob.count({ where: { batchId, status: { in: OPEN_JOB_STATUSES } } })) > 0;
