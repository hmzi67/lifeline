export {};

jest.mock('../src/config/database', () => ({ prisma: {} }));

import { normalizeExerciseName } from '../src/services/aiGenerator/exerciseTools';
import { per100gFromFood } from '../src/services/aiGenerator/usda';
import { checkDietPlan, checkExercisePlan, durationMinutes } from '../src/services/aiGenerator/validate';

describe('durations', () => {
  it('reads seconds and minutes', () => {
    expect(durationMinutes('45 sec')).toBe(0.75);
    expect(durationMinutes('2 min')).toBe(2);
    expect(durationMinutes('1.5 minutes')).toBe(1.5);
    expect(durationMinutes('12 reps')).toBeNull();
  });
});

describe('exercise names', () => {
  it('treats spelling variants as the same exercise', () => {
    expect(normalizeExerciseName('Push-Ups')).toBe(normalizeExerciseName('push up'));
    expect(normalizeExerciseName('Lunges')).toBe(normalizeExerciseName('lunge'));
    expect(normalizeExerciseName('Shoulder Presses')).toBe(normalizeExerciseName('shoulder press'));
    expect(normalizeExerciseName('Squat')).not.toBe(normalizeExerciseName('Split Squat'));
  });
});

describe('USDA results', () => {
  it('reads per-100 g values, falling back to Atwater energy', () => {
    const food = {
      description: 'Chicken breast',
      foodNutrients: [
        { nutrientId: 1003, value: 31 },
        { nutrientId: 1004, value: 3.6 },
        { nutrientId: 1005, value: 0 },
        { nutrientId: 2047, value: 165 },
      ],
    };
    expect(per100gFromFood(food)).toEqual({ description: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6 });
    expect(per100gFromFood({ foodNutrients: [{ nutrientId: 1003, value: 1 }] })).toBeNull();
  });
});

const exercises = new Map([
  ['e1', { id: 'e1', name: 'Squat', difficulty: 'beginner' }],
  ['e2', { id: 'e2', name: 'Push Up', difficulty: 'beginner' }],
  ['e3', { id: 'e3', name: 'Plank', difficulty: 'beginner' }],
  ['e4', { id: 'e4', name: 'Pistol Squat', difficulty: 'advanced' }],
]);
const spec = { level: 'beginner', focusArea: 'Full Body', weeks: 1, daysPerWeek: 1, minutesPerSession: 10 };
const day = (rows: { exerciseId: string; sets: number; duration: string }[]) => ({
  name: 'Starter',
  description: 'A simple plan',
  weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Monday', exercises: rows }] }],
});

