export {};

// Catalog lists are public: their queries may count assignments but must never select users.
const calls: any[] = [];
const model = () => ({
  findMany: jest.fn(async (args: any) => { calls.push(args); return []; }),
  findUnique: jest.fn(async (args: any) => { calls.push(args); return { id: 'x' }; }),
});
const mockPrisma: any = { exercise: model(), exercisePlan: model(), dietPlan: model() };
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const exercises = require('../src/controllers/exerciseController') as typeof import('../src/controllers/exerciseController');
const plans = require('../src/controllers/exercisePlanController') as typeof import('../src/controllers/exercisePlanController');
const diets = require('../src/controllers/dietPlanController') as typeof import('../src/controllers/dietPlanController');

const res = () => {
  const r: any = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const selectsUsers = (value: unknown): boolean =>
  !!value && typeof value === 'object' &&
  Object.entries(value as Record<string, unknown>).some(([key, v]) => key === 'user' || key === 'email' || selectsUsers(v));

it.each([
  ['GET /exercises', exercises.getAllExercises, {}],
  ['GET /exercises/:id', exercises.getExerciseById, { params: { id: 'x' } }],
  ['GET /exercises/search', exercises.searchExercises, { query: { q: 'run' } }],
  ['GET /exercises/purpose/:purpose', exercises.getExercisesByPurpose, { params: { purpose: 'cardio' } }],
  ['GET /exercise-plans', plans.getAllExercisePlans, {}],
  ['GET /diet-plans', diets.getAllDietPlans, {}],
  ['GET /diet-plans/:id', diets.getDietPlanById, { params: { id: 'x' } }],
  ['GET /diet-plans/search', diets.searchDietPlans, { query: { q: 'keto' } }],
] as const)('%s exposes no user records', async (_name, handler, req) => {
  calls.length = 0;
  await (handler as any)({ params: {}, query: {}, headers: {}, ...req }, res());
  expect(calls.length).toBeGreaterThan(0);
  for (const args of calls) expect(selectsUsers(args.include)).toBe(false);
});
