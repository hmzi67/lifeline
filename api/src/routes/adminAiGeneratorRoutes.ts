import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import {
  cancelBatch,
  createBatch,
  createBatchSchema,
  discardBatch,
  hasOpenJobs,
  jobCounts,
  publishBatch,
  retryJob,
  reviseJob,
  RetryJobError,
} from '../services/aiGenerator/batchService.js';
import { BATCH_STATUS, DIET_GOALS, DIET_TYPES, EXERCISE_LEVELS, FOCUS_AREAS, LIMITS } from '../services/aiGenerator/constants.js';
import type { ReviewData } from '../services/aiGenerator/constants.js';
import { aiSettings, isOpenAiConfigured } from '../services/aiGenerator/openai.js';

/** Admin API for the AI plan generator: start batches, follow them, publish or discard drafts. */
const router = Router();
router.use(authenticate, authorize(['admin']));

const planIdsSchema = z.object({ planIds: z.array(z.string().min(1)).min(1).max(100).optional() });

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? 'Invalid request';

const findBatch = (id: string) => prisma.aiGenerationBatch.findUnique({ where: { id } });

// GET /api/admin/ai-generator/status - Which services are set up, and the form's choices (no key values)
router.get('/status', (_req: Request, res: Response) => {
  const settings = aiSettings();
  res.json({
    success: true,
    data: {
      openai: isOpenAiConfigured(),
      usda: Boolean(process.env.USDA_API_KEY),
      pixabay: Boolean(process.env.PIXABAY_API_KEY),
      models: { agent: settings.agentModel, critic: settings.criticModel, image: settings.imageModel },
      imageCostUsd: settings.imageCostUsd,
      choices: { dietGoals: DIET_GOALS, dietTypes: DIET_TYPES, levels: EXERCISE_LEVELS, focusAreas: FOCUS_AREAS },
      limits: { maxPlansPerBatch: LIMITS.maxPlansPerBatch, maxCostCapUsd: LIMITS.maxCostCapUsd },
    },
  });
});

// POST /api/admin/ai-generator/batches - Queue a batch of plans
router.post('/batches', async (req: Request, res: Response) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  const batch = await createBatch(parsed.data, (req as AuthenticatedRequest).user?.id ?? null);
  res.status(201).json({ success: true, data: batch });
});

// GET /api/admin/ai-generator/batches - Newest batches with job counts
router.get('/batches', async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const batches = await prisma.aiGenerationBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { createdBy: { select: { id: true, email: true, username: true } } },
  });
  const counts = await jobCounts(batches.map((batch) => batch.id));
  res.json({ success: true, data: batches.map((batch) => ({ ...batch, jobCounts: counts[batch.id] ?? {} })) });
});

// GET /api/admin/ai-generator/batches/:id - One batch with its jobs (and their agent logs)
router.get('/batches/:id', async (req: Request<{ id: string }>, res: Response) => {
  const batch = await prisma.aiGenerationBatch.findUnique({
    where: { id: req.params.id },
    include: {
      jobs: { orderBy: { position: 'asc' } },
      createdBy: { select: { id: true, email: true, username: true } },
    },
  });
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  const planSelect = { id: true, name: true, status: true, image: true, description: true } as const;
  const plans =
    batch.kind === 'diet'
      ? await prisma.dietPlan.findMany({ where: { aiBatchId: batch.id }, select: planSelect })
      : await prisma.exercisePlan.findMany({ where: { aiBatchId: batch.id }, select: planSelect });
  res.json({ success: true, data: { ...batch, plans } });
});

// GET /api/admin/ai-generator/batches/:id/plans/:planId - A plan of this batch, for review
router.get('/batches/:id/plans/:planId', async (req: Request<{ id: string; planId: string }>, res: Response) => {
  const batch = await findBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  const plan = await planPreview(batch.id, batch.kind, req.params.planId);
  if (!plan) {
    res.status(404).json({ success: false, message: 'This plan is not part of the batch' });
    return;
  }
  res.json({ success: true, data: plan });
});

