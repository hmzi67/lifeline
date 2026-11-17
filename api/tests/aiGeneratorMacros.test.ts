export {};

import { balanceDay, balancePlanMacros, macroProblems, macroTargets, maxPortionGrams, share } from '../src/services/aiGenerator/macros';

const food = (kcal: number, protein: number, carbs: number, fat: number) => ({ description: 'x', kcal, protein, carbs, fat });
const FOODS: Record<string, ReturnType<typeof food>> = {
  roti: food(297, 9.6, 49.6, 7.4),
  'rice, cooked': food(130, 2.7, 28.2, 0.3),
  'chicken breast, cooked': food(165, 31, 0, 3.6),
  'masoor dal, cooked': food(116, 9, 20.1, 0.4),
  'yogurt, plain': food(61, 3.5, 4.7, 3.3),
  oil: food(884, 0, 0, 100),
  'egg, whole, raw': food(143, 12.6, 0.7, 9.5),
  potato: food(87, 1.9, 20.1, 0.1),
};
const totals = (items: { grams: number; food: ReturnType<typeof food> }[]) =>
  items.reduce(
    (s, i) => ({ kcal: s.kcal + (i.food.kcal * i.grams) / 100, protein: s.protein + (i.food.protein * i.grams) / 100, carbs: s.carbs + (i.food.carbs * i.grams) / 100, fat: s.fat + (i.food.fat * i.grams) / 100 }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

// A day like the one that failed 5 saves: plenty of roti and rice, protein about 15%.
const lowProteinDay = () => [
  { grams: 240, food: FOODS.roti },
  { grams: 400, food: FOODS['rice, cooked'] },
  { grams: 150, food: FOODS['chicken breast, cooked'] },
  { grams: 250, food: FOODS['masoor dal, cooked'] },
  { grams: 200, food: FOODS['yogurt, plain'] },
  { grams: 30, food: FOODS.oil },
  { grams: 100, food: FOODS['egg, whole, raw'] },
];

describe('macro targets', () => {
  it('follows the goal, and the diet type where it says more', () => {
    expect(macroTargets('build_muscle', 'Traditional').protein).toEqual([25, 35]);
    expect(macroTargets('build_muscle', 'High-Protein').protein).toEqual([30, 40]);
    expect(macroTargets('weight_gain', 'Keto')).toEqual(expect.objectContaining({ carbs: [0, 10], maxCarbsGrams: 50 }));
    expect(macroTargets('weight_loss', 'Diabetes type 2').carbs).toEqual([35, 45]);
    expect(macroTargets('unknown', 'Traditional')).toEqual({ protein: [15, 30], carbs: [45, 60], fat: [20, 35] });
  });

  it('always leaves room to add up to 100%', () => {
    for (const goal of ['weight_loss', 'build_muscle', 'weight_gain', 'x']) {
      for (const type of ['Traditional', 'High-Protein', 'Keto', 'Diabetes type 1', 'High Calories', 'Paleo', 'Mediterranean', 'Vegan (Plant diet)', 'Calorie-Cutting']) {
        const t = macroTargets(goal, type);
        expect(t.protein[0] + t.carbs[0] + t.fat[0]).toBeLessThanOrEqual(100);
        expect(t.protein[1] + t.carbs[1] + t.fat[1]).toBeGreaterThanOrEqual(100);
      }
    }
  });
});

describe('moving portions toward the targets', () => {
  it('raises protein on a roti-and-rice day and keeps the calories', () => {
    const items = lowProteinDay();
    const before = totals(items);
    const targets = macroTargets('build_muscle', 'Traditional');
    expect(share(before, 'protein')).toBeLessThan(25);

    const grams = balanceDay(items, targets, 2400);
    const after = totals(items.map((item, i) => ({ ...item, grams: grams[i] })));
    expect(macroProblems(after, targets)).toEqual([]);
    expect(Math.abs(after.kcal - 2400)).toBeLessThan(2400 * 0.03);
    // Portions change by at most 2x either way.
    grams.forEach((g, i) => {
      expect(g).toBeLessThanOrEqual(items[i].grams * 2 + 5);
      expect(g).toBeGreaterThanOrEqual(items[i].grams * 0.5 - 5);
    });
  });

  it('moves a day it cannot fully fix closer, so the model has less to change', () => {
    const items = lowProteinDay();
    const targets = macroTargets('build_muscle', 'High-Protein');
    const grams = balanceDay(items, targets, 2400);
    const after = totals(items.map((item, i) => ({ ...item, grams: grams[i] })));
    expect(share(after, 'protein')).toBeGreaterThan(share(totals(items), 'protein') + 4);
  });

  it('brings carbs down for a diabetes plan', () => {
    const items = lowProteinDay();
    const targets = macroTargets('weight_loss', 'Diabetes type 2');
    const grams = balanceDay(items, targets, 1800);
    const after = totals(items.map((item, i) => ({ ...item, grams: grams[i] })));
    expect(share(after, 'carbs')).toBeLessThanOrEqual(45.5);
  });

  it('leaves a day it cannot fix for the model, without silly portions', () => {
    // Only rice and potato: no protein-rich food to grow.
    const items = [
      { grams: 500, food: FOODS['rice, cooked'] },
      { grams: 400, food: FOODS.potato },
    ];
    const targets = macroTargets('build_muscle', 'High-Protein');
    const grams = balanceDay(items, targets, 1000);
    expect(macroProblems(totals(items.map((item, i) => ({ ...item, grams: grams[i] }))), targets).length).toBeGreaterThan(0);
    grams.forEach((g, i) => expect(g).toBeLessThanOrEqual(items[i].grams * 2 + 5));
  });

  it('never grows a portion past what one meal may hold', () => {
    const items = lowProteinDay().map((item) => ({ ...item, max: item.food === FOODS['chicken breast, cooked'] ? 200 : undefined }));
    const grams = balanceDay(items, macroTargets('build_muscle', 'High-Protein'), 2400);
    expect(grams[2]).toBeLessThanOrEqual(200);
  });

  it('knows the portion limits', () => {
    expect(maxPortionGrams('ghee')).toBe(40);
    expect(maxPortionGrams('sugar')).toBe(40);
    expect(maxPortionGrams('lassi')).toBe(600);
    expect(maxPortionGrams('buttermilk')).toBe(600);
    expect(maxPortionGrams('egg, boiled')).toBe(450);
    expect(maxPortionGrams('roti')).toBe(450);
  });

  it('changes only the days that are out of range', () => {
    const plan = {
      days: [
        { dayNumber: 1, meals: [{ ingredients: lowProteinDay().map((item) => ({ name: Object.keys(FOODS).find((k) => FOODS[k] === item.food)!, grams: item.grams })) }] },
        { dayNumber: 2, meals: [{ ingredients: [{ name: 'chicken breast, cooked', grams: 300 }, { name: 'rice, cooked', grams: 600 }, { name: 'oil', grams: 25 }] }] },
      ],
    };
    const result = balancePlanMacros(plan, (name) => FOODS[name] ?? null, macroTargets('build_muscle', 'Traditional'), 2400);
    expect(result.adjusted).toEqual([1]);
    expect(result.plan.days[1]).toBe(plan.days[1]);
  });
});
