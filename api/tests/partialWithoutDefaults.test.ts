import { z } from 'zod';
import { partialWithoutDefaults } from '../src/utils/partialWithoutDefaults';

describe('partialWithoutDefaults', () => {
  const schema = z.object({
    name: z.string().min(1),
    isActive: z.boolean().default(true),
    status: z.enum(['ACTIVE', 'DRAFT']).optional().default('DRAFT'),
  });

  it('leaves omitted fields out instead of resetting them to their defaults', () => {
    // A plain .partial() in zod 4 would return { isActive: true, status: 'DRAFT' } here.
    expect(partialWithoutDefaults(schema).parse({ name: 'x' })).toEqual({ name: 'x' });
  });

  it('still validates the fields that are sent', () => {
    expect(partialWithoutDefaults(schema).parse({ isActive: false })).toEqual({ isActive: false });
    expect(() => partialWithoutDefaults(schema).parse({ name: '' })).toThrow();
    expect(() => partialWithoutDefaults(schema).parse({ status: 'NOPE' })).toThrow();
  });
});
