import type { ExerciseTags } from './constants.js';
import { Macro, macroProblems, macroTargets, maxPortionGrams } from './macros.js';
/**
 * Deterministic checks on a generated plan. Errors block saving and go back to the agent to fix;
 * warnings are saved with the job for the admin and don't block.
 */

export type CheckResult = { errors: string[]; warnings: string[] };

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Minutes in a duration like "45 sec", "10 min" or "1.5 minutes"; null when it can't be read. */
export const durationMinutes = (value: string | null | undefined): number | null => {
  const match = String(value ?? '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2].startsWith('s') ? amount / 60 : amount;
};

// ---------------------------------------------------------------- exercise plans

export type ExerciseSpec = { level: string; focusArea: string; weeks: number; daysPerWeek: number; minutesPerSession: number } & ExerciseRules;
export type ExerciseRow = { exerciseId: string; sets: number; reps?: string | null; duration: string };
export type ExercisePlanDraft = {
  name: string;
  description: string;
  weeks: { weekNumber: number; days: { dayOfWeek: string; exercises: ExerciseRow[] }[] }[];
};
export type KnownExercise = { id: string; name: string | null; difficulty: string | null; tags?: ExerciseTags | null };

/** The batch's yes/no rules, checked by code against each exercise's labels. */
export type ExerciseRules = { noFloorExercises?: boolean; lowImpactOnly?: boolean; bodyweightOnly?: boolean };

/** Plain-language list of the rules that are switched on, for the AI's instructions. */
export const describeRules = (rules: ExerciseRules) => [
  ...(rules.noFloorExercises ? ['no floor exercises (standing or seated only)'] : []),
  ...(rules.lowImpactOnly ? ['low impact only (no jumping or running)'] : []),
  ...(rules.bodyweightOnly ? ['bodyweight only (no equipment)'] : []),
];

/** Rest assumed after every set when estimating how long a session takes. */
export const REST_PER_SET_MIN = 0.5;
/** Accepted session length (sets x (duration + rest)) around the requested minutes. */
export const sessionBand = (minutesPerSession: number) => ({ low: Math.round(minutesPerSession * 0.5), high: Math.round(minutesPerSession * 1.4) });

const LEVEL_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

export const checkExercisePlan = (spec: ExerciseSpec, plan: ExercisePlanDraft, known: Map<string, KnownExercise>): CheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.name?.trim() || plan.name.length > 100) errors.push('The plan needs a name of at most 100 characters.');
  if (!plan.description?.trim()) errors.push('The plan needs a description.');
  const hasRules = !!(spec.noFloorExercises || spec.lowImpactOnly || spec.bodyweightOnly);
  const ruleBreaks = new Set<string>();
  const unlabelled = new Set<string>();

  const weekNumbers = plan.weeks.map((w) => w.weekNumber).sort((a, b) => a - b);
  const expected = Array.from({ length: spec.weeks }, (_, i) => i + 1);
  if (weekNumbers.join() !== expected.join()) errors.push(`The plan must have exactly weeks ${expected.join(', ')} (got ${weekNumbers.join(', ') || 'none'}).`);

  for (const week of plan.weeks) {
    const label = `Week ${week.weekNumber}`;
    if (week.days.length !== spec.daysPerWeek) errors.push(`${label} must have ${spec.daysPerWeek} workout days (has ${week.days.length}).`);
    const seenDays = new Set<string>();
    for (const day of week.days) {
      const where = `${label} ${day.dayOfWeek}`;
      if (!WEEKDAYS.includes(day.dayOfWeek as (typeof WEEKDAYS)[number])) errors.push(`${where}: day must be one of ${WEEKDAYS.join(', ')}.`);
      if (seenDays.has(day.dayOfWeek)) errors.push(`${where} appears twice.`);
      seenDays.add(day.dayOfWeek);
      if (day.exercises.length < 3 || day.exercises.length > 10) errors.push(`${where}: use 3 to 10 exercises (has ${day.exercises.length}).`);

      let minutes = 0;
      const seenExercises = new Set<string>();
      for (const row of day.exercises) {
        const exercise = known.get(row.exerciseId);
        if (!exercise) {
          errors.push(`${where}: exercise id "${row.exerciseId}" doesn't exist. Use an id from search_exercises or create_exercise.`);
          continue;
        }
        if (seenExercises.has(row.exerciseId)) errors.push(`${where}: "${exercise.name}" is used twice on the same day.`);
        seenExercises.add(row.exerciseId);
        if (!Number.isInteger(row.sets) || row.sets < 1 || row.sets > 6) errors.push(`${where}: "${exercise.name}" needs 1 to 6 sets.`);
        const perSet = durationMinutes(row.duration);
        if (perSet == null || perSet <= 0 || perSet > 30) {
          errors.push(`${where}: "${exercise.name}" duration "${row.duration}" must look like "45 sec" or "2 min" (per set, at most 30 min).`);
        } else {
          minutes += (perSet + REST_PER_SET_MIN) * row.sets;
        }
        const planRank = LEVEL_RANK[spec.level] ?? 2;
        const exerciseRank = LEVEL_RANK[String(exercise.difficulty ?? '').toLowerCase()];
        if (exerciseRank && exerciseRank > planRank + 1) warnings.push(`${where}: "${exercise.name}" is ${exercise.difficulty} in a ${spec.level} plan.`);
        if (hasRules) {
          if (!exercise.tags) unlabelled.add(String(exercise.name));
          else {
            if (spec.noFloorExercises && exercise.tags.position === 'floor') {
              ruleBreaks.add(`"${exercise.name}" is done on the floor, but this plan allows no floor exercises. Replace it everywhere with a standing or seated exercise.`);
            }
            if (spec.lowImpactOnly && exercise.tags.impact === 'high') {
              ruleBreaks.add(`"${exercise.name}" is high impact (jumping or running), but this plan is low impact only. Replace it everywhere with a low-impact exercise.`);
            }
            if (spec.bodyweightOnly && exercise.tags.equipment.length) {
              ruleBreaks.add(`"${exercise.name}" needs equipment (${exercise.tags.equipment.join(', ')}), but this plan is bodyweight only. Replace it everywhere with a bodyweight exercise.`);
            }
          }
        }
      }
      const { low, high } = sessionBand(spec.minutesPerSession);
      // Compare the same rounded number the message shows, so "15 min" never fails a 15 min minimum.
      const shown = Math.round(minutes);
      if (day.exercises.length && (shown < low || shown > high)) {
        // One typical set (45 sec + 30 sec rest) is 1.25 min; tell the model roughly how many to change.
        const sets = Math.max(1, Math.ceil((shown < low ? low - minutes : minutes - high) / 1.25));
        const setsText = `${sets} set${sets === 1 ? '' : 's'}`;
        if (shown < low) {
          // A slightly short day is still usable, so it doesn't block saving (it cost many retries).
          warnings.push(`${where} is a bit short: about ${shown} min, aim for ${low}-${high} min (add about ${setsText} or an exercise).`);
        } else {
          errors.push(`${where} is too long: about ${shown} min, it must be ${low}-${high} min (remove about ${setsText} or an exercise).`);
        }
      }
    }
  }

  // One line per exercise, not one per day it appears on.
  errors.push(...ruleBreaks);
  if (unlabelled.size) warnings.push(`These exercises have no labels yet, so the plan's rules couldn't be checked for them: ${[...unlabelled].join(', ')}.`);

  const fingerprint = (week: ExercisePlanDraft['weeks'][number]) =>
    JSON.stringify(week.days.map((d) => d.exercises.map((e) => [e.exerciseId, e.sets, e.reps ?? '', e.duration])));
  const prints = plan.weeks.map(fingerprint);
  if (prints.length > 1 && new Set(prints).size === 1) warnings.push('Every week is identical; later weeks should progress (more sets, time or harder variations).');

  return { errors, warnings };
};

