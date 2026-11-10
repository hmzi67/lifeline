export {};

const mockPrisma = {
  userDietPlan: { findUnique: jest.fn() },
  userExercise: { findUnique: jest.fn() },
  userActiveExercisePlan: { findUnique: jest.fn() },
  userExerciseProgress: { findUnique: jest.fn() },
  userActiveDietPlan: { findUnique: jest.fn() },
  userWaterGoal: { findUnique: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockAuthenticate = jest.fn((_req, _res, next) => next());
const mockAdminAuthorization = jest.fn((_req, _res, next) => next());
const mockAuthorize = jest.fn(() => mockAdminAuthorization);

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: mockAuthenticate,
}));

jest.mock('../src/middleware/authorize', () => ({
  __esModule: true,
  default: mockAuthorize,
}));

const { bindBodyUserIdToCaller, requireRecordOwner, requireSelfOrAdmin } =
  require('../src/middleware/ownership') as typeof import('../src/middleware/ownership');

type Layer = {
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
};

const routers: Record<string, { stack: Layer[] }> = {
  'user-diet-plans': require('../src/routes/userDietPlanRoutes').default,
  'user-exercises': require('../src/routes/userExerciseRoutes').default,
  'active-exercise-plans': require('../src/routes/userActiveExercisePlanRoutes').default,
  'user-exercise-progress': require('../src/routes/userExerciseProgressRoutes').default,
  'active-diet-plans': require('../src/routes/userActiveDietPlanRoutes').default,
  'water-goals': require('../src/routes/userWaterGoalRoutes').default,
};
const warmupRouter: { stack: Layer[] } = require('../src/routes/warmupRoutes').default;

const callerRequest = (overrides: Record<string, unknown> = {}, role = 'user') =>
  ({ params: {}, body: {}, user: { id: 'user-1', email: 'a@example.test', role }, ...overrides }) as any;

const runMiddleware = async (middleware: any, req: any) => {
  const next = jest.fn();
  await middleware(req, {}, next);
  return next.mock.calls[0]?.[0];
};

describe('user plan route wiring', () => {
  it.each(Object.keys(routers))('%s authenticates before any route', (name) => {
    const stack = routers[name].stack;
    const firstRoute = stack.findIndex((layer) => layer.route);
    const authIndex = stack.findIndex((layer) => !layer.route && layer.handle === mockAuthenticate);
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeLessThan(firstRoute);
  });

  it.each(Object.keys(routers))('%s never leaves a route without an access check', (name) => {
    for (const layer of routers[name].stack) {
      if (!layer.route) continue;
      // The last handler is the controller; at least one guard must run before it.
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('mounts exercise progress and warm-up, which the app calls', () => {
    const appSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/app.ts'), 'utf8');
    expect(appSource).toMatch(/app\.use\('\/api\/user-exercise-progress', userExerciseProgressRoutes\)/);
    expect(appSource).toMatch(/app\.use\('\/api\/warmup', warmupRoutes\)/);
    const firstRoute = warmupRouter.stack.findIndex((layer) => layer.route);
    expect(warmupRouter.stack.findIndex((layer) => layer.handle === mockAuthenticate)).toBeLessThan(firstRoute);
  });

  it('keeps cross-user listings admin-only', () => {
    const adminOnly = (name: string, path: string) => {
      const layer = routers[name].stack.find((l) => l.route?.path === path && l.route.methods.get);
      expect(layer!.route!.stack[0].handle).toBe(mockAdminAuthorization);
    };
    adminOnly('user-diet-plans', '/');
    adminOnly('user-diet-plans', '/diet/:dietId/users');
    adminOnly('user-exercises', '/');
    adminOnly('user-exercises', '/exercise/:exerciseId/users');
    adminOnly('water-goals', '/');
  });

  it('keeps the all-users medication and cheat day listings admin-only (they exposed owner emails)', () => {
    for (const file of ['medicationRoutes', 'cheatDayRoutes']) {
      const router: { stack: Layer[] } = require(`../src/routes/${file}`).default;
      const handlers = router.stack.find((l) => l.route?.path === '/' && l.route.methods.get)!.route!.stack.map((h) => h.handle);
      expect(handlers.slice(0, 2)).toEqual([mockAuthenticate, mockAdminAuthorization]);
    }
  });

  it('checks ownership on every active diet plan and water goal route', () => {
    const guardOf = (name: string, method: string, path: string) =>
      routers[name].stack.find((l) => l.route?.path === path && l.route.methods[method])!.route!.stack[0].handle;

    expect(guardOf('active-diet-plans', 'post', '/start')).toBe(bindBodyUserIdToCaller);
    expect(guardOf('water-goals', 'post', '/')).toBe(bindBodyUserIdToCaller);
    for (const [name, method, path] of [
      ['active-diet-plans', 'get', '/user/:userId'],
      ['active-diet-plans', 'put', '/:id/pause'],
      ['active-diet-plans', 'put', '/:id/resume'],
      ['active-diet-plans', 'put', '/:id/current-day'],
      ['active-diet-plans', 'delete', '/:id'],
      ['water-goals', 'get', '/user/:userId'],
      ['water-goals', 'delete', '/:id'],
    ]) {
      expect(guardOf(name, method, path)).not.toBe(bindBodyUserIdToCaller);
    }
  });
});

describe('ownership middleware', () => {
  it('requireSelfOrAdmin blocks other users and allows self and admins', async () => {
    const guard = requireSelfOrAdmin();
    expect((await runMiddleware(guard, callerRequest({ params: { userId: 'user-2' } })))?.statusCode).toBe(403);
    expect(await runMiddleware(guard, callerRequest({ params: { userId: 'user-1' } }))).toBeUndefined();
    expect(await runMiddleware(guard, callerRequest({ params: { userId: 'user-2' } }, 'admin'))).toBeUndefined();
  });

  it('bindBodyUserIdToCaller overrides a spoofed userId', async () => {
    const req = callerRequest({ body: { userId: 'user-2', dietId: 'diet-1' } });
    await runMiddleware(bindBodyUserIdToCaller, req);
    expect(req.body).toEqual({ userId: 'user-1', dietId: 'diet-1' });
  });

  it('requireRecordOwner hides rows owned by someone else', async () => {
    const guard = requireRecordOwner('userActiveExercisePlan');
    mockPrisma.userActiveExercisePlan.findUnique.mockResolvedValueOnce({ userId: 'user-2' });
    expect((await runMiddleware(guard, callerRequest({ params: { id: 'plan-1' } })))?.statusCode).toBe(404);

    mockPrisma.userActiveExercisePlan.findUnique.mockResolvedValueOnce(null);
    expect((await runMiddleware(guard, callerRequest({ params: { id: 'missing' } })))?.statusCode).toBe(404);

    mockPrisma.userActiveExercisePlan.findUnique.mockResolvedValueOnce({ userId: 'user-1' });
    expect(await runMiddleware(guard, callerRequest({ params: { id: 'plan-1' } }))).toBeUndefined();
  });

  it.each(['userActiveDietPlan', 'userWaterGoal'] as const)('requireRecordOwner covers %s', async (model) => {
    const guard = requireRecordOwner(model);
    mockPrisma[model].findUnique.mockResolvedValueOnce({ userId: 'user-2' });
    expect((await runMiddleware(guard, callerRequest({ params: { id: 'row-1' } })))?.statusCode).toBe(404);

    mockPrisma[model].findUnique.mockResolvedValueOnce({ userId: 'user-1' });
    expect(await runMiddleware(guard, callerRequest({ params: { id: 'row-1' } }))).toBeUndefined();
  });
});
