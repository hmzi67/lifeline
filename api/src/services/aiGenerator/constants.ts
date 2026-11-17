/** Shared values for the AI plan generator (batches of draft plans made by an LLM agent). */

export const PLAN_KINDS = ['diet', 'exercise'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/** Where a batch gets its images (and exercise videos) from. */
/** stock_or_ai: try a stock match first and generate with AI when there is none. */
export const MEDIA_SOURCES = ['ai_generated', 'stock', 'stock_or_ai', 'admin_upload'] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export const BATCH_STATUS = {
  queued: 'queued',
  running: 'running',
  /** Every job finished, whether or not each one succeeded. */
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export const JOB_STATUS = {
  queued: 'queued',
  running: 'running',
  succeeded: 'succeeded',
  /** A draft was saved but still fails some checks; an admin should look before publishing. */
  needsAttention: 'needs_attention',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/** Jobs still waiting for or holding the worker. */
export const OPEN_JOB_STATUSES: string[] = [JOB_STATUS.queued, JOB_STATUS.running];

/** Choices the admin form offers; they match the app's onboarding options. */
/** Same keys as DIET_PLAN_GOALS in dietPlanController (the app matches a user's goal against them). */
export const DIET_GOALS = ['weight_loss', 'weight_gain', 'build_muscle'] as const;
export const DIET_TYPES = [
  'Traditional',
  'Vegetarian',
  'Keto',
  'Pescatarian',
  'Vegan (Plant diet)',
  'Paleo',
  'Mediterranean',
  'Diabetes type 1',
  'Diabetes type 2',
  'High-Protein',
  'Calorie-Cutting',
  'High Calories',
] as const;
export const EXERCISE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const FOCUS_AREAS = ['Full Body', 'Shoulders', 'Chest', 'Arms', 'Back', 'Belly', 'Legs'] as const;

/** Labels on an exercise that the code checks a batch's rules against. */
export const EXERCISE_POSITIONS = ['standing', 'seated', 'floor'] as const;
export const EXERCISE_IMPACTS = ['low', 'high'] as const;
export type ExerciseTags = { position: (typeof EXERCISE_POSITIONS)[number]; impact: (typeof EXERCISE_IMPACTS)[number]; equipment: string[] };

/** What a job keeps for the admin's review (ai_generation_jobs.review_data). */
export type PendingMedia = Record<string, { image?: string; videoUrl?: string }>;
export type NutritionSource = { ingredient: string; usdaMatch: string; kcalPer100g: number };
export type ReviewData = { pendingMedia?: PendingMedia; nutritionSources?: NutritionSource[]; suggestions?: string[] };

export const LIMITS = {
  maxPlansPerBatch: 30,
  maxCostCapUsd: 100,
  /** Roughly what one plan costs (Nov 2026: diet $0.60-0.70); Retry/Apply ideas need this much left. */
  typicalPlanCostUsd: 0.8,
  /** A running job whose lock is older than this was cut off (e.g. the API restarted). */
  staleJobMs: 15 * 60_000,
  /** A job is tried at most this many times before it is marked failed. */
  maxAttempts: 2,
  /** Writing and reviewing one plan may not run longer than this (pictures are timed separately). */
  jobTimeoutMs: 10 * 60_000,
  /**
   * Time allowed for a plan's pictures and videos. Running out only leaves some pictures missing;
   * the plan itself is kept. Shorter than staleJobMs, which is counted from the start of this step.
   */
  mediaTimeoutMs: 12 * 60_000,
  workerTickMs: 10_000,
};
