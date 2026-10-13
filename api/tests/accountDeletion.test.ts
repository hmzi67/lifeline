import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteUserAndData } from '../src/services/accountDeletionService';

/** Models whose relation to User is required, so they block deleting the user. */
const requiredUserRelations = (): string[] => {
  const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const models: string[] = [];
  for (const [, name, body] of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    const blocking = body.split('\n').some(line =>
      /^\s+\w+\s+User\s+@relation\(/.test(line) && !/onDelete:\s*(Cascade|SetNull)/.test(line),
    );
    if (blocking) models.push(name);
  }
  return models;
};

const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

const createMockPrisma = () => {
  const calls: string[] = [];
  const tx = new Proxy({} as Record<string, unknown>, {
    get: (_target, model: string) => ({
      deleteMany: jest.fn(async () => {
        calls.push(`${model}.deleteMany`);
        return { count: 0 };
      }),
      delete: jest.fn(async () => {
        calls.push(`${model}.delete`);
        return { id: 'user-1' };
      }),
    }),
  });
  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, calls };
};

describe('deleteUserAndData', () => {
  it('clears every model that would block deleting the user, then deletes the user', async () => {
    const { prisma, calls } = createMockPrisma();

    await deleteUserAndData(prisma as any, 'user-1');

    const blocking = requiredUserRelations();
    expect(blocking.length).toBeGreaterThan(0);
    for (const model of blocking) {
      expect(calls).toContain(`${delegateName(model)}.deleteMany`);
    }
    expect(calls[calls.length - 1]).toBe('user.delete');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('removes rows that reference other user-owned rows before their parents', async () => {
    const { prisma, calls } = createMockPrisma();

    await deleteUserAndData(prisma as any, 'user-1');

    const before = (child: string, parent: string) =>
      expect(calls.indexOf(`${child}.deleteMany`)).toBeLessThan(calls.indexOf(`${parent}.deleteMany`));
    before('medicationReminder', 'medication');
    before('userDailyRoutine', 'medication');
    before('userDailyRoutine', 'fastingLog');
    before('dietMealLog', 'userActiveDietPlan');
    before('referralUsage', 'referralCode');
  });
});