/** What the plan's job kept for review: held-back pictures and where nutrition numbers came from. */
const reviewDataFor = async (batchId: string, planId: string): Promise<ReviewData> => {
  const job = await prisma.aiGenerationJob.findFirst({ where: { batchId, resultPlanId: planId }, select: { reviewData: true } });
  return (job?.reviewData ?? {}) as ReviewData;
};

const planPreview = async (batchId: string, kind: string, planId: string) => {
  const review = await reviewDataFor(batchId, planId);
  if (kind === 'diet') {
    const plan = await prisma.dietPlan.findFirst({
      where: { id: planId, aiBatchId: batchId },
      select: {
        id: true, name: true, description: true, status: true, image: true, goal: true, calories: true, duration: true, cuisineName: true,
        dietPlanDays: {
          orderBy: { dayNumber: 'asc' },
          select: {
            dayNumber: true,
            dietPlanMeals: {
              select: { id: true, name: true, calories: true, protein: true, carbs: true, fats: true, portionSize: true, image: true, recipe: true, mealType: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!plan) return null;
    const { dietPlanDays, ...rest } = plan;
    return {
      kind: 'diet' as const,
      ...rest,
      nutritionSources: review.nutritionSources ?? [],
      days: dietPlanDays.map((day) => ({
        dayNumber: day.dayNumber,
        meals: day.dietPlanMeals.map(({ mealType, ...meal }) => ({ ...meal, mealType: mealType?.name ?? '' })),
      })),
    };
  }

  const plan = await prisma.exercisePlan.findFirst({
    where: { id: planId, aiBatchId: batchId },
    select: {
      id: true, name: true, description: true, status: true, image: true, level: true, durationWeeks: true,
      exercisePlanWeeks: {
        orderBy: { weekNumber: 'asc' },
        select: {
          weekNumber: true,
          exercisePlanSchedule: {
            orderBy: { orderIndex: 'asc' },
            select: {
              dayOfWeek: true, sets: true, reps: true, duration: true,
              exercise: { select: { id: true, name: true, image: true, videoUrl: true, difficulty: true, status: true, aiBatchId: true } },
            },
          },
        },
      },
    },
  });
  if (!plan) return null;
  const { exercisePlanWeeks: weeks, ...rest } = plan;
  return {
    kind: 'exercise' as const,
    ...rest,
    weeks: weeks.map((week) => {
      const days = new Map<string, unknown[]>();
      for (const row of week.exercisePlanSchedule) {
        const { exercise, dayOfWeek, ...set } = row;
        const list = days.get(dayOfWeek) ?? [];
        // A live exercise's new picture is held until publish; the preview shows what will go live.
        const pending = review.pendingMedia?.[exercise.id];
        const held = pending && (pending.image ?? exercise.image) === exercise.image && (pending.videoUrl ?? exercise.videoUrl) === exercise.videoUrl ? undefined : pending;
        list.push({
          ...set,
          exercise: {
            ...exercise,
            image: held?.image ?? exercise.image,
            videoUrl: held?.videoUrl ?? exercise.videoUrl,
            pictureOnPublish: !!held,
            createdByBatch: exercise.aiBatchId === batchId,
          },
        });
        days.set(dayOfWeek, list);
      }
      return { weekNumber: week.weekNumber, days: [...days].map(([dayOfWeek, exercises]) => ({ dayOfWeek, exercises })) };
    }),
  };
};

const mediaSchema = z
  .object({
    target: z.enum(['plan', 'meal', 'exercise']),
    id: z.string().min(1),
    image: z.string().trim().url().max(2000).nullable().optional(),
    videoUrl: z.string().trim().url().max(2000).nullable().optional(),
  })
  .refine((body) => body.image !== undefined || body.videoUrl !== undefined, 'Send an image or a video link');

// POST /api/admin/ai-generator/batches/:id/media - Set a picture (or exercise video) on something this batch made
router.post('/batches/:id/media', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = mediaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  const batch = await findBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  const { target, id, image, videoUrl } = parsed.data;
  const notFound = () => res.status(404).json({ success: false, message: 'Not part of this batch' });

  if (target === 'plan') {
    const where = { id, aiBatchId: batch.id };
    const updated =
      batch.kind === 'diet'
        ? await prisma.dietPlan.updateMany({ where, data: { image: image ?? null } })
        : await prisma.exercisePlan.updateMany({ where, data: { image: image ?? null } });
    if (!updated.count) return notFound();
    res.json({ success: true, data: { updated: updated.count } });
    return;
  }

  if (target === 'meal') {
    const meal = await prisma.dietPlanMeal.findFirst({ where: { id, day: { diet: { aiBatchId: batch.id } } }, select: { name: true, day: { select: { dietId: true } } } });
    if (!meal) return notFound();
    // The same dish repeats across days; it gets the same picture everywhere in the plan.
    const updated = await prisma.dietPlanMeal.updateMany({ where: { name: meal.name, day: { dietId: meal.day.dietId } }, data: { image: image ?? null } });
    res.json({ success: true, data: { updated: updated.count } });
    return;
  }

  // Only exercises this batch created; library exercises are edited on the Exercises page.
  const data = { ...(image !== undefined ? { image } : {}), ...(videoUrl !== undefined ? { videoUrl } : {}) };
  const updated = await prisma.exercise.updateMany({ where: { id, aiBatchId: batch.id }, data });
  if (!updated.count) return notFound();
  res.json({ success: true, data: { updated: updated.count } });
});

// POST /api/admin/ai-generator/batches/:id/cancel - Stop jobs that haven't started
router.post('/batches/:id/cancel', async (req: Request<{ id: string }>, res: Response) => {
  const batch = await findBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  if (batch.status === BATCH_STATUS.completed || batch.status === BATCH_STATUS.cancelled) {
    res.status(409).json({ success: false, message: `This batch is already ${batch.status}.` });
    return;
  }
  res.json({ success: true, data: await cancelBatch(batch.id) });
});

// POST /api/admin/ai-generator/batches/:id/jobs/:jobId/retry - Make one plan again with the same settings
const retrySchema = z.object({ raiseCapByUsd: z.number().min(0.5).max(20).optional() });
router.post('/batches/:id/jobs/:jobId/retry', async (req: Request<{ id: string; jobId: string }>, res: Response) => {
  const parsed = retrySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  try {
    res.json({ success: true, data: await retryJob(req.params.id, req.params.jobId, parsed.data.raiseCapByUsd) });
  } catch (error) {
    if (!(error instanceof RetryJobError)) throw error;
    res.status(error.httpStatus).json({ success: false, message: error.message, code: error.code });
  }
});

// POST /api/admin/ai-generator/batches/:id/jobs/:jobId/revise - New plan: this one with the picked coach ideas applied
const reviseSchema = z.object({
  ideas: z.array(z.string().trim().min(3).max(600)).min(1).max(12),
  raiseCapByUsd: z.number().min(0.5).max(20).optional(),
});
router.post('/batches/:id/jobs/:jobId/revise', async (req: Request<{ id: string; jobId: string }>, res: Response) => {
  const parsed = reviseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  try {
    res.json({ success: true, data: await reviseJob(req.params.id, req.params.jobId, parsed.data.ideas, parsed.data.raiseCapByUsd) });
  } catch (error) {
    if (!(error instanceof RetryJobError)) throw error;
    res.status(error.httpStatus).json({ success: false, message: error.message, code: error.code });
  }
});

// POST /api/admin/ai-generator/batches/:id/publish - Publish all (or the picked) draft plans
router.post('/batches/:id/publish', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = planIdsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  const batch = await findBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  res.json({ success: true, data: await publishBatch(batch.id, batch.kind, parsed.data.planIds) });
});

// POST /api/admin/ai-generator/batches/:id/discard - Delete all (or the picked) draft plans
router.post('/batches/:id/discard', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = planIdsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    return;
  }
  const batch = await findBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, message: 'Batch not found' });
    return;
  }
  // A running job may still save a draft; discarding everything now would miss it.
  if (!parsed.data.planIds && batch.status === BATCH_STATUS.running && (await hasOpenJobs(batch.id))) {
    res.status(409).json({ success: false, message: 'This batch is still running. Cancel it first, then discard.' });
    return;
  }
  res.json({ success: true, data: await discardBatch(batch.id, batch.kind, parsed.data.planIds) });
});

export default router;
