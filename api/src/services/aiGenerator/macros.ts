/**
 * Protein, carb and fat targets per goal and diet type, and the code that moves portions toward
 * them. Like calories, these are arithmetic: when the model had to hit "protein at least 25%" on
 * its own it failed 5 saves in a row (Nov 2026). Now our code shifts grams between the day's
 * protein-rich and other ingredients (keeping the calories), and the model only hears about a
 * day the portions alone can't fix, i.e. one whose dishes need to change.
 */
import type { Per100g } from './usda.js';

/** Share of the day's calories, in percent. */
export type Range = [low: number, high: number];
export type MacroTargets = { protein: Range; carbs: Range; fat: Range; maxCarbsGrams?: number };
export type Macro = 'protein' | 'carbs' | 'fat';

export const KCAL_PER_GRAM: Record<Macro, number> = { protein: 4, carbs: 4, fat: 9 };

/** Based on the usual adult ranges (protein 10-35%, carbs 45-65%, fat 20-35%), tilted per goal. */
const BY_GOAL: Record<string, MacroTargets> = {
  weight_loss: { protein: [25, 35], carbs: [35, 50], fat: [20, 35] },
  build_muscle: { protein: [25, 35], carbs: [40, 55], fat: [20, 30] },
  weight_gain: { protein: [15, 30], carbs: [45, 60], fat: [20, 35] },
};
const DEFAULT_TARGETS: MacroTargets = { protein: [15, 30], carbs: [45, 60], fat: [20, 35] };

/** What a diet type changes; anything it doesn't set comes from the goal. */
const BY_DIET_TYPE: Record<string, Partial<MacroTargets>> = {
  'High-Protein': { protein: [30, 40], carbs: [30, 45], fat: [20, 35] },
  Keto: { protein: [15, 30], carbs: [0, 10], fat: [60, 80], maxCarbsGrams: 50 },
  'Diabetes type 1': { protein: [20, 30], carbs: [35, 45], fat: [25, 35] },
  'Diabetes type 2': { protein: [20, 30], carbs: [35, 45], fat: [25, 35] },
  'Calorie-Cutting': { protein: [25, 35], carbs: [35, 50], fat: [20, 35] },
  'High Calories': { carbs: [45, 60], fat: [25, 35] },
  Paleo: { carbs: [20, 40], fat: [30, 45] },
  Mediterranean: { carbs: [40, 50], fat: [30, 40] },
  // Plant protein is bulky; 25%+ is hard to reach with normal home dishes.
  'Vegan (Plant diet)': { protein: [15, 30] },
};

export const macroTargets = (goal: string, dietType: string): MacroTargets => {
  const targets = { ...(BY_GOAL[goal] ?? DEFAULT_TARGETS), ...(BY_DIET_TYPE[dietType] ?? {}) };
  // Keep the three ranges able to add up to 100%: if the lows are too high, lower carbs first.
  const lows = targets.protein[0] + targets.carbs[0] + targets.fat[0];
  if (lows > 100) targets.carbs = [Math.max(0, targets.carbs[0] - (lows - 100)), targets.carbs[1]];
  return targets;
};

export const targetsText = (targets: MacroTargets) =>
  `protein ${targets.protein[0]}-${targets.protein[1]}%, carbs ${targets.carbs[0]}-${targets.carbs[1]}%${targets.maxCarbsGrams ? ` (and at most ${targets.maxCarbsGrams} g)` : ''}, fat ${targets.fat[0]}-${targets.fat[1]}% of calories`;

export type DayTotals = { kcal: number; protein: number; carbs: number; fat: number };
export const share = (totals: DayTotals, macro: Macro) => (totals[macro] * KCAL_PER_GRAM[macro] * 100) / Math.max(totals.kcal, 1);

/** The highest carb share allowed, counting the keto gram cap at the day's calories. */
const carbCap = (targets: MacroTargets, kcal: number) => Math.min(targets.carbs[1], targets.maxCarbsGrams ? (targets.maxCarbsGrams * 4 * 100) / Math.max(kcal, 1) : 100);

/** Each macro that is out of its range, with how far off it is. */
export const macroProblems = (totals: DayTotals, targets: MacroTargets) => {
  const problems: { macro: Macro; percent: number; range: Range }[] = [];
  for (const macro of ['protein', 'carbs', 'fat'] as Macro[]) {
    const percent = share(totals, macro);
    const [low, high] = targets[macro];
    const top = macro === 'carbs' ? carbCap(targets, totals.kcal) : high;
    if (percent < low - 0.5 || percent > top + 0.5) problems.push({ macro, percent, range: [low, high] });
  }
  return problems;
};

const FAT_WORDS = /\b(oil|ghee|butter|makhan|margarine|mayonnaise|mayo|lard)\b/i;
const SWEET_WORDS = /\b(sugar|cheeni|gur|jaggery|honey|shehad|jam|syrup)\b/i;
const DRINK_WORDS = /\b(milk|doodh|lassi|chaas|buttermilk|water|tea|chai|coffee|juice|soup|shorba|yakhni|broth|shake|smoothie|kahwa|sharbat)\b/i;

