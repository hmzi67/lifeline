import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { CONTENT_STATUS } from '../../utils/contentStatus.js';
import type { ToolDefinition } from './openai.js';
import { lookupFood, nutritionFor } from './usda.js';
import { balancePlanMacros, macroTargets } from './macros.js';
import { checkCuisine, cuisineName } from './dietRules.js';
import { checkDietPlan, defaultCalories, DietDayComputed, DietSpec, scalePortionsToTarget } from './validate.js';
import { existingPlanNames } from './exerciseTools.js';
import type { NutritionSource } from './constants.js';
import type { AgentState, ToolResult } from './agentTypes.js';

const ingredient = z.object({ name: z.string().trim().min(2).max(120), grams: z.number().positive().max(2000) });

const saveDietArgs = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  days: z
    .array(
      z.object({
        dayNumber: z.number().int().min(1).max(31),
        meals: z.array(
          z.object({
            mealType: z.string().trim(),
            name: z.string().trim().min(2).max(100),
            recipe: z.string().trim().min(10).max(4000),
            ingredients: z.array(ingredient).min(1).max(20),
          }),
        ),
      }),
    )
    .min(1),
});
export type DietPlanDraft = z.infer<typeof saveDietArgs>;

const ingredientSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Plain USDA-style name, e.g. "chicken breast, cooked", "brown rice, cooked", "olive oil"' },
    grams: { type: 'number' },
  },
  required: ['name', 'grams'],
  additionalProperties: false,
};

