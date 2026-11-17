/**
 * What each diet type and cuisine means, written down so the AI doesn't guess.
 *
 * Without this, "High-Protein" + "Pakistani" came back as gym food with desi names (egg sandwich
 * with an orange, yogurt toast, protein oats). The writer AI gets the rulebook in its brief, the
 * reviewer treats breaking it as must-fix, and our code rejects meals whose name is a dish from
 * another cuisine (checkCuisine), the same way it rejects meat in a vegan plan.
 */
import type { DIET_TYPES } from './constants.js';
import { localFoodNames } from './localFoods.js';

type DietType = (typeof DIET_TYPES)[number];
type Rule = { means: string; choose: string; avoid: string };

/** Written for any cuisine; the cuisine section below says which dishes to use. */
export const DIET_TYPE_RULES: Record<DietType, Rule> = {
  Traditional: {
    means: 'Everyday home cooking exactly as families of this cuisine eat it: the classic dishes, cooked the usual way, in normal home portions.',
    choose: "The cuisine's well-known breakfast, lunch, dinner and snack dishes and its own staples (breads, rice, lentils, curries, vegetables, yogurt).",
    avoid: 'Dishes from other cuisines, "healthy fusion" versions, and gym or diet food.',
  },
  'High-Protein': {
    means: 'The same home dishes of this cuisine, chosen and portioned so protein is high (at least 25% of calories). It is not a different cuisine.',
    choose: "The cuisine's protein-rich dishes: chicken, mutton, beef, fish, eggs, lentils, chickpeas, beans, yogurt and paneer, with smaller portions of bread and rice.",
    avoid: 'Western gym food: protein shakes or bars, egg-white omelette with toast, chicken-and-broccoli boxes, protein oats, sandwiches.',
  },
  'High Calories': {
    means: 'Filling, energy-dense home dishes of this cuisine for gaining weight, with bigger portions and healthy fats.',
    choose: "The cuisine's richer dishes and staples, with milk, nuts, dried fruit, ghee or oil in normal home amounts.",
    avoid: 'Junk food, fast food, sugary drinks and mass-gainer shakes.',
  },
  'Calorie-Cutting': {
    means: "Lighter versions of this cuisine's home dishes for weight loss: the same dishes, less oil, more vegetables and lentils, smaller bread and rice portions.",
    choose: "The cuisine's grilled, baked, boiled or lightly cooked dishes, vegetable dishes, lentils, salads and yogurt.",
    avoid: 'Fried food and sweets, and diet products from other cuisines (crispbread, rice cakes, salad bowls, smoothies).',
  },
  Vegetarian: {
    means: "This cuisine's home dishes with no meat, chicken or fish. Eggs and dairy are fine.",
    choose: "The cuisine's vegetable, lentil, bean and dairy dishes.",
    avoid: 'Meat, chicken and fish, and imported meat substitutes.',
  },
  'Vegan (Plant diet)': {
    means: "This cuisine's plant-based home dishes: no meat, fish, eggs, dairy (milk, yogurt, ghee, butter, paneer, cream) or honey.",
    choose: "The cuisine's vegetable, lentil, bean and grain dishes cooked in plant oil.",
    avoid: 'All animal foods, including ghee, yogurt and milk in tea.',
  },
  Pescatarian: {
    means: "This cuisine's home dishes with fish and seafood as the meat. Eggs and dairy are fine.",
    choose: "The cuisine's fish and seafood dishes, plus its vegetable, lentil and dairy dishes.",
    avoid: 'Meat and chicken.',
  },
  Keto: {
    means: "This cuisine's dishes made very low in carbs (50 g or less a day): meat, fish, eggs, vegetables and fats, with no bread, rice or sugar.",
    choose: "The cuisine's curries, grills and egg dishes, cooked with low-carb vegetables, without bread, rice or lentils.",
    avoid: 'Bread, rice, lentils, potatoes, fruit juices, sweets, and keto products from other cuisines.',
  },
  Paleo: {
    means: "This cuisine's dishes made with meat, fish, eggs, vegetables, fruit, nuts and seeds, and no grains, legumes, dairy or refined sugar.",
    choose: "The cuisine's grills, meat and fish curries and vegetable dishes.",
    avoid: 'Bread, rice, lentils, beans, dairy and sugar.',
  },
  Mediterranean: {
    means: "This cuisine's dishes cooked the Mediterranean way: olive oil, plenty of vegetables, legumes, fish, whole grains and little red meat.",
    choose: "The cuisine's vegetable, lentil, bean, fish and chicken dishes, with whole-wheat bread and salads.",
    avoid: 'Fried food, a lot of red meat, and sweets.',
  },
  'Diabetes type 1': {
    means: "This cuisine's home dishes with steady, moderate carbs at every meal (45% of calories or less) and plenty of fibre.",
    choose: 'Whole-wheat bread, small rice portions, lentils, vegetables, lean meat and plain yogurt.',
    avoid: 'Sugar, sweets, sweetened drinks, white bread and fried snacks.',
  },
  'Diabetes type 2': {
    means: "This cuisine's home dishes kept low in carbs (45% of calories or less) and rich in fibre, for steady blood sugar.",
    choose: 'Whole-wheat bread, small rice portions, lentils, vegetables, lean meat and plain yogurt.',
    avoid: 'Sugar, sweets, sweetened drinks, white bread and fried snacks.',
  },
};

