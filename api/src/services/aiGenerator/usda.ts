import { JobError } from './worker.js';
import { localFood } from './localFoods.js';
import { normalize } from './normalize.js';

export { normalize };

/**
 * Calories and macros from USDA FoodData Central, so the model never invents nutrition numbers.
 * Lookups are cached in memory (the API runs as one process), which keeps a batch well under
 * USDA's hourly request limit.
 */

export type Per100g = { description: string; kcal: number; protein: number; carbs: number; fat: number };
export type IngredientNutrition = Per100g & { name: string; grams: number };
export type NutritionTotals = { kcal: number; protein: number; carbs: number; fat: number };

const cache = new Map<string, Per100g | null>();

/** Test hook. */
export const clearNutritionCache = () => cache.clear();

const NUTRIENT = { energy: 1008, energyAtwaterGeneral: 2047, energyAtwaterSpecific: 2048, protein: 1003, fat: 1004, carbs: 1005 };

const amount = (food: any, id: number): number | null => {
  const row = (food?.foodNutrients ?? []).find((n: any) => Number(n.nutrientId ?? n.nutrient?.id) === id);
  const value = Number(row?.value ?? row?.amount);
  return Number.isFinite(value) ? value : null;
};

/** Reads per-100 g values from a USDA search hit; null when the hit lacks the basics. */
export const per100gFromFood = (food: any): Per100g | null => {
  const protein = amount(food, NUTRIENT.protein);
  const fat = amount(food, NUTRIENT.fat);
  const carbs = amount(food, NUTRIENT.carbs);
  if (protein == null || fat == null || carbs == null) return null;
  const kcal =
    amount(food, NUTRIENT.energy) ??
    amount(food, NUTRIENT.energyAtwaterSpecific) ??
    amount(food, NUTRIENT.energyAtwaterGeneral) ??
    protein * 4 + carbs * 4 + fat * 9;
  return { description: String(food.description ?? ''), kcal, protein, carbs, fat };
};


const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
/** Generic foods only; branded products have inconsistent serving data. */
const DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];

/**
 * POST with a JSON body: in Nov 2026 the GET form of this search failed about half the time with
 * a bare 400 from USDA's server, while POST worked every time. One retry covers a rare hiccup.
 */