/**
 * The most of one ingredient one meal may hold. The reviewer is told odd grams are fine, and the
 * balancer may double a portion, so without this 400 g of roti in one meal would pass unnoticed.
 */
export const maxPortionGrams = (name: string) => (FAT_WORDS.test(name) ? 40 : SWEET_WORDS.test(name) ? 40 : DRINK_WORDS.test(name) ? 600 : 450);

/** How much one portion may grow or shrink in one save, so meals stay normal home portions. */
const MAX_FACTOR = 2;
const MIN_FACTOR = 0.5;
/** Aim this far inside a range, so rounding grams doesn't push a day back out. */
const MARGIN = 1.5;

type Item = { grams: number; food: Per100g | null; max?: number };

const totalsOf = (items: Item[]): DayTotals =>
  items.reduce(
    (sum, item) => {
      if (!item.food) return sum;
      const f = item.grams / 100;
      return { kcal: sum.kcal + item.food.kcal * f, protein: sum.protein + item.food.protein * f, carbs: sum.carbs + item.food.carbs * f, fat: sum.fat + item.food.fat * f };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

/**
 * New grams for one day's ingredients that bring each macro into range while keeping the day at
 * `target` kcal. For an out-of-range macro, the ingredients richer in it than the goal (group A)
 * are scaled by one factor and the rest (group B) by another, solved from two equations: total
 * kcal = target, and the macro's kcal = goal share x target. Factors are kept within 0.5-2x; what
 * that can't reach is left for the model.
 */
export const balanceDay = (items: Item[], targets: MacroTargets, target: number): number[] => {
  const grams = items.map((item) => item.grams);
  const current = () => items.map((item, i) => ({ ...item, grams: grams[i] }));
  for (let pass = 0; pass < 3; pass++) {
    const problems = macroProblems(totalsOf(current()), targets);
    if (!problems.length) break;
    const { macro, percent, range } = problems[0];
    const high = macro === 'carbs' ? carbCap(targets, target) : range[1];
    const goal = (percent < range[0] ? range[0] + MARGIN : Math.max(range[0], high - MARGIN)) / 100;
    const k = KCAL_PER_GRAM[macro];
    const richer = items.map((item) => !!item.food && item.food.kcal > 0 && (item.food[macro] * k) / item.food.kcal > goal);
    let kA = 0, mA = 0, kB = 0, mB = 0;
    items.forEach((item, i) => {
      if (!item.food) return;
      const f = grams[i] / 100;
      if (richer[i]) {
        kA += item.food.kcal * f;
        mA += item.food[macro] * k * f;
      } else {
        kB += item.food.kcal * f;
        mB += item.food[macro] * k * f;
      }
    });
    const det = kA * mB - kB * mA;
    if (!kA || !kB || Math.abs(det) < 1e-9) break;
    let a = (target * mB - kB * goal * target) / det;
    const clamp = (v: number) => Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, v));
    let b: number;
    if (a !== clamp(a) || a <= 0) {
      a = clamp(a <= 0 ? MIN_FACTOR : a);
      b = clamp((target - a * kA) / kB);
    } else {
      b = (kA * goal * target - mA * target) / det;
      if (b !== clamp(b)) {
        b = clamp(b);
        a = clamp((target - b * kB) / kA);
      }
    }
    if (Math.abs(a - 1) < 0.01 && Math.abs(b - 1) < 0.01) break;
    // The 0.5-2x limit is against the model's own portion, across all passes.
    items.forEach((item, i) => {
      if (item.food) grams[i] = Math.min(item.grams * MAX_FACTOR, item.max ?? Infinity, Math.max(Math.min(item.grams * MIN_FACTOR, item.max ?? Infinity), grams[i] * (richer[i] ? a : b)));
    });
  }
  return grams.map((g) => (g < 20 ? Math.max(1, Math.round(g)) : Math.round(g / 5) * 5));
};

type BalancablePlan = { days: { dayNumber: number; meals: { ingredients: { name: string; grams: number }[] }[] }[] };

/** Runs balanceDay on every day of a plan; returns the new plan and the days it changed. */
export const balancePlanMacros = <T extends BalancablePlan>(plan: T, foodOf: (name: string) => Per100g | null, targets: MacroTargets, target: number) => {
  const adjusted: number[] = [];
  const days = plan.days.map((day) => {
    const items = day.meals.flatMap((meal) => meal.ingredients.map((ingredient) => ({ grams: ingredient.grams, food: foodOf(ingredient.name), max: Math.max(ingredient.grams, maxPortionGrams(ingredient.name)) })));
    if (!macroProblems(totalsOf(items), targets).length) return day;
    const grams = balanceDay(items, targets, target);
    let i = 0;
    const meals = day.meals.map((meal) => ({ ...meal, ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient, grams: grams[i++] })) }));
    if (meals.some((meal, m) => meal.ingredients.some((ingredient, n) => ingredient.grams !== day.meals[m].ingredients[n].grams))) adjusted.push(day.dayNumber);
    return { ...day, meals };
  });
  return { plan: { ...plan, days } as T, adjusted };
};