type Cuisine = {
  name: string;
  /** Spellings an admin might type. */
  aliases: string[];
  dishes: Record<'breakfast' | 'main' | 'snack', string>;
  /** Shown to the AI; not checked by code. */
  notThis: string;
  /** Words in a meal name that mean a dish from another cuisine. Checked by code. */
  foreignDishWords: string[];
  /** Ingredients that don't belong in this cuisine's home cooking. Checked by code. */
  foreignIngredients: string[];
};

export const CUISINES: Cuisine[] = [
  {
    name: 'Pakistani',
    aliases: ['pakistani', 'desi', 'pakistan', 'punjabi', 'south asian'],
    dishes: {
      breakfast: 'paratha (aloo, plain, anda), anda omelette or fried egg with roti, anda bhurji, chana with roti, halwa puri (now and then), dahi, lassi, chai',
      main: 'roti, chapati, naan, chawal, pulao, biryani, dal (masoor, mash, moong, chana), chicken or mutton salan, karahi, qorma, keema, aloo keema, nihari, haleem, palak, bhindi, aloo gobi, mixed sabzi, chicken tikka, seekh or chapli kebab, fish curry, raita, kachumber salad',
      snack: 'chana chaat, fruit chaat, roasted chanay, dahi bhalla, shami kebab, boiled eggs with chaat masala, nuts, lassi, chai',
    },
    notThis:
      'No sandwiches, toast, burgers, wraps, pasta, pizza, oats or porridge bowls, smoothies, granola, cereal, pancakes, quinoa or protein shakes, and no Western dish given a desi name ("anda sandwich", "dahi toast").',
    foreignDishWords: [
      'sandwich',
      'toast',
      'burger',
      'wrap',
      'pasta',
      'spaghetti',
      'macaroni',
      'noodle',
      'pizza',
      'oats',
      'oatmeal',
      'porridge',
      'smoothie',
      'granola',
      'cereal',
      'pancake',
      'waffle',
      'bagel',
      'muffin',
      'quinoa',
      'burrito',
      'taco',
      'sushi',
      'shake',
      'protein bar',
      'salad bowl',
      'avocado',
    ],
    foreignIngredients: ['oats', 'rolled oats', 'quinoa', 'whey', 'protein powder', 'granola', 'cereal', 'pasta', 'tortilla', 'bagel', 'avocado'],
  },
  {
    name: 'Indian',
    aliases: ['indian', 'india', 'north indian', 'south indian'],
    dishes: {
      breakfast: 'paratha, poha, upma, idli with sambar, dosa, besan chilla, anda bhurji with roti, dahi, chai',
      main: 'roti, chapati, rice, jeera rice, pulao, biryani, dal tadka, rajma, chole, palak paneer, paneer bhurji, mixed sabzi, aloo gobi, bhindi, chicken curry, fish curry, tandoori chicken, raita, kachumber',
      snack: 'chana chaat, fruit chaat, roasted chana, dhokla, sprouts salad, buttermilk (chaas), nuts, chai',
    },
    notThis: 'No sandwiches, toast, burgers, wraps, pasta, pizza, oats bowls, smoothies, granola, cereal, pancakes, quinoa or protein shakes.',
    foreignDishWords: ['sandwich', 'toast', 'burger', 'wrap', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'porridge', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'quinoa', 'burrito', 'taco', 'sushi', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'quinoa', 'whey', 'protein powder', 'granola', 'cereal', 'pasta', 'tortilla', 'bagel'],
  },
  {
    name: 'Middle Eastern',
    aliases: ['middle eastern', 'arab', 'arabic', 'lebanese', 'gulf', 'emirati', 'saudi', 'khaleeji', 'egyptian', 'syrian', 'jordanian'],
    dishes: {
      breakfast: 'ful medames, shakshuka, labneh with khubz, eggs with za\'atar, hummus with pita, cheese and olives, dates, Arabic coffee or tea',
      main: 'khubz or pita, rice (machboos, kabsa, mandi), chicken or lamb kebab, shish tawook, grilled fish, lentil soup (shorbat adas), mujaddara, fattoush, tabbouleh, hummus, moutabal, stuffed vegetables, okra stew (bamia), molokhia',
      snack: 'dates, nuts, labneh, hummus with vegetables, falafel, fruit, laban',
    },
    notThis: 'No sandwiches on sliced bread, toast, burgers, pasta, pizza, oats bowls, smoothies, granola, cereal, pancakes or protein shakes.',
    foreignDishWords: ['toast', 'burger', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'porridge', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'sushi', 'curry', 'biryani', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'pasta', 'tortilla', 'bagel'],
  },
  {
    name: 'Turkish',
    aliases: ['turkish', 'turkey'],
    dishes: {
      breakfast: 'menemen, white cheese, olives, tomato and cucumber, boiled eggs, simit or bread, honey and kaymak (now and then), tea',
      main: 'bread, bulgur pilavi, rice pilaf, mercimek corbasi, kuru fasulye, etli nohut, kofte, chicken or lamb sis kebab, grilled fish, karniyarik, imam bayildi, dolma, coban salatasi, cacik, ayran',
      snack: 'nuts, dried apricots and figs, fruit, ayran, yogurt',
    },
    notThis: 'No toast-and-jam breakfasts, burgers, pasta bowls, pizza, oats bowls, smoothies, granola, cereal or protein shakes.',
    foreignDishWords: ['toast', 'burger', 'pizza', 'oats', 'oatmeal', 'porridge', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'sushi', 'curry', 'biryani', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'tortilla', 'bagel'],
  },
  {
    name: 'Persian',
    aliases: ['persian', 'iranian', 'iran'],
    dishes: {
      breakfast: 'nan-e barbari or lavash with feta, walnuts and herbs (nan-o-panir-o-sabzi), eggs, dates, tea',
      main: 'chelow rice, polo dishes, ghormeh sabzi, gheimeh, fesenjan, joojeh kabab, koobideh, ash reshteh, adas polo, kuku sabzi, mast-o-khiar, shirazi salad',
      snack: 'nuts, dried fruit, fresh fruit, yogurt drink (doogh)',
    },
    notThis: 'No toast, burgers, pasta, pizza, oats bowls, smoothies, granola, cereal or protein shakes.',
    foreignDishWords: ['toast', 'burger', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'porridge', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'sushi', 'curry', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'tortilla', 'bagel'],
  },
  {
    name: 'Chinese',
    aliases: ['chinese', 'china', 'cantonese', 'sichuan'],
    dishes: {
      breakfast: 'congee (rice porridge), steamed buns (baozi), soy milk, tea eggs, scallion pancake, noodle soup',
      main: 'steamed rice, fried rice, noodles, stir-fried vegetables, steamed fish, kung pao chicken, mapo tofu, beef with broccoli, tomato and egg stir-fry, hot and sour soup, dumplings, bok choy with garlic',
      snack: 'fruit, steamed corn, tea eggs, edamame, nuts, tea',
    },
    notThis: 'No sandwiches, toast, burgers, pasta, pizza, oats bowls, smoothies, granola, cereal or protein shakes.',
    foreignDishWords: ['sandwich', 'toast', 'burger', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'smoothie', 'granola', 'cereal', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'curry', 'biryani', 'paratha', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'pasta', 'tortilla', 'bagel'],
  },
  {
    name: 'Thai',
    aliases: ['thai', 'thailand'],
    dishes: {
      breakfast: 'jok (rice porridge), khao tom (rice soup), fried egg with rice, grilled pork or chicken with sticky rice',
      main: 'jasmine rice, sticky rice, green or red curry, tom yum, tom kha, pad krapow, pad thai, larb, som tam, grilled chicken (gai yang), stir-fried vegetables, fish with lime and chilli',
      snack: 'fresh fruit, mango with sticky rice (now and then), grilled skewers, nuts',
    },
    notThis: 'No sandwiches, toast, burgers, pasta, pizza, oats bowls, smoothies, granola, cereal or protein shakes.',
    foreignDishWords: ['sandwich', 'toast', 'burger', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'biryani', 'paratha', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'pasta', 'tortilla', 'bagel'],
  },
  {
    name: 'Japanese',
    aliases: ['japanese', 'japan'],
    dishes: {
      breakfast: 'rice, miso soup, grilled fish, tamagoyaki, natto, pickles, green tea',
      main: 'rice, miso soup, grilled salmon, teriyaki chicken, tofu dishes, soba or udon noodles, donburi, sushi or onigiri, nimono (simmered vegetables), sunomono salad, edamame',
      snack: 'onigiri, edamame, fruit, green tea',
    },
    notThis: 'No sandwiches, toast, burgers, pasta, pizza, oats bowls, smoothies, granola, cereal or protein shakes.',
    foreignDishWords: ['sandwich', 'toast', 'burger', 'pasta', 'spaghetti', 'pizza', 'oats', 'oatmeal', 'smoothie', 'granola', 'cereal', 'pancake', 'waffle', 'bagel', 'muffin', 'burrito', 'taco', 'biryani', 'paratha', 'shake', 'protein bar'],
    foreignIngredients: ['oats', 'rolled oats', 'whey', 'protein powder', 'granola', 'cereal', 'tortilla', 'bagel'],
  },
  {
    name: 'Italian',
    aliases: ['italian', 'italy'],
    dishes: {
      breakfast: 'yogurt with fruit, bread with ricotta, frittata, fruit, coffee or milk',
      main: 'pasta dishes (pomodoro, aglio e olio, pasta e fagioli, lentil ragu), risotto, minestrone, grilled chicken or fish, caprese salad, roasted vegetables, bruschetta, polenta, white bean soup',
      snack: 'fruit, nuts, cheese with bread, olives, yogurt',
    },
    notThis: 'No curries, biryani, burritos, sushi, protein shakes or dishes from other cuisines.',
    foreignDishWords: ['curry', 'biryani', 'karahi', 'burrito', 'taco', 'sushi', 'noodle', 'stir fry', 'shake', 'protein bar'],
    foreignIngredients: ['whey', 'protein powder', 'tortilla'],
  },
  {
    name: 'Mediterranean',
    aliases: ['mediterranean', 'greek', 'greece', 'spanish', 'spain'],
    dishes: {
      breakfast: 'Greek yogurt with honey and nuts, eggs with tomato, bread with olive oil, feta and olives, fruit',
      main: 'whole-grain bread, grilled fish, chicken souvlaki, lentil or bean soups, Greek salad, horiatiki, stuffed peppers, gemista, tzatziki, roasted vegetables, couscous or bulgur salads, paella (now and then)',
      snack: 'fruit, nuts, hummus with vegetables, olives, yogurt',
    },
    notThis: 'No curries, biryani, burritos, sushi, protein shakes or fast food.',
    foreignDishWords: ['curry', 'biryani', 'karahi', 'burrito', 'taco', 'sushi', 'noodle', 'stir fry', 'burger', 'shake', 'protein bar'],
    foreignIngredients: ['whey', 'protein powder', 'tortilla'],
  },
  {
    name: 'Mexican',
    aliases: ['mexican', 'mexico'],
    dishes: {
      breakfast: 'huevos rancheros, chilaquiles, eggs with beans and corn tortillas, fruit, atole (now and then)',
      main: 'corn tortillas, rice, black or pinto beans, chicken or beef tacos, fajitas, pozole, tortilla soup, enchiladas, grilled fish, salsa, guacamole, nopales',
      snack: 'fruit with lime and chilli, jicama, guacamole with vegetables, roasted corn (elote)',
    },
    notThis: 'No pasta, pizza, curries, sushi, oats bowls, granola or protein shakes.',
    foreignDishWords: ['pasta', 'spaghetti', 'pizza', 'curry', 'biryani', 'sushi', 'noodle', 'granola', 'shake', 'protein bar'],
    foreignIngredients: ['whey', 'protein powder', 'granola'],
  },
  {
    name: 'Western',
    aliases: ['western', 'american', 'usa', 'british', 'english', 'continental', 'european', 'international'],
    dishes: {
      breakfast: 'oatmeal, eggs with whole-grain toast, Greek yogurt with fruit, omelette, whole-grain cereal with milk',
      main: 'grilled chicken or fish with vegetables and potatoes, salads, soups, sandwiches and wraps on whole-grain bread, pasta, rice bowls, roast dinner, chili',
      snack: 'fruit, nuts, yogurt, cheese, hummus with vegetables',
    },
    notThis: 'Keep to everyday Western home food.',
    foreignDishWords: [],
    foreignIngredients: [],
  },
];

