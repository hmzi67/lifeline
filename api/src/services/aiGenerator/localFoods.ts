/**
 * Our own per-100 g values for staples USDA matches badly or doesn't have (roti, paratha, dal,
 * besan, paneer, hummus, falafel, tortillas...). An ingredient whose cleaned name is listed here
 * never goes to USDA, so it can't be matched to the wrong food. The writer AI is told these
 * names, so it uses them.
 *
 * Values are typical published figures (USDA SR Legacy / FNDDS, India's IFCT 2017, Pakistan's
 * food composition table) rounded to one decimal. They were written down in Nov 2026 and should
 * be checked once by a dietitian; prepared foods (paratha, chai, lassi, raita) vary by recipe.
 */
import { normalize } from './normalize.js';

export type LocalFood = {
  /** Shown to admins as the "USDA food used". */
  label: string;
  /** Cleaned ingredient names that mean this food. The first one is suggested to the AI. */
  names: string[];
  /** Cuisines the AI is told about this food for; "any" for everyday staples. */
  cuisines: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SOUTH_ASIAN = ['Pakistani', 'Indian'];
const MIDDLE_EAST = ['Middle Eastern', 'Turkish', 'Persian'];
const EAST_ASIAN = ['Chinese', 'Thai', 'Japanese'];

export const LOCAL_FOODS: LocalFood[] = [
  // ---- everyday staples (any cuisine)
  { label: 'Egg, whole, raw', names: ['egg, whole, raw', 'egg', 'eggs', 'egg, whole', 'eggs, whole'], cuisines: ['any'], kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { label: 'Egg, whole, hard-boiled', names: ['egg, boiled', 'boiled egg', 'boiled eggs', 'egg, hard boiled', 'eggs, boiled', 'egg, cooked', 'egg, whole, cooked'], cuisines: ['any'], kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6 },
  { label: 'Egg white, raw', names: ['egg white', 'egg whites'], cuisines: ['any'], kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 },
  { label: 'Chicken breast, skinless, cooked', names: ['chicken breast, cooked', 'chicken breast', 'chicken, boneless, cooked', 'chicken, cooked'], cuisines: ['any'], kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { label: 'Chicken breast, skinless, raw', names: ['chicken breast, raw', 'chicken, raw'], cuisines: ['any'], kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { label: 'Chicken thigh, skinless, cooked', names: ['chicken thigh, cooked', 'chicken thigh'], cuisines: ['any'], kcal: 209, protein: 26, carbs: 0, fat: 10.9 },
  { label: 'Mutton (goat meat), cooked', names: ['mutton, cooked', 'mutton', 'goat meat, cooked', 'goat meat'], cuisines: ['any'], kcal: 143, protein: 27.1, carbs: 0, fat: 3 },
  { label: 'Beef, lean, cooked', names: ['beef, cooked', 'beef', 'beef, lean, cooked', 'beef boneless, cooked'], cuisines: ['any'], kcal: 217, protein: 26.1, carbs: 0, fat: 11.8 },
  { label: 'Beef mince (keema), 85% lean, cooked', names: ['beef mince, cooked', 'beef keema, cooked', 'beef keema', 'ground beef, cooked', 'keema, cooked', 'keema'], cuisines: ['any'], kcal: 250, protein: 25.9, carbs: 0, fat: 15.4 },
  { label: 'Chicken mince, cooked', names: ['chicken mince, cooked', 'chicken keema, cooked', 'chicken keema', 'ground chicken, cooked'], cuisines: ['any'], kcal: 189, protein: 23.3, carbs: 0, fat: 10.2 },
  { label: 'White fish (tilapia), cooked', names: ['fish, cooked', 'white fish, cooked', 'tilapia, cooked', 'fish'], cuisines: ['any'], kcal: 128, protein: 26.2, carbs: 0, fat: 2.7 },
  { label: 'White rice, cooked', names: ['rice, cooked', 'white rice, cooked', 'rice, white, cooked', 'chawal, cooked', 'chawal'], cuisines: ['any'], kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  { label: 'Basmati rice, cooked', names: ['basmati rice, cooked', 'rice, basmati, cooked'], cuisines: ['any'], kcal: 121, protein: 3.5, carbs: 25.2, fat: 0.4 },
  { label: 'Brown rice, cooked', names: ['brown rice, cooked', 'rice, brown, cooked'], cuisines: ['any'], kcal: 123, protein: 2.7, carbs: 25.6, fat: 1 },
  { label: 'Potato, boiled', names: ['potato, boiled', 'potatoes, boiled', 'potato, cooked', 'aloo, boiled', 'aloo'], cuisines: ['any'], kcal: 87, protein: 1.9, carbs: 20.1, fat: 0.1 },
  { label: 'Milk, whole', names: ['milk, whole', 'whole milk', 'milk', 'doodh'], cuisines: ['any'], kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { label: 'Yogurt, plain, whole milk', names: ['yogurt, plain, whole milk', 'yogurt, plain', 'yogurt', 'dahi', 'curd', 'plain yogurt'], cuisines: ['any'], kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { label: 'Yogurt, plain, low fat', names: ['yogurt, low fat', 'yogurt, plain, low fat', 'low fat yogurt', 'dahi, low fat'], cuisines: ['any'], kcal: 63, protein: 5.3, carbs: 7, fat: 1.6 },
  { label: 'Vegetable oil', names: ['oil, vegetable', 'vegetable oil', 'oil', 'cooking oil', 'canola oil', 'sunflower oil'], cuisines: ['any'], kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { label: 'Olive oil', names: ['olive oil', 'oil, olive'], cuisines: ['any'], kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { label: 'Sugar, white', names: ['sugar', 'sugar, white', 'white sugar'], cuisines: ['any'], kcal: 387, protein: 0, carbs: 100, fat: 0 },
  { label: 'Black tea, brewed, no milk', names: ['tea, black, brewed', 'black tea', 'tea', 'tea, brewed', 'green tea'], cuisines: ['any'], kcal: 1, protein: 0, carbs: 0.3, fat: 0 },
  { label: 'Almonds', names: ['almonds', 'badam'], cuisines: ['any'], kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9 },
  { label: 'Mixed nuts, unsalted', names: ['mixed nuts', 'nuts, mixed', 'nuts'], cuisines: ['any'], kcal: 607, protein: 20, carbs: 21, fat: 54 },
  { label: 'Dates', names: ['dates', 'date', 'khajoor', 'dates, dried'], cuisines: ['any'], kcal: 282, protein: 2.5, carbs: 75, fat: 0.4 },

  // ---- Pakistani / Indian
  { label: 'Roti / chapati, whole wheat', names: ['roti', 'chapati', 'chapatti', 'phulka', 'whole wheat roti', 'roti, whole wheat', 'chapati, whole wheat'], cuisines: SOUTH_ASIAN, kcal: 297, protein: 9.6, carbs: 49.6, fat: 7.4 },
  { label: 'Paratha, plain', names: ['paratha', 'plain paratha', 'paratha, plain', 'whole wheat paratha'], cuisines: SOUTH_ASIAN, kcal: 326, protein: 6.4, carbs: 45.4, fat: 13.2 },
  { label: 'Aloo paratha', names: ['aloo paratha', 'potato paratha'], cuisines: SOUTH_ASIAN, kcal: 230, protein: 5, carbs: 31, fat: 10 },
  { label: 'Naan, plain', names: ['naan', 'naan, plain', 'plain naan'], cuisines: SOUTH_ASIAN, kcal: 291, protein: 9.6, carbs: 50.6, fat: 5.7 },
  { label: 'Puri, fried', names: ['puri', 'poori'], cuisines: SOUTH_ASIAN, kcal: 340, protein: 7, carbs: 45, fat: 15 },
  { label: 'Whole wheat flour (atta)', names: ['whole wheat flour', 'atta', 'wheat flour, whole'], cuisines: SOUTH_ASIAN, kcal: 340, protein: 13.2, carbs: 72, fat: 2.5 },
  { label: 'Gram flour (besan)', names: ['besan', 'gram flour', 'chickpea flour'], cuisines: SOUTH_ASIAN, kcal: 387, protein: 22.4, carbs: 57.8, fat: 6.7 },
  { label: 'Semolina (sooji)', names: ['sooji', 'suji', 'semolina'], cuisines: SOUTH_ASIAN, kcal: 360, protein: 12.7, carbs: 72.8, fat: 1.1 },
  { label: 'Red lentils (masoor dal), cooked', names: ['masoor dal, cooked', 'masoor dal', 'red lentils, cooked', 'lentils, cooked', 'dal, cooked', 'daal, cooked'], cuisines: SOUTH_ASIAN, kcal: 116, protein: 9, carbs: 20.1, fat: 0.4 },
  { label: 'Red lentils (masoor dal), dry', names: ['masoor dal, raw', 'masoor dal, dry', 'red lentils, raw', 'red lentils, dry'], cuisines: SOUTH_ASIAN, kcal: 358, protein: 24.6, carbs: 63.1, fat: 2.2 },
  { label: 'Mung beans split (moong dal), cooked', names: ['moong dal, cooked', 'moong dal', 'mung dal, cooked'], cuisines: SOUTH_ASIAN, kcal: 105, protein: 7, carbs: 19.2, fat: 0.4 },
  { label: 'Black gram split (mash / urad dal), cooked', names: ['mash dal, cooked', 'mash dal', 'urad dal, cooked', 'urad dal', 'maash dal'], cuisines: SOUTH_ASIAN, kcal: 105, protein: 7.5, carbs: 18.3, fat: 0.6 },
  { label: 'Split chickpeas (chana dal), cooked', names: ['chana dal, cooked', 'chana dal'], cuisines: SOUTH_ASIAN, kcal: 120, protein: 7, carbs: 20, fat: 1.5 },
  { label: 'Chickpeas (chana), cooked', names: ['chickpeas, cooked', 'chickpeas', 'chana, cooked', 'chana', 'kabuli chana', 'chole', 'white chickpeas, cooked'], cuisines: ['any'], kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6 },
  { label: 'Roasted chickpeas (bhuna chana)', names: ['roasted chickpeas', 'chickpeas, roasted', 'roasted chana', 'bhuna chana', 'roasted chanay', 'chanay, roasted'], cuisines: SOUTH_ASIAN, kcal: 369, protein: 22.5, carbs: 58.8, fat: 5.2 },
  { label: 'Kidney beans (rajma), cooked', names: ['kidney beans, cooked', 'rajma', 'rajma, cooked', 'red kidney beans, cooked'], cuisines: ['any'], kcal: 127, protein: 8.7, carbs: 22.8, fat: 0.5 },
  { label: 'Ghee', names: ['ghee', 'desi ghee', 'clarified butter'], cuisines: SOUTH_ASIAN, kcal: 876, protein: 0.3, carbs: 0, fat: 99.5 },
  { label: 'Paneer', names: ['paneer', 'cottage cheese, paneer'], cuisines: SOUTH_ASIAN, kcal: 265, protein: 18.3, carbs: 1.2, fat: 20.8 },
  { label: 'Chai with milk and sugar (doodh patti)', names: ['chai', 'doodh patti', 'milk tea', 'tea with milk', 'chai with milk'], cuisines: SOUTH_ASIAN, kcal: 55, protein: 1.7, carbs: 7.5, fat: 1.7 },
  { label: 'Lassi, sweet', names: ['lassi', 'sweet lassi', 'lassi, sweet'], cuisines: SOUTH_ASIAN, kcal: 75, protein: 2.5, carbs: 12, fat: 2 },
  { label: 'Lassi, salted', names: ['salted lassi', 'lassi, salted', 'namkeen lassi'], cuisines: SOUTH_ASIAN, kcal: 40, protein: 2.5, carbs: 3, fat: 2 },
  { label: 'Raita (yogurt with cucumber)', names: ['raita', 'cucumber raita'], cuisines: SOUTH_ASIAN, kcal: 50, protein: 3, carbs: 4, fat: 2.5 },
  { label: 'Kachumber salad (onion, tomato, cucumber)', names: ['kachumber', 'kachumber salad', 'salad, kachumber'], cuisines: SOUTH_ASIAN, kcal: 20, protein: 0.9, carbs: 4.2, fat: 0.2 },
  { label: 'Jaggery (gur)', names: ['jaggery', 'gur'], cuisines: SOUTH_ASIAN, kcal: 383, protein: 0.4, carbs: 98, fat: 0.1 },

  // ---- Middle Eastern / Turkish / Persian
  { label: 'Pita / khubz (Arabic bread)', names: ['pita', 'pita bread', 'khubz', 'arabic bread', 'pitta bread'], cuisines: MIDDLE_EAST, kcal: 275, protein: 9.1, carbs: 55.7, fat: 1.2 },
  { label: 'Hummus', names: ['hummus', 'houmous'], cuisines: MIDDLE_EAST, kcal: 166, protein: 7.9, carbs: 14.3, fat: 9.6 },
  { label: 'Tahini', names: ['tahini', 'tahina', 'sesame paste'], cuisines: MIDDLE_EAST, kcal: 595, protein: 17, carbs: 21.2, fat: 53.8 },
  { label: 'Falafel', names: ['falafel'], cuisines: MIDDLE_EAST, kcal: 333, protein: 13.3, carbs: 31.8, fat: 17.8 },
  { label: 'Bulgur, cooked', names: ['bulgur, cooked', 'bulgur', 'burghul'], cuisines: MIDDLE_EAST, kcal: 83, protein: 3.1, carbs: 18.6, fat: 0.2 },
  { label: 'Couscous, cooked', names: ['couscous, cooked', 'couscous'], cuisines: [...MIDDLE_EAST, 'Mediterranean'], kcal: 112, protein: 3.8, carbs: 23.2, fat: 0.2 },
  { label: 'Fava beans (ful medames), cooked', names: ['fava beans, cooked', 'ful medames', 'foul', 'broad beans, cooked'], cuisines: MIDDLE_EAST, kcal: 110, protein: 7.6, carbs: 19.7, fat: 0.4 },
  { label: 'Labneh', names: ['labneh', 'labne', 'strained yogurt'], cuisines: MIDDLE_EAST, kcal: 154, protein: 7, carbs: 4, fat: 12 },
  { label: 'Halloumi', names: ['halloumi'], cuisines: [...MIDDLE_EAST, 'Mediterranean'], kcal: 321, protein: 21, carbs: 2, fat: 26 },
  { label: 'Feta cheese', names: ['feta', 'feta cheese', 'white cheese'], cuisines: [...MIDDLE_EAST, 'Mediterranean'], kcal: 264, protein: 14.2, carbs: 4.1, fat: 21.3 },

  // ---- Chinese / Thai / Japanese
  { label: 'Tofu, firm', names: ['tofu, firm', 'firm tofu', 'tofu'], cuisines: [...EAST_ASIAN, 'any'], kcal: 144, protein: 17.3, carbs: 2.8, fat: 8.7 },
  { label: 'Tofu, soft', names: ['tofu, soft', 'soft tofu', 'silken tofu'], cuisines: EAST_ASIAN, kcal: 61, protein: 6.6, carbs: 1.8, fat: 3.7 },
  { label: 'Rice noodles, cooked', names: ['rice noodles, cooked', 'rice noodles'], cuisines: EAST_ASIAN, kcal: 108, protein: 1.8, carbs: 24, fat: 0.2 },
  { label: 'Egg noodles, cooked', names: ['egg noodles, cooked', 'egg noodles', 'noodles, cooked'], cuisines: EAST_ASIAN, kcal: 138, protein: 4.5, carbs: 25.2, fat: 2.1 },
  { label: 'Jasmine rice, cooked', names: ['jasmine rice, cooked', 'rice, jasmine, cooked'], cuisines: EAST_ASIAN, kcal: 129, protein: 2.7, carbs: 28, fat: 0.3 },
  { label: 'Soy sauce', names: ['soy sauce', 'light soy sauce'], cuisines: EAST_ASIAN, kcal: 53, protein: 8.1, carbs: 4.9, fat: 0.6 },
  { label: 'Fish sauce', names: ['fish sauce'], cuisines: EAST_ASIAN, kcal: 35, protein: 5.1, carbs: 3.6, fat: 0 },
  { label: 'Coconut milk, canned', names: ['coconut milk', 'coconut milk, canned'], cuisines: [...EAST_ASIAN, ...SOUTH_ASIAN], kcal: 197, protein: 2, carbs: 2.8, fat: 21.3 },
  { label: 'Bok choy', names: ['bok choy', 'pak choi', 'bok choy, raw'], cuisines: EAST_ASIAN, kcal: 13, protein: 1.5, carbs: 2.2, fat: 0.2 },
  { label: 'Edamame', names: ['edamame', 'edamame, cooked'], cuisines: EAST_ASIAN, kcal: 121, protein: 11.9, carbs: 8.9, fat: 5.2 },
  { label: 'Miso paste', names: ['miso', 'miso paste'], cuisines: EAST_ASIAN, kcal: 199, protein: 12.8, carbs: 25.4, fat: 6 },
  { label: 'Sesame oil', names: ['sesame oil'], cuisines: EAST_ASIAN, kcal: 884, protein: 0, carbs: 0, fat: 100 },

  // ---- Italian / Mediterranean
  { label: 'Pasta, cooked', names: ['pasta, cooked', 'pasta', 'spaghetti, cooked', 'penne, cooked'], cuisines: ['Italian', 'Mediterranean', 'Western'], kcal: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
  { label: 'Whole wheat pasta, cooked', names: ['whole wheat pasta, cooked', 'whole wheat pasta'], cuisines: ['Italian', 'Mediterranean', 'Western'], kcal: 149, protein: 6, carbs: 30, fat: 1.7 },
  { label: 'Mozzarella, whole milk', names: ['mozzarella', 'mozzarella cheese'], cuisines: ['Italian', 'Western'], kcal: 300, protein: 22.2, carbs: 2.2, fat: 22.4 },
  { label: 'Parmesan', names: ['parmesan', 'parmesan cheese', 'parmigiano'], cuisines: ['Italian'], kcal: 392, protein: 35.8, carbs: 3.2, fat: 25.8 },
  { label: 'Ricotta, whole milk', names: ['ricotta', 'ricotta cheese'], cuisines: ['Italian'], kcal: 174, protein: 11.3, carbs: 3, fat: 13 },

  // ---- Mexican
  { label: 'Corn tortilla', names: ['corn tortilla', 'tortilla, corn', 'corn tortillas'], cuisines: ['Mexican'], kcal: 218, protein: 5.7, carbs: 44.6, fat: 2.9 },
  { label: 'Flour tortilla', names: ['flour tortilla', 'tortilla, flour', 'tortilla', 'wheat tortilla'], cuisines: ['Mexican', 'Western'], kcal: 306, protein: 8.2, carbs: 50, fat: 8 },
  { label: 'Black beans, cooked', names: ['black beans, cooked', 'black beans'], cuisines: ['Mexican'], kcal: 132, protein: 8.9, carbs: 23.7, fat: 0.5 },
  { label: 'Pinto beans, cooked', names: ['pinto beans, cooked', 'pinto beans'], cuisines: ['Mexican'], kcal: 143, protein: 9, carbs: 26.2, fat: 0.7 },
  { label: 'Avocado', names: ['avocado', 'avocados'], cuisines: ['Mexican', 'Western', 'Mediterranean'], kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },

  // ---- Western
  { label: 'Rolled oats, dry', names: ['rolled oats', 'oats', 'oats, rolled', 'oatmeal, dry'], cuisines: ['Western'], kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  { label: 'Whole wheat bread', names: ['whole wheat bread', 'bread, whole wheat', 'brown bread'], cuisines: ['Western'], kcal: 252, protein: 12.4, carbs: 42.7, fat: 3.5 },
  { label: 'White bread', names: ['white bread', 'bread, white', 'bread'], cuisines: ['Western'], kcal: 266, protein: 7.6, carbs: 50.6, fat: 3.3 },
  { label: 'Peanut butter', names: ['peanut butter'], cuisines: ['Western'], kcal: 588, protein: 25.1, carbs: 20, fat: 50.4 },
  { label: 'Greek yogurt, plain, nonfat', names: ['greek yogurt', 'greek yogurt, plain', 'greek yogurt, nonfat'], cuisines: ['Western', 'Mediterranean'], kcal: 59, protein: 10.2, carbs: 3.6, fat: 0.4 },
  { label: 'Cheddar cheese', names: ['cheddar', 'cheddar cheese'], cuisines: ['Western'], kcal: 403, protein: 24.9, carbs: 1.3, fat: 33.1 },
];

const byName = new Map<string, LocalFood>();
for (const food of LOCAL_FOODS) for (const name of food.names) byName.set(normalize(name), food);

/** Our value for an ingredient name, or undefined when it should go to USDA. */
export const localFood = (name: string) => {
  const food = byName.get(normalize(name));
  return food && { description: `${food.label} (Lifeline food table)`, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat };
};

/** The suggested names (first name of each food) for a cuisine, for the writer AI's brief. */
export const localFoodNames = (cuisine: string) =>
  LOCAL_FOODS.filter((food) => food.cuisines.includes('any') || food.cuisines.some((c) => c.toLowerCase() === cuisine.toLowerCase())).map((food) => food.names[0]);
