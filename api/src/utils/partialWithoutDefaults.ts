import { z } from 'zod';

/**
 * `schema.partial()` for update endpoints. Zod 4 fills `.default()` values even inside
 * optional fields, so a plain `.partial()` would reset omitted fields to their defaults.
 */
export const partialWithoutDefaults = <Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) =>
  z.object(
    Object.fromEntries(
      Object.entries(schema.shape).map(([key, field]) => [
        key,
        ((field instanceof z.ZodDefault ? field.unwrap() : field) as z.ZodType).optional(),
      ]),
    ),
  ) as unknown as z.ZodObject<{ [Key in keyof Shape]: z.ZodOptional<Shape[Key]> }>;
