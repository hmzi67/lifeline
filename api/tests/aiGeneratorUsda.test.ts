export {};

import { matchScore, pickBestMatch, searchTerms } from '../src/services/aiGenerator/usda';

const food = (description: string, kcal = 100) => ({ description, kcal, protein: 1, carbs: 1, fat: 1 });
const pick = (query: string, descriptions: string[]) => pickBestMatch(query, descriptions.map((d) => food(d)))?.description ?? null;

// Descriptions below are real USDA results seen in Nov 2026, in the order USDA returned them.
describe('picking the USDA food for an ingredient', () => {
  it('prefers the food named first over one that only shares a later word', () => {
    expect(pick('salmon fillet cooked', ['Emu, fan fillet, cooked, broiled', 'Fish, salmon, chinook, cooked, dry heat'])).toBe('Fish, salmon, chinook, cooked, dry heat');
  });

  it('prefers the plain food over a product made from it', () => {
    expect(pick('almonds', ['Almond butter', 'Almonds, salted'])).toBe('Almonds, salted');
    expect(pick('walnuts', ['Oil, walnut', 'Nuts, walnuts, English, halves, raw'])).toBe('Nuts, walnuts, English, halves, raw');
    expect(pick('chicken breast, cooked', ['Chicken breast tenders, breaded, cooked, microwaved', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'])).toBe(
      'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    );
  });

  it('takes a bare name to mean the raw food', () => {
    expect(pick('banana', ['Bananas, dehydrated, or banana powder', 'Banana, raw'])).toBe('Banana, raw');
    expect(pick('apple', ['Apple, candied', 'Apple, raw'])).toBe('Apple, raw');
    expect(pick('eggs, whole', ['Egg, whole, dried', 'Egg, whole, raw'])).toBe('Egg, whole, raw');
  });

  it('keeps a product the ingredient actually names', () => {
    expect(pick('peanut butter', ['Peanut butter', 'Peanuts, raw'])).toBe('Peanut butter');
    expect(pick('whey protein powder', ['Beverages, Protein powder whey based'])).toBe('Beverages, Protein powder whey based');
    expect(pick('mozzarella cheese', ['Cheese, mozzarella, whole milk'])).toBe('Cheese, mozzarella, whole milk');
  });

  it('rejects a dish that only contains the ingredient, or adds fat or fruit', () => {
    expect(pick('granola', ['Yogurt parfait, lowfat, with fruit and granola', 'Cereals ready-to-eat, granola, homemade'])).toBe('Cereals ready-to-eat, granola, homemade');
    expect(pick('cottage cheese, lowfat', ['Cheese, cottage, lowfat, 1% milkfat, with fruit', 'Cheese, cottage, lowfat, 1% milkfat'])).toBe('Cheese, cottage, lowfat, 1% milkfat');
    expect(pick('sweet potato, baked', ['Sweet potato, baked, fat added', 'Sweet potato, cooked, baked in skin, flesh, without salt'])).toBe(
      'Sweet potato, cooked, baked in skin, flesh, without salt',
    );
    expect(pick('rice, white, cooked', ['Rice, white, cooked, no added fat'])).toBe('Rice, white, cooked, no added fat');
    expect(pick('tomato sauce', ['Tomato chili sauce'])).toBeNull();
    expect(pick('egg, whole, cooked', ['Egg, whole, cooked, omelet', 'Egg, whole, cooked, hard-boiled'])).toBe('Egg, whole, cooked, hard-boiled');
    expect(pick('zucchini', ['Squash, zucchini, italian style, canned', 'Squash, summer, zucchini, raw'])).toBe('Squash, summer, zucchini, raw');
  });

  it('finds nothing when every result is a different food', () => {
    expect(pick('mixed berries', ['Snack, Mixed Berry Bar', 'Beverages, POWERADE, Zero, Mixed Berry'])).toBeNull();
    expect(pick('basmati rice, cooked', ['Rice, white, cooked, no added fat'])).toBeNull();
    expect(pick('unicorn steak', [])).toBeNull();
  });

  it('scores the first food word double', () => {
    expect(matchScore('salmon fillet', 'Fish, salmon, raw').score).toBeCloseTo(2 / 3);
    expect(matchScore('salmon fillet', 'Emu, fan fillet').score).toBeCloseTo(1 / 3);
  });
});

describe('names USDA files under another word', () => {
  it('searches for the name USDA uses', () => {
    expect(searchTerms('Ghee')).toBe('ghee clarified butter');
    expect(searchTerms('roti')).toBe('roti bread');
    expect(searchTerms('curd, low fat')).toBe('yogurt, plain, low fat');
    expect(searchTerms('Chicken breast (cooked)')).toBe('chicken breast cooked');
  });

  it('reads bare everyday names as the plain food', () => {
    expect(searchTerms('Egg')).toBe('egg, whole, raw');
    expect(searchTerms('tea, brewed')).toBe('tea, black, brewed');
    expect(pick(searchTerms('egg'), ['Egg, Benedict', 'Egg, whole, raw, fresh'])).toBe('Egg, whole, raw, fresh');
    expect(pick('tea, brewed', ['Beverages, tea, hibiscus, brewed'])).toBeNull();
  });

  it('does not take "no added fat" in the name as asking for fat', () => {
    expect(pick('chickpeas, roasted, no added fat', ['Chickpeas, from canned, fat added'])).toBeNull();
  });

  it('lets an aliased name match', () => {
    expect(pick(searchTerms('ghee'), ['Butter, salted', 'Ghee, clarified butter'])).toBe('Ghee, clarified butter');
    expect(pick(searchTerms('chapati'), ['Bread, chapati or roti, plain, commercially prepared'])).toBe('Bread, chapati or roti, plain, commercially prepared');
  });
});
