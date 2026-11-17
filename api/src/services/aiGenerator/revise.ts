/**
 * "Apply ideas": an admin picks some of the coach review's optional ideas for a plan, and a new
 * job of the same batch makes a revised copy of it. The original draft is never touched, so the
 * admin can publish whichever version they prefer and discard the other.
 */
import { prisma } from '../../config/database.js';
import type { DietPlanDraft } from './dietTools.js';
import type { ExercisePlanDraft } from './validate.js';

/** Stored on the new job's spec. */
export type Revision = { fromJobId: string; fromPlanId: string | null; fromPosition: number; ideas: string[] };

export const revisionOf = (spec: Record<string, unknown>): Revision | null => {
  const value = spec.revision as Revision | undefined;
  return value && Array.isArray(value.ideas) && value.ideas.length ? value : null;
};

/**
 * The spec the agent and the reviewer see: the picked ideas join the admin's notes, so the
 * reviewer treats an idea that wasn't applied as breaking the notes (a must-fix).
 */
export const revisedSpec = (spec: Record<string, unknown>) => {
  const revision = revisionOf(spec);
  if (!revision) return spec;
  const rest = { ...spec };
  delete rest.revision;
  const ideas = `Changes picked from an earlier coach review, which this plan must include: ${revision.ideas.join(' ')}`;
  return { ...rest, brief: [rest.brief, ideas].filter(Boolean).join('\n') };
};

/** Parses the ingredient list our draft writer puts at the top of a meal's recipe. */
const splitRecipe = (recipe: string | null) => {
  const text = recipe ?? '';
  const match = /^Ingredients:\n((?:- .+\n?)+)\n?([\s\S]*)$/.exec(text);
  if (!match) return { ingredients: [], recipe: text.trim() };
  const ingredients = match[1]
    .split('\n')
    .map((line) => /^- (.+): (\d+(?:\.\d+)?) g$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ name: m[1], grams: Number(m[2]) }));
  return { ingredients, recipe: match[2].trim() };
};

export const loadDietDraft = async (planId: string): Promise<DietPlanDraft | null> => {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      name: true,
      description: true,
      dietPlanDays: { orderBy: { dayNumber: 'asc' }, select: { dayNumber: true, dietPlanMeals: { select: { name: true, recipe: true, mealType: { select: { name: true } } } } } },
    },
  });
  if (!plan) return null;
  return {
    name: plan.name ?? '',
    description: plan.description ?? '',
    days: plan.dietPlanDays.map((day) => ({
      dayNumber: day.dayNumber,
      meals: day.dietPlanMeals.map((meal) => ({ mealType: meal.mealType.name, name: meal.name ?? '', ...splitRecipe(meal.recipe) })),
    })),
  };
};

export const loadExerciseDraft = async (planId: string): Promise<ExercisePlanDraft | null> => {
  const plan = await prisma.exercisePlan.findUnique({
    where: { id: planId },
    select: {
      name: true,
      description: true,
      exercisePlanWeeks: {
        orderBy: { weekNumber: 'asc' },
        select: { weekNumber: true, exercisePlanSchedule: { orderBy: { orderIndex: 'asc' }, select: { exerciseId: true, dayOfWeek: true, sets: true, reps: true, duration: true } } },
      },
    },
  });
  if (!plan) return null;
  return {
    name: plan.name ?? '',
    description: plan.description ?? '',
    weeks: plan.exercisePlanWeeks.map((week) => {
      const days = new Map<string, ExercisePlanDraft['weeks'][number]['days'][number]>();
      for (const row of week.exercisePlanSchedule) {
        const day = days.get(row.dayOfWeek) ?? { dayOfWeek: row.dayOfWeek, exercises: [] };
        day.exercises.push({ exerciseId: row.exerciseId, sets: row.sets ?? 1, reps: row.reps, duration: row.duration ?? '' });
        days.set(row.dayOfWeek, day);
      }
      return { weekNumber: week.weekNumber, days: [...days.values()] };
    }),
  };
};

/** The agent's first instruction for a revision, after the usual brief. */
export const revisionText = (revision: Revision, current: unknown) =>
  current
    ? `This is a revision of plan #${revision.fromPosition + 1} of this batch. Here it is as last saved (JSON):
${JSON.stringify(current)}

Make these changes the admin picked from its coach review:
- ${revision.ideas.join('\n- ')}

Keep everything else as it is. The original plan stays in the batch, so give this version a new name close to the original (e.g. one extra word), and keep the description unless a change needs it updated. Then save the complete revised plan.`
    : `The plan these changes were meant for no longer exists, so make a new plan that follows the brief and includes:
- ${revision.ideas.join('\n- ')}`;
