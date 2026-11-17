/**
 * Lowercase, and only letters, digits, %, commas and spaces: USDA's server answers 400 to some
 * punctuation in a query (e.g. "rolled oats/oatmeal"), and the search ignores it anyway. Also the
 * key for our own food table, so "Chicken breast (cooked)" and "chicken breast, cooked" agree.
 */
export const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9%, ]+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[ ,]+|[ ,]+$/g, '');
