export {};

import { DIET_TYPES } from '../src/services/aiGenerator/constants';
import { checkCuisine, DIET_TYPE_RULES, dietRulebook, findCuisine } from '../src/services/aiGenerator/dietRules';

const meal = (name: string, ingredients: string[] = []) => ({ where: `Day 1 "${name}"`, name, ingredients });

describe('diet rulebook', () => {
  it('defines every diet type the admin form offers', () => {
    for (const type of DIET_TYPES) expect(DIET_TYPE_RULES[type]).toBeDefined();
  });

  it('treats an empty cuisine as Pakistani and knows common spellings', () => {
    expect(findCuisine(undefined)?.name).toBe('Pakistani');
    expect(findCuisine('  ')?.name).toBe('Pakistani');
    expect(findCuisine('Desi')?.name).toBe('Pakistani');
    expect(findCuisine('Italian')?.name).toBe('Italian');
    expect(findCuisine('Nigerian')).toBeNull();
  });

  it('gives the AI the dishes and the diet type meaning', () => {
    const text = dietRulebook('High-Protein', 'Pakistani');
    expect(text).toContain('karahi');
    expect(text).toContain('No sandwiches');
    expect(text).toContain('not a different cuisine');
  });

  it('still asks for the cuisine it has no dish list for', () => {
    expect(dietRulebook('Traditional', 'Nigerian')).toContain('Every meal is a real Nigerian home dish');
  });
});

describe('meals from another cuisine', () => {
  it('rejects Western dishes given desi names', () => {
    const errors = checkCuisine('Pakistani', [
      meal('Anda sandwich with orange'),
      meal('Dahi toast with chicken and apple'),
      meal('Banana protein oats', ['rolled oats', 'whey protein powder']),
    ]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('"sandwich"');
    expect(errors[2]).toContain('"oats"');
  });

  it('accepts real Pakistani dishes', () => {
    expect(
      checkCuisine(undefined, [
        meal('Aloo Paratha with Yogurt', ['potato, boiled', 'whole wheat flour', 'yogurt, plain']),
        meal('Chicken Karahi with Roti', ['chicken breast, cooked', 'tomato', 'roti']),
        meal('Chana Chaat', ['chickpeas, cooked', 'onion']),
      ]),
    ).toEqual([]);
  });

  it('checks the other cuisines too', () => {
    expect(checkCuisine('Lebanese', [meal('Chicken pasta bake')])).toHaveLength(1);
    expect(checkCuisine('Arabic', [meal('Ful medames with khubz', ['fava beans, cooked', 'pita'])])).toEqual([]);
    expect(checkCuisine('Chinese', [meal('Chicken biryani')])).toHaveLength(1);
    expect(checkCuisine('Western', [meal('Turkey sandwich')])).toEqual([]);
    expect(dietRulebook('Keto', 'Turkish')).toContain('kofte');
  });

  it('does not judge a cuisine it has no word lists for', () => {
    expect(checkCuisine('Nigerian', [meal('Jollof rice with pasta')])).toEqual([]);
  });
});