// ---------------------------------------------------------------- diet plans

export type DietSpec = { goal: string; dietType: string; caloriesPerDay?: number; days: number; mealsPerDay: number };
export type DietMealComputed = { mealType: string; name: string; kcal: number; protein: number; carbs: number; fat: number; ingredients: string[]; ingredientList?: { name: string; grams: number }[]; missing: string[] };
export type DietDayComputed = { dayNumber: number; meals: DietMealComputed[] };

/** Daily calories to aim for when the admin didn't set one. */
export const defaultCalories = (goal: string) => (goal === 'weight_loss' ? 1700 : goal === 'weight_gain' ? 2900 : goal === 'build_muscle' ? 2600 : 2200);

type ScalablePlan = { days: { dayNumber: number; meals: { ingredients: { name: string; grams: number }[] }[] }[] };

/**
 * Scales each day's portions (every ingredient's grams by one factor) so the day lands on the
 * calorie target. Calories come from grams, so this is exact apart from rounding, and the meals
 * and their protein/carb/fat balance stay the same. The model kept over- and undershooting when it
 * had to do this itself. Days already within 5% are left alone; days more than 2x off are left for
 * the model, since the menu itself is probably wrong.
 */
export const scalePortionsToTarget = <T extends ScalablePlan>(plan: T, dayKcal: Map<number, number>, target: number) => {
  const adjusted: { dayNumber: number; fromKcal: number }[] = [];
  const roundGrams = (grams: number) => (grams < 20 ? Math.max(1, Math.round(grams)) : Math.round(grams / 5) * 5);
  const days = plan.days.map((day) => {
    const kcal = dayKcal.get(day.dayNumber) ?? 0;
    if (!kcal || !target || Math.abs(kcal - target) <= target * 0.05) return day;
    const factor = target / kcal;
    if (factor < 0.5 || factor > 2) return day;
    adjusted.push({ dayNumber: day.dayNumber, fromKcal: Math.round(kcal) });
    return {
      ...day,
      meals: day.meals.map((meal) => ({ ...meal, ingredients: meal.ingredients.map((item) => ({ ...item, grams: roundGrams(item.grams * factor) })) })),
    };
  });
  return { plan: { ...plan, days } as T, adjusted };
};

