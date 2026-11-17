import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { CONTENT_STATUS } from '../../utils/contentStatus.js';
import type { ToolDefinition } from './openai.js';
import { EXERCISE_IMPACTS, EXERCISE_POSITIONS, ExerciseTags } from './constants.js';
import { checkExercisePlan, ExercisePlanDraft, ExerciseSpec, KnownExercise, WEEKDAYS } from './validate.js';
import type { AgentState, ToolResult } from './agentTypes.js';

/** Names compared loosely so "Push-Ups", "push up" and "Pushups" count as one exercise. */
export const normalizeExerciseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    // Plurals: "presses" -> "press", "lunges" -> "lunge", "pushups" -> "pushup".
    .replace(/sses$/, 'ss')
    .replace(/([^s])s$/, '$1');

const createExerciseArgs = z.object({
  name: z.string().trim().min(2).max(100),
  purpose: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
  instructions: z.string().trim().min(10).max(4000),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  durationPerSet: z.string().trim().max(50),
  caloriesBurnEstimate: z.number().int().min(1).max(2000),
  position: z.enum(EXERCISE_POSITIONS),
  impact: z.enum(EXERCISE_IMPACTS),
  equipment: z.array(z.string().trim().min(2).max(40)).max(6),
});

export const exerciseTagsSchema = z.object({
  position: z.enum(EXERCISE_POSITIONS),
  impact: z.enum(EXERCISE_IMPACTS),
  equipment: z.array(z.string().trim().min(1).max(40)).max(6),
});

/** Names that settle a label, whatever the AI said (it got these wrong in Nov 2026 testing). */
const FLOOR_NAMES = /hip thrust|glute bridge|bridge|russian twist|crunch|sit.?up|plank|push.?up|press.?up|dead bug|bird.?dog|mountain climber|leg raise|flutter kick|superman|bicycle|v.?up|hollow|burpee|clamshell|donkey kick|fire hydrant|cobra|child.?s pose/i;
const EQUIPMENT_NAMES: [RegExp, string][] = [
  [/dumbbell|goblet|farmer|renegade/i, 'dumbbells'],
  [/kettlebell/i, 'kettlebell'],
  [/barbell|deadlift|bench press|back squat|front squat/i, 'barbell or dumbbells'],
  [/overhead press|shoulder press|military press|romanian/i, 'dumbbells'],
  [/band\b|resistance band/i, 'resistance band'],
  [/cable/i, 'cable machine'],
  [/machine|pulldown|leg press|leg curl|leg extension|rowing|chest press/i, 'machine'],
  [/battle rope/i, 'battle ropes'],
  [/box jump|step.?up/i, 'box or step'],
  [/pull.?up|chin.?up/i, 'pull-up bar'],
];
const SEATED_NAMES = /machine|pulldown|leg press|leg curl|leg extension|rowing|chest press|seated/i;

/** Applies the name rules above on top of the stored labels. */
export const correctTags = (name: string | null | undefined, tags: ExerciseTags | null): ExerciseTags | null => {
  if (!tags || !name) return tags;
  const equipment = [...tags.equipment];
  for (const [pattern, item] of EQUIPMENT_NAMES) {
    if (pattern.test(name) && !equipment.some((have) => have.toLowerCase().includes(item.split(' ')[0]))) equipment.push(item);
  }
  const incline = /incline|wall|bench push/i.test(name);
  const position = FLOOR_NAMES.test(name) && !incline ? 'floor' : SEATED_NAMES.test(name) && tags.position === 'standing' ? 'seated' : tags.position;
  return { ...tags, position, equipment: equipment.slice(0, 6) };
};

/** Labels read back from the database; null when missing or not in the expected shape. */
export const readTags = (value: unknown, name?: string | null): ExerciseTags | null => {
  const parsed = exerciseTagsSchema.safeParse(value);
  return parsed.success ? correctTags(name, parsed.data) : null;
};

/** "floor, low impact, dumbbells" for lists the AI and the reviewer read. */
export const tagsText = (tags: ExerciseTags | null | undefined) =>
  tags ? `${tags.position}, ${tags.impact} impact, ${tags.equipment.length ? tags.equipment.join(' + ') : 'no equipment'}` : 'not labelled';

const savePlanArgs = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  weeks: z
    .array(
      z.object({
        weekNumber: z.number().int().min(1).max(52),
        days: z.array(
          z.object({
            dayOfWeek: z.string(),
            exercises: z.array(
              z.object({
                exerciseId: z.string().min(1),
                sets: z.number().int(),
                reps: z.string().max(50).nullable().optional(),
                duration: z.string().max(50),
              }),
            ),
          }),
        ),
      }),
    )
    .min(1),
});