describe('exercise plan checks', () => {
  it('passes a plan that matches the request', () => {
    const plan = day([
      { exerciseId: 'e1', sets: 3, duration: '1 min' },
      { exerciseId: 'e2', sets: 3, duration: '1 min' },
      { exerciseId: 'e3', sets: 3, duration: '1 min' },
    ]);
    expect(checkExercisePlan(spec, plan, exercises)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects unknown exercises, repeats, bad durations and the wrong session length', () => {
    const plan = day([
      { exerciseId: 'e1', sets: 3, duration: '1 min' },
      { exerciseId: 'e1', sets: 3, duration: '1 min' },
      { exerciseId: 'nope', sets: 3, duration: '1 min' },
      { exerciseId: 'e2', sets: 3, duration: '12 reps' },
    ]);
    const { errors } = checkExercisePlan(spec, plan, exercises);
    expect(errors.join('\n')).toMatch(/used twice/);
    expect(errors.join('\n')).toMatch(/doesn't exist/);
    expect(errors.join('\n')).toMatch(/must look like/);
  });

  it('counts 30 sec rest per set in session time and says how to fix it', () => {
    // 3 x 3 sets of 30 sec work = 4.5 min work + 4.5 min rest = 9 min: inside 5-14 for a 10 min target.
    const ok = day([
      { exerciseId: 'e1', sets: 3, duration: '30 sec' },
      { exerciseId: 'e2', sets: 3, duration: '30 sec' },
      { exerciseId: 'e3', sets: 3, duration: '30 sec' },
    ]);
    expect(checkExercisePlan(spec, ok, exercises).errors).toEqual([]);
    const short = day([
      { exerciseId: 'e1', sets: 1, duration: '30 sec' },
      { exerciseId: 'e2', sets: 1, duration: '30 sec' },
      { exerciseId: 'e3', sets: 1, duration: '30 sec' },
    ]);
    // A short day is a warning (still saved), with a plain hint.
    const shortCheck = checkExercisePlan(spec, short, exercises);
    expect(shortCheck.errors).toEqual([]);
    expect(shortCheck.warnings.join()).toMatch(/is a bit short: about 3 min, aim for 5-14 min \(add about 2 sets/);
  });

  it('does not flag a day whose time rounds to the minimum it shows', () => {
    // 30 min target -> 15-42. 5 x 2 sets of 55 sec = 10 sets x (55 + 30 sec) = 14.2 min, shown as 14: rejected.
    // 5 x 2 sets of 58 sec = 14.67 min, shown as 15: allowed.
    const thirty = { ...spec, minutesPerSession: 30 };
    const rows = (duration: string) => ['e1', 'e2', 'e3', 'e4', 'e5'].map((exerciseId) => ({ exerciseId, sets: 2, duration }));
    const five = new Map([...exercises, ['e5', { id: 'e5', name: 'Lunge', difficulty: 'beginner' }]]);
    expect(checkExercisePlan(thirty, day(rows('55 sec')), five).warnings.join()).toMatch(/about 14 min/);
    const rounded = checkExercisePlan(thirty, day(rows('58 sec')), five);
    expect(rounded.errors).toEqual([]);
    expect(rounded.warnings.join()).not.toMatch(/short/);
  });

  it('warns about an advanced exercise in a beginner plan', () => {
    const plan = day([
      { exerciseId: 'e1', sets: 3, duration: '1 min' },
      { exerciseId: 'e4', sets: 3, duration: '1 min' },
      { exerciseId: 'e3', sets: 3, duration: '1 min' },
    ]);
    expect(checkExercisePlan(spec, plan, exercises).warnings.join()).toMatch(/advanced in a beginner plan/);
  });
});

const meal = (
  name: string,
  kcal: number,
  extra: Partial<{ protein: number; carbs: number; ingredients: string[]; ingredientList: { name: string; grams: number }[]; missing: string[]; mealType: string }> = {},
) => ({
  mealType: 'Breakfast',
  name,
  kcal,
  protein: kcal * 0.3 / 4,
  carbs: kcal * 0.4 / 4,
  fat: kcal * 0.3 / 9,
  ingredients: ['rolled oats', 'banana'],
  missing: [],
  ...extra,
});

describe('diet plan checks', () => {
  const dietSpec = { goal: 'weight_loss', dietType: 'Traditional', caloriesPerDay: 1800, days: 1, mealsPerDay: 2 };

  it('passes a day on target', () => {
    const days = [{ dayNumber: 1, meals: [meal('Oats', 900), meal('Rice bowl', 900, { mealType: 'Lunch' })] }];
    expect(checkDietPlan(dietSpec, days, ['Breakfast', 'Lunch']).errors).toEqual([]);
  });

  it('rejects a day off target and ingredients USDA does not know', () => {
    const days = [{ dayNumber: 1, meals: [meal('Oats', 500, { missing: ['moon cheese'] }), meal('Rice bowl', 500, { mealType: 'Lunch' })] }];
    const errors = checkDietPlan(dietSpec, days, ['Breakfast', 'Lunch']).errors.join('\n');
    expect(errors).toMatch(/within 10% of 1800/);
    expect(errors).toMatch(/moon cheese/);
  });

  it('enforces the diet type', () => {
    const days = [{ dayNumber: 1, meals: [meal('Omelette', 900, { ingredients: ['egg', 'spinach'] }), meal('Chicken bowl', 900, { mealType: 'Lunch', ingredients: ['chicken breast', 'rice'] })] }];
    const vegan = checkDietPlan({ ...dietSpec, dietType: 'Vegan (Plant diet)' }, days, ['Breakfast', 'Lunch']).errors.join('\n');
    expect(vegan).toMatch(/vegan plan can't use/);
    const keto = checkDietPlan({ ...dietSpec, dietType: 'Keto' }, days, ['Breakfast', 'Lunch']).errors.join('\n');
    expect(keto).toMatch(/keto needs 50 g or less/);
  });

  it('rejects a portion too big for one meal', () => {
    const days = [
      {
        dayNumber: 1,
        meals: [
          meal('Roti with dal', 900, { ingredientList: [{ name: 'roti', grams: 500 }, { name: 'masoor dal, cooked', grams: 250 }, { name: 'ghee', grams: 60 }] }),
          meal('Chicken pulao', 900, { mealType: 'Lunch', ingredientList: [{ name: 'rice, cooked', grams: 400 }, { name: 'milk', grams: 550 }] }),
        ],
      },
    ];
    const errors = checkDietPlan(dietSpec, days, ['Breakfast', 'Lunch']).errors.join('\n');
    expect(errors).toMatch(/500 g of "roti" is too much for one meal \(at most 450 g\)/);
    expect(errors).toMatch(/60 g of "ghee" is too much .*at most 40 g/);
    expect(errors).not.toMatch(/rice|milk/);
  });
});

describe('session length limits', () => {
  it('rejects a day that is too long, in plain words', () => {
    const long = day([
      { exerciseId: 'e1', sets: 6, duration: '2 min' },
      { exerciseId: 'e2', sets: 6, duration: '2 min' },
      { exerciseId: 'e3', sets: 6, duration: '2 min' },
    ]);
    expect(checkExercisePlan(spec, long, exercises).errors.join()).toMatch(/is too long: about 45 min, it must be 5-14 min \(remove about/);
  });
});

describe('USDA query names', () => {
  it('keeps letters, digits, % and commas, and drops punctuation USDA rejects', () => {
    const { normalize } = jest.requireActual('../src/services/aiGenerator/usda');
    expect(normalize('Rolled Oats/Oatmeal')).toBe('rolled oats oatmeal');
    expect(normalize('rice, white,cooked, long-grain')).toBe('rice, white, cooked, long grain');
    expect(normalize('Greek yogurt (plain), 2% fat;')).toBe('greek yogurt plain, 2% fat');
    expect(normalize(' ,() ')).toBe('');
  });
});

describe('portion scaling to the calorie target', () => {
  const { scalePortionsToTarget } = jest.requireActual('../src/services/aiGenerator/validate');
  const plan = {
    name: 'P',
    days: [
      { dayNumber: 1, meals: [{ name: 'Oats', ingredients: [{ name: 'rolled oats', grams: 100 }, { name: 'olive oil', grams: 10 }] }] },
      { dayNumber: 2, meals: [{ name: 'Rice', ingredients: [{ name: 'rice', grams: 200 }] }] },
      { dayNumber: 3, meals: [{ name: 'Soup', ingredients: [{ name: 'broth', grams: 300 }] }] },
    ],
  };

  it('scales an off-target day by one factor and leaves close or wildly-off days alone', () => {
    // Day 1 is 3000 kcal for a 2400 target (factor 0.8); day 2 is within 5%; day 3 is 5x under.
    const { plan: out, adjusted } = scalePortionsToTarget(plan, new Map([[1, 3000], [2, 2450], [3, 480]]), 2400);
    expect(adjusted).toEqual([{ dayNumber: 1, fromKcal: 3000 }]);
    expect(out.days[0].meals[0].ingredients).toEqual([{ name: 'rolled oats', grams: 80 }, { name: 'olive oil', grams: 8 }]);
    expect(out.days[1]).toBe(plan.days[1]);
    expect(out.days[2]).toBe(plan.days[2]);
    expect(out.name).toBe('P');
  });
});

describe('rules checked from exercise labels', () => {
  const label = (position: string, impact: string, equipment: string[] = []) => ({ position, impact, equipment });
  const labelled = new Map<string, any>([
    ['e1', { id: 'e1', name: 'Squat', difficulty: 'beginner', tags: label('standing', 'low') }],
    ['e2', { id: 'e2', name: 'Push Up', difficulty: 'beginner', tags: label('floor', 'low') }],
    ['e3', { id: 'e3', name: 'Jump Squat', difficulty: 'beginner', tags: label('standing', 'high') }],
    ['e4', { id: 'e4', name: 'Dumbbell Row', difficulty: 'beginner', tags: label('standing', 'low', ['dumbbells']) }],
    ['e5', { id: 'e5', name: 'Mystery Move', difficulty: 'beginner', tags: null }],
  ]);
  const rows = (ids: string[]) => ids.map((exerciseId) => ({ exerciseId, sets: 3, duration: '1 min' }));
  const twoDays = (ids: string[]) => ({
    name: 'Starter',
    description: 'A simple plan',
    weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Monday', exercises: rows(ids) }, { dayOfWeek: 'Wednesday', exercises: rows(ids) }] }],
  });
  const twoDaySpec = { ...spec, daysPerWeek: 2 };

  it('rejects floor, high-impact and equipment exercises when their rule is on, once per exercise', () => {
    const plan = twoDays(['e1', 'e2', 'e3', 'e4']);
    const { errors } = checkExercisePlan({ ...twoDaySpec, minutesPerSession: 15, noFloorExercises: true, lowImpactOnly: true, bodyweightOnly: true }, plan, labelled);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/"Push Up" is done on the floor/);
    expect(errors.join('\n')).toMatch(/"Jump Squat" is high impact/);
    expect(errors.join('\n')).toMatch(/"Dumbbell Row" needs equipment \(dumbbells\)/);
  });

  it('allows the same exercises when no rule is on', () => {
    expect(checkExercisePlan({ ...twoDaySpec, minutesPerSession: 15 }, twoDays(['e1', 'e2', 'e3', 'e4']), labelled).errors).toEqual([]);
  });

  it('says which exercises could not be checked because they have no labels', () => {
    const { errors, warnings } = checkExercisePlan({ ...twoDaySpec, noFloorExercises: true }, twoDays(['e1', 'e5', 'e4']), labelled);
    expect(errors).toEqual([]);
    expect(warnings.join()).toMatch(/no labels yet.*Mystery Move/);
  });
});
