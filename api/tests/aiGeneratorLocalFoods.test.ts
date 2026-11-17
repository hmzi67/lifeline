export {};

import { LOCAL_FOODS, localFood, localFoodNames } from '../src/services/aiGenerator/localFoods';

describe('our food table', () => {
  it('answers desi staples without USDA', () => {
    expect(localFood('Roti')?.kcal).toBe(297);
    expect(localFood('masoor dal, cooked')?.description).toContain('Lifeline food table');
    expect(localFood('Chickpeas, roasted')?.protein).toBe(22.5);
    expect(localFood('egg')?.description).toMatch(/^Egg, whole, raw/);
    expect(localFood('unicorn steak')).toBeUndefined();
  });

  it('never lists one name for two foods', () => {
    const seen = new Map<string, string>();
    for (const food of LOCAL_FOODS) {
      for (const name of food.names) {
        expect(seen.get(name) ?? food.label).toBe(food.label);
        seen.set(name, food.label);
      }
    }
  });

  it('has calories that agree with the macros (within 15%, or 20 kcal)', () => {
    for (const food of LOCAL_FOODS) {
      const fromMacros = food.protein * 4 + food.carbs * 4 + food.fat * 9;
      expect({ food: food.label, off: Math.abs(fromMacros - food.kcal) <= Math.max(20, food.kcal * 0.15) }).toEqual({ food: food.label, off: true });
    }
  });

  it('suggests a cuisine its own staples plus everyday foods', () => {
    const pakistani = localFoodNames('Pakistani');
    expect(pakistani).toEqual(expect.arrayContaining(['roti', 'masoor dal, cooked', 'egg, whole, raw']));
    expect(pakistani).not.toContain('hummus');
    expect(localFoodNames('Middle Eastern')).toContain('hummus');
    expect(localFoodNames('Nigerian')).toContain('egg, whole, raw');
  });
});