const search = async (query: string, apiKey: string, signal?: AbortSignal) => {
  const send = () =>
    fetch(`${SEARCH_URL}?${new URLSearchParams({ api_key: apiKey })}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageSize: 25, dataType: DATA_TYPES }),
      signal,
    });
  const first = await send();
  if (first.status !== 400 && first.status < 500) return first;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return send();
};

/** Words about how a food is prepared or sold; they pick between matches but don't name the food. */
const STATE_WORDS = new Set(
  'raw cooked boiled baked roasted grilled steamed fried broiled fresh frozen canned dried dry plain whole unsalted salted boneless skinless lean ground chopped sliced diced large medium small low fat free reduced nonfat lowfat unsweetened sweetened without with and or in of the style type added no'.split(
    ' ',
  ),
);

/**
 * Words that turn a food into a different product ("almond butter", "apple, candied",
 * "broccoli, fried"). A description with one of these that the ingredient name didn't ask for
 * is a different food with different calories.
 */
const OTHER_PRODUCT_WORDS = new Set(
  'butter oil sauce dressing powder flour juice bar candied dehydrated breaded nugget tender fried chip syrup soup salad babyfood baby cookie cake pie cracker cereal pudding jam jelly spread pickled pickle glutinous skin sandwich burger pizza casserole stew curry mix flavored imitation substitute paste puree concentrate noodle milk cream bread bun roll muffin pancake waffle candy chocolate dessert smoked cured sausage jerky stuffed coated battered glazed sweetened dried beverage parfait omelet omelette chili italian scrambled benedict hibiscus herbal'.split(
    ' ',
  ),
);

/** Breakfast cereals are filed as "Cereals, ...", so "cereal" is the right kind of food for these. */
const CEREAL_WORDS = new Set(['granola', 'muesli', 'oat', 'oatmeal', 'cornflake', 'flake', 'bran']);

/** Dairy foods are described by the milk they are made from ("Cheese, mozzarella, whole milk"). */
const DAIRY_WORDS = new Set(['cheese', 'yogurt', 'kefir', 'curd']);
/** Names that mean a drink or powder, so a "Beverages, ..." entry is the right kind of food. */
const DRINK_WORDS = new Set(['powder', 'drink', 'shake', 'juice', 'tea', 'coffee', 'milk', 'smoothie', 'water', 'beverage']);

/** Names USDA files under another word; searched (and scored) as the right-hand side. */
const ALIASES: Record<string, string> = {
  ghee: 'ghee clarified butter',
  chapati: 'chapati bread',
  chapatti: 'chapati bread',
  roti: 'roti bread',
  naan: 'naan bread',
  pita: 'pita bread',
  curd: 'yogurt, plain',
  dahi: 'yogurt, plain',
  capsicum: 'bell pepper',
  coriander: 'coriander cilantro leaves',
  cilantro: 'coriander cilantro leaves',
};

/** Bare names that mean the everyday food ("egg" came back as "Egg, Benedict", "tea" as hibiscus tea). */
const WHOLE_NAMES: Record<string, string> = {
  egg: 'egg, whole, raw',
  eggs: 'egg, whole, raw',
  'egg, cooked': 'egg, whole, cooked, hard boiled',
  'eggs, cooked': 'egg, whole, cooked, hard boiled',
  'egg, boiled': 'egg, whole, cooked, hard boiled',
  tea: 'tea, black, brewed',
  'tea, brewed': 'tea, black, brewed',
  chai: 'tea, black, brewed',
  oil: 'oil, vegetable',
  'cooking oil': 'oil, vegetable',
};

/** The words to search USDA for: the cleaned name, with a whole-name alias applied. */
export const searchTerms = (name: string) => {
  const key = normalize(name);
  if (WHOLE_NAMES[key]) return WHOLE_NAMES[key];
  const [head, ...rest] = key.split(', ');
  return ALIASES[head] ? [ALIASES[head], ...rest].join(', ') : key;
};

const stem = (word: string) =>
  word
    .replace(/ies$/, 'y')
    .replace(/(sh|ch|ss|x|z|o)es$/, '$1')
    .replace(/([^s])s$/, '$1');
const wordsOf = (text: string) => (text.toLowerCase().match(/[a-z]+/g) ?? []).map(stem);

/**
 * How well a USDA food description fits an ingredient name.
 * - score (0 to 1): share of the name's food words found in the description; the first word
 *   counts double ("salmon fillet" is salmon).
 * - otherProduct: the description is a different product the name didn't ask for (see above).
 * - state: share of the name's preparation words (raw, cooked...) that match; when the name has
 *   none, a raw food scores 1, since a bare name ("banana") means the plain food.
 * - extras: description words the name doesn't have; fewer means a plainer, more generic food.
 */
export const matchScore = (query: string, description: string) => {
  const queryWords = wordsOf(query);
  const asked = new Set(queryWords);
  const described = wordsOf(description);
  const found = new Set(described);
  const food = queryWords.filter((word) => word.length > 2 && !STATE_WORDS.has(word));
  const states = queryWords.filter((word) => STATE_WORDS.has(word) && word.length > 2);
  const state = states.length ? states.filter((word) => found.has(word)).length / states.length : found.has('raw') ? 1 : 0;
  const dairy = described.some((word) => DAIRY_WORDS.has(word));
  const drink = queryWords.some((word) => DRINK_WORDS.has(word));
  const cereal = queryWords.some((word) => CEREAL_WORDS.has(word));
  // "Yogurt parfait ... with fruit and granola" is not granola, and "cottage cheese with fruit"
  // is not cottage cheese: words after "with" that the name didn't ask for add another food.
  const withAt = described.indexOf('with');
  const addsFood = withAt >= 0 && described.slice(withAt + 1).some((word) => word.length > 2 && !asked.has(word) && !STATE_WORDS.has(word));
  // "Sweet potato, baked, fat added" has more calories than the plain food ("no added fat" is fine).
  const lower = description.toLowerCase();
  const fatAdded = /\b(fat|oil|butter|salt|sugar)s? added\b/.test(lower) && !/\b(fat|oil|butter|salt|sugar)s? added\b/.test(query.toLowerCase());
  const otherProduct =
    addsFood ||
    fatAdded ||
    described.some(
      (word) =>
        (OTHER_PRODUCT_WORDS.has(word) || OTHER_PRODUCT_WORDS.has(`${word}s`)) &&
        !asked.has(word) &&
        !(dairy && (word === 'milk' || word === 'cream')) &&
        !(drink && word === 'beverage') &&
        !(cereal && word === 'cereal') &&
        // "baked in skin" is how a potato was cooked, not potato skins.
        !(word === 'skin' && /\bin skin\b/.test(lower)),
    );
  const extras = described.filter((word) => !asked.has(word) && !STATE_WORDS.has(word)).length;
  let total = 0;
  let got = 0;
  food.forEach((word, index) => {
    const weight = index === 0 ? 2 : 1;
    total += weight;
    if (found.has(word)) got += weight;
  });
  return { score: total ? got / total : 1, otherProduct, state, extras };
};

/** A match must cover at least this share of the ingredient's food words, or it counts as not found. */
const MIN_MATCH_SCORE = 0.6;

/**
 * The best-fitting hit, or null when none fits. USDA's own first result is often a different
 * food that shares a word ("salmon fillet, cooked" came back as emu fillet, "almonds" as almond
 * butter), which would quietly give a meal the wrong calories. Order of preference: covers the
 * name's words, is not a different product, matches the preparation, is the plainest.
 */
export const pickBestMatch = (query: string, foods: Per100g[]): Per100g | null => {
  let best: (ReturnType<typeof matchScore> & { food: Per100g }) | null = null;
  for (const food of foods) {
    const fit = matchScore(query, food.description);
    const better =
      !best ||
      fit.score !== best.score
        ? !best || fit.score > best.score
        : fit.otherProduct !== best.otherProduct
          ? !fit.otherProduct
          : fit.state !== best.state
            ? fit.state > best.state
            : fit.extras < best.extras;
    if (better) best = { ...fit, food };
  }
  return best && best.score >= MIN_MATCH_SCORE && !best.otherProduct ? best.food : null;
};

/** Per-100 g nutrition for a plain ingredient name ("chicken breast, raw"), or null if not found. */
export const lookupFood = async (name: string, signal?: AbortSignal): Promise<Per100g | null> => {
  const key = normalize(name);
  if (!key) return null;
  // Staples in our own table (roti, dal, paneer, hummus...) never go to USDA.
  const own = localFood(key);
  if (own) return own;
  if (cache.has(key)) return cache.get(key) ?? null;

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) throw new JobError('USDA_API_KEY is not set on the server.');

  const terms = searchTerms(name);
  const response = await search(terms, apiKey, signal);
  if (response.status === 429 || response.status >= 500) throw new JobError(`USDA is busy (${response.status}).`, true);
  if (response.status === 401 || response.status === 403) throw new JobError(`USDA refused the key (${response.status}). Check USDA_API_KEY.`);
  if (!response.ok) throw new JobError(`USDA lookup failed (${response.status}).`);

  const payload = await response.json();
  const hit = pickBestMatch(terms, (payload?.foods ?? []).map(per100gFromFood).filter((food: Per100g | null): food is Per100g => !!food));
  cache.set(key, hit);
  return hit;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export const sumNutrition = (items: { kcal: number; protein: number; carbs: number; fat: number }[]): NutritionTotals => ({
  kcal: Math.round(items.reduce((sum, item) => sum + item.kcal, 0)),
  protein: round1(items.reduce((sum, item) => sum + item.protein, 0)),
  carbs: round1(items.reduce((sum, item) => sum + item.carbs, 0)),
  fat: round1(items.reduce((sum, item) => sum + item.fat, 0)),
});

/** Nutrition of each ingredient at its weight, plus the names USDA didn't know. */
export const nutritionFor = async (ingredients: { name: string; grams: number }[], signal?: AbortSignal) => {
  const found: IngredientNutrition[] = [];
  const missing: string[] = [];
  for (const ingredient of ingredients) {
    const food = await lookupFood(ingredient.name, signal);
    if (!food) {
      missing.push(ingredient.name);
      continue;
    }
    const factor = ingredient.grams / 100;
    found.push({
      name: ingredient.name,
      grams: ingredient.grams,
      description: food.description,
      kcal: food.kcal * factor,
      protein: food.protein * factor,
      carbs: food.carbs * factor,
      fat: food.fat * factor,
    });
  }
  return { found, missing, totals: sumNutrition(found) };
};