export const exerciseToolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_exercises',
      description: 'Search the exercise library by name or purpose. Returns ids you can use in the plan.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'e.g. "squat", "core", "cardio"' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_exercise',
      description:
        'Add an exercise that is missing from the library. If one with the same name exists, its id is returned instead. Only create common, safe, well-known exercises.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Standard name, e.g. "Goblet Squat"' },
          purpose: { type: 'string', description: 'e.g. "strength", "cardio", "core", "mobility", "warm up"' },
          description: { type: 'string', description: 'What it trains and why, 1-3 sentences' },
          instructions: { type: 'string', description: 'Numbered step-by-step form cues, including a safety cue' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          durationPerSet: { type: 'string', description: 'Typical time per set, e.g. "45 sec"' },
          caloriesBurnEstimate: { type: 'integer', description: 'Approximate kcal for a typical session of this exercise' },
          position: { type: 'string', enum: [...EXERCISE_POSITIONS], description: 'floor = any part done lying, kneeling or with hands on the floor (planks, push-ups, bridges)' },
          impact: { type: 'string', enum: [...EXERCISE_IMPACTS], description: 'high = jumping, running or hopping' },
          equipment: { type: 'array', items: { type: 'string' }, description: 'Equipment needed, e.g. ["dumbbells"]; empty for bodyweight' },
        },
        required: ['name', 'purpose', 'description', 'instructions', 'difficulty', 'durationPerSet', 'caloriesBurnEstimate', 'position', 'impact', 'equipment'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_exercise_plan',
      description:
        'Save the whole plan as a draft (replaces any earlier save). Returns errors to fix if it breaks a rule; nothing is saved then. Call it again with the full corrected plan.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', description: 'Who it is for and what it achieves, 2-4 sentences' },
          weeks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                weekNumber: { type: 'integer' },
                days: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      dayOfWeek: { type: 'string', enum: [...WEEKDAYS] },
                      exercises: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            exerciseId: { type: 'string' },
                            sets: { type: 'integer' },
                            reps: { type: ['string', 'null'], description: 'e.g. "12", "8-10 each side", or null for timed sets' },
                            duration: { type: 'string', description: 'Time per set, e.g. "45 sec" or "2 min"' },
                          },
                          required: ['exerciseId', 'sets', 'reps', 'duration'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['dayOfWeek', 'exercises'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['weekNumber', 'days'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'description', 'weeks'],
        additionalProperties: false,
      },
    },
  },
];

/** Every exercise (drafts included), keyed by id; loaded once per job and kept up to date. */
export const library = async (state: AgentState): Promise<Map<string, KnownExercise & { purpose: string | null }>> => {
  if (!state.exerciseLibrary) {
    const rows = await prisma.exercise.findMany({ select: { id: true, name: true, difficulty: true, purpose: true, tags: true } });
    state.exerciseLibrary = new Map(rows.map((row) => [row.id, { ...row, tags: readTags(row.tags, row.name) }]));
  }
  return state.exerciseLibrary;
};

/** Names of the plans that already exist (lowercased -> as written), loaded once per job. */
export const existingPlanNames = async (state: AgentState, kind: 'exercise' | 'diet') => {
  if (!state.existingPlanNames) {
    const where = state.planId ? { id: { not: state.planId } } : {};
    const rows =
      kind === 'exercise'
        ? await prisma.exercisePlan.findMany({ where, select: { name: true } })
        : await prisma.dietPlan.findMany({ where, select: { name: true } });
    state.existingPlanNames = new Map(rows.filter((row) => row.name).map((row) => [String(row.name).trim().toLowerCase(), String(row.name)]));
  }
  return state.existingPlanNames;
};

/** Compact list for the agent's first message. */
export const exerciseCatalogText = async (state: AgentState) =>
  [...(await library(state)).values()]
    .slice(0, 300)
    .map((e) => `${e.id} | ${e.name} | ${e.difficulty ?? '-'} | ${e.purpose ?? '-'} | ${tagsText(e.tags)}`)
    .join('\n');