export const dietToolDefinitions = (mealTypes: string[]): ToolDefinition[] => [
  {
    type: 'function',
    function: {
      name: 'lookup_nutrition',
      description: 'Calories and macros (from USDA) for ingredients at the given weights. Use it to size portions before saving.',
      parameters: {
        type: 'object',
        properties: { ingredients: { type: 'array', items: ingredientSchema } },
        required: ['ingredients'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_diet_plan',
      description:
        "Save the whole plan as a draft (replaces any earlier save). Each meal's calories and macros are calculated from its ingredients with USDA data. Returns errors to fix if it breaks a rule; nothing is saved then.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', description: 'Who it is for and what it achieves, 2-4 sentences' },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dayNumber: { type: 'integer' },
                meals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      mealType: { type: 'string', enum: mealTypes },
                      name: { type: 'string' },
                      recipe: { type: 'string', description: 'Short numbered preparation steps' },
                      ingredients: { type: 'array', items: ingredientSchema },
                    },
                    required: ['mealType', 'name', 'recipe', 'ingredients'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['dayNumber', 'meals'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'description', 'days'],
        additionalProperties: false,
      },
    },
  },
];

export const loadMealTypes = async (state: AgentState) => {
  if (!state.mealTypes) state.mealTypes = await prisma.mealType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return state.mealTypes;
};

type ComputedMeal = DietDayComputed['meals'][number] & { recipe: string; grams: number; ingredientList: { name: string; grams: number }[]; sources: NutritionSource[] };
type ComputedDay = { dayNumber: number; meals: ComputedMeal[] };

/** Runs every meal's ingredients through USDA. */
const computeDays = async (plan: DietPlanDraft, signal: AbortSignal) => {
  const days: ComputedDay[] = [];
  for (const day of plan.days) {
    const meals: ComputedMeal[] = [];
    for (const meal of day.meals) {
      const nutrition = await nutritionFor(meal.ingredients, signal);
      meals.push({
        mealType: meal.mealType,
        name: meal.name,
        recipe: meal.recipe,
        ingredients: meal.ingredients.map((i) => i.name),
        ingredientList: meal.ingredients,
        sources: nutrition.found.map((f) => ({ ingredient: f.name, usdaMatch: f.description, kcalPer100g: f.grams ? Math.round((f.kcal / f.grams) * 100) : 0 })),
        missing: nutrition.missing,
        grams: Math.round(meal.ingredients.reduce((sum, i) => sum + i.grams, 0)),
        kcal: nutrition.totals.kcal,
        protein: nutrition.totals.protein,
        carbs: nutrition.totals.carbs,
        fat: nutrition.totals.fat,
      });
    }
    days.push({ dayNumber: day.dayNumber, meals });
  }
  return days;
};

export const runDietTool = async (state: AgentState, name: string, args: unknown): Promise<ToolResult> => {
  if (name === 'lookup_nutrition') {
    const parsed = z.object({ ingredients: z.array(ingredient).min(1).max(30) }).safeParse(args);
    if (!parsed.success) return { result: { error: parsed.error.issues.map((i) => i.message) }, summary: 'invalid arguments' };
    const nutrition = await nutritionFor(parsed.data.ingredients, state.ctx.signal);
    return {
      result: {
        ingredients: nutrition.found.map((f) => ({ name: f.name, grams: f.grams, usdaMatch: f.description, kcal: Math.round(f.kcal), protein: Math.round(f.protein), carbs: Math.round(f.carbs), fat: Math.round(f.fat) })),
        notFound: nutrition.missing,
        totals: nutrition.totals,
      },
      summary: `${nutrition.found.length} found, ${nutrition.missing.length} missing`,
    };
  }

  if (name === 'save_diet_plan') {
    const parsed = saveDietArgs.safeParse(args);
    if (!parsed.success) return { result: { saved: false, errors: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`) }, summary: 'invalid arguments' };
    const mealTypes = await loadMealTypes(state);
    const spec = state.spec as unknown as DietSpec;
    const target = Number(spec.caloriesPerDay ?? defaultCalories(spec.goal));
    const firstPass = await computeDays(parsed.data, state.ctx.signal);
    const dayKcal = new Map(firstPass.map((d) => [d.dayNumber, d.meals.reduce((s, m) => s + m.kcal, 0)]));
    // Our code sets the portions to hit the calorie target (lookups are cached, so recomputing is cheap).
    const scaled = scalePortionsToTarget(parsed.data, dayKcal, target);
    // Then it shifts grams between protein-rich and other ingredients to hit the macro targets.
    const foods = new Map<string, Awaited<ReturnType<typeof lookupFood>>>();
    for (const day of scaled.plan.days) for (const meal of day.meals) for (const item of meal.ingredients) if (!foods.has(item.name)) foods.set(item.name, await lookupFood(item.name, state.ctx.signal));
    const balanced = balancePlanMacros(scaled.plan, (n) => foods.get(n) ?? null, macroTargets(spec.goal, spec.dietType), target);
    const plan = balanced.plan;
    const changedDays = [...new Set([...scaled.adjusted.map((a) => a.dayNumber), ...balanced.adjusted])].sort((a, b) => a - b);
    const days = changedDays.length ? await computeDays(plan, state.ctx.signal) : firstPass;
    const portionsAdjusted = changedDays.length
      ? `Our code adjusted the portions on day ${changedDays.join(', ')} to hit ${target} kcal and the protein/carb/fat targets; it does this on every save, so focus on the other points.`
      : undefined;
    const check = checkDietPlan(state.spec as unknown as DietSpec, days, mealTypes.map((t) => t.name));
    const cuisine = (state.spec as { cuisine?: string }).cuisine;
    check.errors.push(
      ...checkCuisine(
        cuisine,
        days.flatMap((d) => d.meals.map((m) => ({ where: `Day ${d.dayNumber} "${m.name}"`, name: m.name, ingredients: m.ingredients }))),
      ),
    );
    const taken = (await existingPlanNames(state, 'diet')).get(plan.name.trim().toLowerCase());
    if (taken) check.errors.push(`A plan called "${taken}" already exists. Give this plan a clearly different name.`);
    state.lastCheck = check;
    const dayTotals = days.map((d) => ({
      dayNumber: d.dayNumber,
      kcal: Math.round(d.meals.reduce((s, m) => s + m.kcal, 0)),
      protein: Math.round(d.meals.reduce((s, m) => s + m.protein, 0)),
      carbs: Math.round(d.meals.reduce((s, m) => s + m.carbs, 0)),
      fat: Math.round(d.meals.reduce((s, m) => s + m.fat, 0)),
    }));
    if (check.errors.length) return { result: { saved: false, errors: check.errors.slice(0, 25), warnings: check.warnings, dayTotals, portionsAdjusted }, summary: `rejected: ${check.errors.length} errors` };

    state.planId = await writeDietPlanDraft(state, plan, days, mealTypes);
    state.lastPlan = { kind: 'diet', plan };
    state.dietTotals = dayTotals;
    // One line per ingredient name, for the reviewer and the admin's preview.
    const sources = new Map<string, NutritionSource>();
    for (const day of days) for (const meal of day.meals) for (const source of meal.sources) sources.set(source.ingredient.trim().toLowerCase(), source);
    state.nutritionSources = [...sources.values()].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
    return { result: { saved: true, planId: state.planId, warnings: check.warnings, dayTotals, portionsAdjusted }, summary: `saved (${check.warnings.length} warnings)` };
  }

  return { result: { error: `Unknown tool ${name}` }, summary: 'unknown tool' };
};

const recipeText = (meal: ComputedMeal) =>
  `Ingredients:\n${meal.ingredientList.map((i) => `- ${i.name}: ${Math.round(i.grams)} g`).join('\n')}\n\n${meal.recipe}`;

/** Creates the draft plan, or replaces the days of the one this job already saved. */
const writeDietPlanDraft = async (
  state: AgentState,
  plan: DietPlanDraft,
  days: Awaited<ReturnType<typeof computeDays>>,
  mealTypes: { id: string; name: string }[],
) => {
  const spec = state.spec as unknown as DietSpec & { cuisine?: string };
  const typeId = new Map(mealTypes.map((t) => [t.name, t.id]));
  const target = spec.caloriesPerDay ?? defaultCalories(spec.goal);
  return prisma.$transaction(
    async (tx) => {
      const fields = {
        name: plan.name,
        description: plan.description,
        goal: spec.goal,
        calories: target,
        duration: `${plan.days.length} days`,
        cuisineName: cuisineName(spec.cuisine),
      };
      let planId = state.planId;
      if (planId) {
        await tx.dietPlanMeal.deleteMany({ where: { day: { dietId: planId } } });
        await tx.dietPlanDay.deleteMany({ where: { dietId: planId } });
        await tx.dietPlan.update({ where: { id: planId }, data: fields });
      } else {
        planId = (await tx.dietPlan.create({ data: { ...fields, status: CONTENT_STATUS.draft, aiBatchId: state.batchId }, select: { id: true } })).id;
      }
      for (const day of [...days].sort((a, b) => a.dayNumber - b.dayNumber)) {
        const dayRow = await tx.dietPlanDay.create({ data: { dietId: planId, dayNumber: day.dayNumber }, select: { id: true } });
        await tx.dietPlanMeal.createMany({
          data: day.meals.map((meal) => ({
            dayId: dayRow.id,
            mealTypeId: typeId.get(meal.mealType)!,
            name: meal.name,
            calories: Math.round(meal.kcal),
            portionSize: `${meal.grams} g`,
            protein: meal.protein,
            carbs: meal.carbs,
            fats: meal.fat,
            recipe: recipeText(meal),
          })),
        });
      }
      return planId;
    },
    { timeout: 30_000 },
  );
};

/** Readable plan text (with computed numbers) for the critic. */
export const describeDietPlan = (state: AgentState, plan: DietPlanDraft) =>
  [
    `${plan.name}: ${plan.description}`,
    ...plan.days.map((day) => {
      const totals = state.dietTotals?.find((t) => t.dayNumber === day.dayNumber);
      return `Day ${day.dayNumber}${totals ? ` (${totals.kcal} kcal, P${totals.protein} C${totals.carbs} F${totals.fat} g)` : ''}: ${day.meals
        .map((m) => `${m.mealType}: ${m.name} [${m.ingredients.map((i) => `${i.name} ${i.grams}g`).join(', ')}]`)
        .join(' | ')}`;
    }),
  ].join('\n');
