import type { CheckResult, ExercisePlanDraft, KnownExercise } from './validate.js';
import type { DietPlanDraft } from './dietTools.js';
import type { JobContext } from './worker.js';
import type { ExerciseTags, NutritionSource, PendingMedia } from './constants.js';

export type LogEntry = { at: string; type: 'tool' | 'model' | 'critic' | 'media' | 'note'; name?: string; summary: string; costUsd?: number };

/** Everything one job's agent run keeps between steps. */
export type AgentState = {
  ctx: JobContext;
  batchId: string;
  spec: Record<string, unknown>;
  costUsd: number;
  log: LogEntry[];
  /** The draft plan this job saved (it is replaced on every later save). */
  planId: string | null;
  lastCheck: CheckResult | null;
  lastPlan: { kind: 'exercise'; plan: ExercisePlanDraft } | { kind: 'diet'; plan: DietPlanDraft } | null;
  createdExerciseIds: string[];
  exerciseLibrary?: Map<string, KnownExercise & { purpose: string | null; tags?: ExerciseTags | null }>;
  /** Lowercased names of plans that already exist, so a new plan can't reuse one. */
  existingPlanNames?: Map<string, string>;
  /** New pictures for exercises already live in the app; applied when the plan is published. */
  pendingMedia?: PendingMedia;
  /** Which USDA food each ingredient of the saved diet plan was matched to. */
  nutritionSources?: NutritionSource[];
  mealTypes?: { id: string; name: string }[];
  /** Daily totals of the last saved diet plan, for the critic. */
  dietTotals?: { dayNumber: number; kcal: number; protein: number; carbs: number; fat: number }[];
};

export type ToolResult = { result: unknown; summary: string };