const MEAT = ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'turkey', 'bacon', 'ham', 'sausage', 'veal', 'duck', 'goat'];
const FISH = ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'sardine', 'mackerel', 'tilapia', 'crab', 'anchovy', 'trout', 'seafood'];
const ANIMAL = ['egg', 'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'honey', 'whey', 'ghee', 'paneer'];
const GRAINS_AND_LEGUMES = ['rice', 'wheat', 'bread', 'pasta', 'oat', 'barley', 'bean', 'lentil', 'chickpea', 'pea', 'peanut', 'soy', 'tofu', 'corn', 'quinoa'];

/** What to change when portions alone couldn't bring a macro into range. */
const MACRO_HINTS: Record<Macro, { low: string; high: string }> = {
  protein: { low: 'swap a bread- or rice-heavy meal for a protein dish (chicken, mutton, fish, eggs, dal, chana, dahi or paneer)', high: 'add a portion of bread, rice, fruit or vegetables' },
  carbs: { low: 'add bread, rice, fruit or lentils to a meal', high: 'use less bread, rice and sweets, and more vegetables, meat, eggs or dal' },
  fat: { low: 'add a little oil, nuts or full-fat dahi', high: 'use less oil, ghee and fried food' },
};

const hasWord = (text: string, words: string[]) => words.some((word) => new RegExp(`\\b${word}`, 'i').test(text));

export const checkDietPlan = (spec: DietSpec, days: DietDayComputed[], mealTypes: string[]): CheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const target = spec.caloriesPerDay ?? defaultCalories(spec.goal);
  const type = spec.dietType.toLowerCase();

  const dayNumbers = days.map((d) => d.dayNumber).sort((a, b) => a - b);
  const expected = Array.from({ length: spec.days }, (_, i) => i + 1);
  if (dayNumbers.join() !== expected.join()) errors.push(`The plan must have exactly days ${expected.join(', ')} (got ${dayNumbers.join(', ') || 'none'}).`);

  for (const day of days) {
    const label = `Day ${day.dayNumber}`;
    if (day.meals.length !== spec.mealsPerDay) errors.push(`${label} must have ${spec.mealsPerDay} meals (has ${day.meals.length}).`);
    const names = new Set<string>();
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const meal of day.meals) {
      const where = `${label} "${meal.name}"`;
      if (!mealTypes.includes(meal.mealType)) errors.push(`${where}: meal type must be one of ${mealTypes.join(', ')}.`);
      if (names.has(meal.name.toLowerCase())) errors.push(`${where} appears twice on the same day.`);
      names.add(meal.name.toLowerCase());
      if (meal.missing.length) errors.push(`${where}: USDA has no match for ${meal.missing.map((m) => `"${m}"`).join(', ')}. Use plain ingredient names like "chicken breast, raw" or "brown rice, cooked".`);
      if (meal.ingredients.length < 2) errors.push(`${where}: list every ingredient with grams (at least 2).`);
      for (const item of meal.ingredientList ?? []) {
        const max = maxPortionGrams(item.name);
        if (item.grams > max) errors.push(`${where}: ${Math.round(item.grams)} g of "${item.name}" is too much for one meal (at most ${max} g). Add another dish or a snack instead of making one food bigger.`);
      }

      const text = meal.ingredients.join(' ');
      if (type.startsWith('vegan') && (hasWord(text, MEAT) || hasWord(text, FISH) || hasWord(text, ANIMAL))) errors.push(`${where}: a vegan plan can't use meat, fish, eggs, dairy or honey.`);
      if (type === 'vegetarian' && (hasWord(text, MEAT) || hasWord(text, FISH))) errors.push(`${where}: a vegetarian plan can't use meat or fish.`);
      if (type === 'pescatarian' && hasWord(text, MEAT)) errors.push(`${where}: a pescatarian plan can't use meat (fish is fine).`);
      if (type === 'paleo' && hasWord(text, GRAINS_AND_LEGUMES)) warnings.push(`${where}: paleo plans usually avoid grains, legumes and soy.`);

      kcal += meal.kcal;
      protein += meal.protein;
      carbs += meal.carbs;
      fat += meal.fat;
    }

    if (day.meals.length) {
      if (Math.abs(kcal - target) > target * 0.1) errors.push(`${label}: ${Math.round(kcal)} kcal; must be within 10% of ${target} kcal. Adjust portions (grams).`);
      // Our code already moved the portions toward these on save; what is left needs other dishes.
      for (const problem of macroProblems({ kcal, protein, carbs, fat }, macroTargets(spec.goal, spec.dietType))) {
        const [low, high] = problem.range;
        const tooLow = problem.percent < low;
        if (type === 'keto' && problem.macro === 'carbs' && !tooLow) {
          errors.push(`${label}: ${Math.round(carbs)} g carbs; keto needs 50 g or less (and under 10% of calories). Replace bread, rice, lentils, potatoes and fruit with meat, eggs, paneer and leafy vegetables.`);
          continue;
        }
        errors.push(
          `${label}: ${problem.macro} is ${Math.round(problem.percent)}% of calories; this plan needs ${low}-${high}%. Changing portions can't fix this day, so change a dish: ${MACRO_HINTS[problem.macro][tooLow ? 'low' : 'high']}.`,
        );
      }
    }
  }

  const menus = days.map((d) => d.meals.map((m) => m.name.toLowerCase()).sort().join('|'));
  if (menus.length > 1 && new Set(menus).size < Math.ceil(menus.length / 2)) warnings.push('Many days repeat the same menu; add more variety.');

  return { errors, warnings };
};