/** The cuisine used when the admin leaves the field empty; the app is built for Pakistani users. */
export const DEFAULT_CUISINE = 'Pakistani';

/** The cuisine name the plan should follow: what the admin typed, or the default. */
export const cuisineName = (name?: string | null) => (name?.trim() ? name.trim() : DEFAULT_CUISINE);

export const findCuisine = (name?: string | null) => {
  const key = cuisineName(name).toLowerCase();
  return CUISINES.find((cuisine) => cuisine.name.toLowerCase() === key || cuisine.aliases.includes(key)) ?? null;
};

/** The rulebook text for the writer AI and the reviewer. */
export const dietRulebook = (dietType: string, cuisine?: string | null) => {
  const rule = DIET_TYPE_RULES[dietType as DietType];
  const known = findCuisine(cuisine);
  const name = known?.name ?? cuisineName(cuisine);
  const lines = ["What this plan must be (every meal must fit; a meal that doesn't is wrong even if the numbers are right):"];
  lines.push(`- Cuisine: ${name}. Every meal is a real ${name} home dish, named the way ${name} families call it.`);
  if (known) {
    lines.push(`  Typical ${name} breakfasts: ${known.dishes.breakfast}.`);
    lines.push(`  Typical ${name} lunches and dinners: ${known.dishes.main}.`);
    lines.push(`  Typical ${name} snacks: ${known.dishes.snack}.`);
    lines.push(`  ${known.notThis}`);
  } else {
    lines.push(`  Use only dishes ${name} families commonly cook at home; no dishes from other cuisines.`);
  }
  lines.push(
    `- Ingredient names with checked nutrition values (use these exact names when they fit; for anything else use a plain USDA-style name): ${localFoodNames(name).join('; ')}.`,
  );
  if (rule) {
    lines.push(`- Diet type "${dietType}": ${rule.means}`);
    lines.push(`  Choose: ${rule.choose}`);
    lines.push(`  Avoid: ${rule.avoid}`);
  }
  return lines.join('\n');
};

const found = (text: string, list: string[]) => list.filter((word) => new RegExp(`\\b${word}s?\\b`, 'i').test(text));

/**
 * Meals that clearly come from another cuisine, judged from the meal name and its ingredients.
 * Returns one error per meal; nothing for a cuisine we have no word lists for.
 */
export const checkCuisine = (cuisine: string | null | undefined, meals: { where: string; name: string; ingredients: string[] }[]) => {
  const known = findCuisine(cuisine);
  if (!known) return [];
  const errors: string[] = [];
  for (const meal of meals) {
    const hits = [...new Set([...found(meal.name, known.foreignDishWords), ...found(meal.ingredients.join(' | '), known.foreignIngredients)])];
    if (!hits.length) continue;
    errors.push(
      `${meal.where}: ${hits.map((word) => `"${word}"`).join(', ')} ${hits.length === 1 ? 'is' : 'are'} not ${known.name} home food. Replace the meal with a ${known.name} dish from the list in the brief.`,
    );
  }
  return errors;
};