export const runExerciseTool = async (state: AgentState, name: string, args: unknown): Promise<ToolResult> => {
  if (name === 'search_exercises') {
    const query = String((args as { query?: string })?.query ?? '').toLowerCase().trim();
    const words = query.split(/\s+/).filter(Boolean);
    const matches = [...(await library(state)).values()]
      .filter((e) => words.some((word) => `${e.name ?? ''} ${e.purpose ?? ''}`.toLowerCase().includes(word)))
      .slice(0, 20);
    return {
      result: { matches: matches.map((e) => ({ id: e.id, name: e.name, difficulty: e.difficulty, purpose: e.purpose, labels: tagsText(e.tags) })) },
      summary: `"${query}": ${matches.length} found`,
    };
  }

  if (name === 'create_exercise') {
    const parsed = createExerciseArgs.safeParse(args);
    if (!parsed.success) return { result: { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, summary: 'invalid arguments' };
    const input = parsed.data;
    const all = await library(state);
    const key = normalizeExerciseName(input.name);
    const existing = [...all.values()].find((e) => e.name && normalizeExerciseName(e.name) === key);
    if (existing) return { result: { id: existing.id, name: existing.name, alreadyExisted: true }, summary: `reused "${existing.name}"` };

    const created = await prisma.exercise.create({
      data: {
        name: input.name,
        purpose: input.purpose,
        description: input.description,
        difficulty: input.difficulty,
        duration: input.durationPerSet,
        displayDuration: input.durationPerSet,
        caloriesBurnEstimate: input.caloriesBurnEstimate,
        tags: { position: input.position, impact: input.impact, equipment: input.equipment },
        status: CONTENT_STATUS.draft,
        aiBatchId: state.batchId,
        exerciseDetails: { create: { instructions: input.instructions, timeRequired: input.durationPerSet, calories: input.caloriesBurnEstimate } },
      },
      select: { id: true, name: true, difficulty: true, purpose: true },
    });
    all.set(created.id, { ...created, tags: { position: input.position, impact: input.impact, equipment: input.equipment } });
    state.createdExerciseIds.push(created.id);
    return { result: { id: created.id, name: created.name, alreadyExisted: false }, summary: `created "${created.name}"` };
  }

  if (name === 'save_exercise_plan') {
    const parsed = savePlanArgs.safeParse(args);
    if (!parsed.success) return { result: { saved: false, errors: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`) }, summary: 'invalid arguments' };
    const plan: ExercisePlanDraft = parsed.data;
    const check = checkExercisePlan(state.spec as unknown as ExerciseSpec, plan, await library(state));
    const taken = (await existingPlanNames(state, 'exercise')).get(plan.name.trim().toLowerCase());
    if (taken) check.errors.push(`A plan called "${taken}" already exists. Give this plan a clearly different name.`);
    state.lastCheck = check;
    if (check.errors.length) return { result: { saved: false, errors: check.errors.slice(0, 25), warnings: check.warnings }, summary: `rejected: ${check.errors.length} errors` };

    state.planId = await writeExercisePlanDraft(state, plan);
    state.lastPlan = { kind: 'exercise', plan };
    return { result: { saved: true, planId: state.planId, warnings: check.warnings }, summary: `saved (${check.warnings.length} warnings)` };
  }

  return { result: { error: `Unknown tool ${name}` }, summary: 'unknown tool' };
};

/** Creates the draft plan, or replaces the weeks of the one this job already saved. */
const writeExercisePlanDraft = async (state: AgentState, plan: ExercisePlanDraft) => {
  const spec = state.spec as unknown as ExerciseSpec;
  return prisma.$transaction(
    async (tx) => {
      const fields = { name: plan.name, description: plan.description, level: spec.level, durationWeeks: plan.weeks.length };
      let planId = state.planId;
      if (planId) {
        await tx.exercisePlanSchedule.deleteMany({ where: { week: { planId } } });
        await tx.exercisePlanWeek.deleteMany({ where: { planId } });
        await tx.exercisePlan.update({ where: { id: planId }, data: fields });
      } else {
        planId = (await tx.exercisePlan.create({ data: { ...fields, status: CONTENT_STATUS.draft, aiBatchId: state.batchId }, select: { id: true } })).id;
      }
      for (const week of [...plan.weeks].sort((a, b) => a.weekNumber - b.weekNumber)) {
        const weekRow = await tx.exercisePlanWeek.create({ data: { planId, weekNumber: week.weekNumber }, select: { id: true } });
        await tx.exercisePlanSchedule.createMany({
          data: week.days.flatMap((day) =>
            day.exercises.map((row, index) => ({
              weekId: weekRow.id,
              exerciseId: row.exerciseId,
              dayOfWeek: day.dayOfWeek,
              sets: row.sets,
              reps: row.reps || null,
              duration: row.duration,
              orderIndex: index + 1,
            })),
          ),
        });
      }
      return planId;
    },
    { timeout: 30_000 },
  );
};

/** Readable plan text for the critic. */
export const describeExercisePlan = (state: AgentState, plan: ExercisePlanDraft) => {
  const names = state.exerciseLibrary ?? new Map();
  return [
    `${plan.name}: ${plan.description}`,
    ...plan.weeks.flatMap((week) => [
      `Week ${week.weekNumber}`,
      ...week.days.map(
        (day) =>
          `  ${day.dayOfWeek}: ${day.exercises
            .map((row) => `${names.get(row.exerciseId)?.name ?? row.exerciseId} ${row.sets}x${row.reps ?? row.duration}${row.reps ? ` (${row.duration})` : ''}`)
            .join('; ')}`,
      ),
    ]),
    'Exercise labels (set by us; trust them over the name):',
    ...[...new Set(plan.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.map((row) => row.exerciseId))))].map(
      (id) => `  ${names.get(id)?.name ?? id}: ${tagsText(names.get(id)?.tags)}`,
    ),
  ].join('\n');
};
