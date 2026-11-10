export {};

const mockAuthenticate = jest.fn((_req, _res, next) => next());
const mockAdminAuthorization = jest.fn((_req, _res, next) => next());
const mockAuthorize = jest.fn(() => mockAdminAuthorization);
const mockRequireActiveLicense = jest.fn((_req, _res, next) => next());

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: mockAuthenticate,
}));

jest.mock('../src/middleware/authorize', () => ({
  __esModule: true,
  default: mockAuthorize,
}));

jest.mock('../src/middleware/requireActiveLicense', () => ({
  __esModule: true,
  default: mockRequireActiveLicense,
}));

type RouteLayer = {
  route?: {
    methods: Record<string, boolean>;
    path: string;
    stack: Array<{ handle: unknown }>;
  };
};

const meditationRouter = require('../src/routes/meditationRoutes').default;
const meditationSessionRouter = require('../src/routes/meditationSessionRoutes').default;
const sleepSoundRouter = require('../src/routes/sleepSoundRoutes').default;
const sleepStoryRouter = require('../src/routes/sleepStoryRoutes').default;

const routers = [
  require('../src/routes/appSettingRoutes').default,
  require('../src/routes/challengeExerciseRoutes').default,
  require('../src/routes/dietPlanRoutes').default,
  require('../src/routes/dietPlanDayRoutes').default,
  require('../src/routes/dietPlanMealRoutes').default,
  require('../src/routes/exerciseDetailRoutes').default,
  require('../src/routes/exercisePlanRoutes').default,
  require('../src/routes/exercisePlanScheduleRoutes').default,
  require('../src/routes/exercisePlanWeekRoutes').default,
  require('../src/routes/exerciseRoutes').default,
  require('../src/routes/mealTypeRoutes').default,
  meditationRouter,
  meditationSessionRouter,
  require('../src/routes/roleRoutes').default,
  sleepSoundRouter,
  sleepStoryRouter,
];

const blogRouter = require('../src/routes/blogRoutes').default;
const challengeRouter = require('../src/routes/challengeRoutes').default;
const subscriptionPaymentRouter = require('../src/routes/subscriptionPaymentRoutes').default;
const favoriteMeditationRouter = require('../src/routes/userFavoriteMeditationRoutes').default;
const progressRouter = require('../src/routes/progressRoutes').default;

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);

describe('catalog mutation route security', () => {
  it('requires authentication and admin authorization on every mutation', () => {
    for (const router of routers) {
      const mutationLayers = (router.stack as RouteLayer[]).filter((layer) =>
        layer.route && Object.keys(layer.route.methods).some((method) => mutationMethods.has(method))
      );

      expect(mutationLayers.length).toBeGreaterThan(0);

      for (const layer of mutationLayers) {
        const handlers = layer.route!.stack.map((entry) => entry.handle);
        expect(handlers[0]).toBe(mockAuthenticate);
        expect(handlers[1]).toBe(mockAdminAuthorization);
      }
    }
  });

  it('keeps blog administration admin-only and user comments authenticated', () => {
    const mutationLayers = (blogRouter.stack as RouteLayer[]).filter((layer) =>
      layer.route && Object.keys(layer.route.methods).some((method) => mutationMethods.has(method))
    );
    const commentLayers = mutationLayers.filter((layer) => layer.route!.path.includes('comments'));
    const adminLayers = mutationLayers.filter((layer) => !layer.route!.path.includes('comments'));

    expect(commentLayers).toHaveLength(3);
    expect(adminLayers).toHaveLength(6);

    for (const layer of commentLayers) {
      const handlers = layer.route!.stack.map((entry) => entry.handle);
      expect(handlers[0]).toBe(mockAuthenticate);
      expect(handlers).not.toContain(mockAdminAuthorization);
    }

    for (const layer of adminLayers) {
      const handlers = layer.route!.stack.map((entry) => entry.handle);
      expect(handlers[0]).toBe(mockAuthenticate);
      expect(handlers[1]).toBe(mockAdminAuthorization);
    }
  });

  it('keeps challenge administration admin-only and joining/submitting authenticated', () => {
    const mutationLayers = (challengeRouter.stack as RouteLayer[]).filter((layer) =>
      layer.route && Object.keys(layer.route.methods).some((method) => mutationMethods.has(method))
    );
    const userPaths = ['/:id/join', '/:id/complete', '/submit', '/apple-purchases', '/:id/checkout', '/:id/checkout/confirm', '/:id/report'];
    const userLayers = mutationLayers.filter((layer) => userPaths.includes(layer.route!.path));
    const adminLayers = mutationLayers.filter((layer) => !userLayers.includes(layer));

    expect(userLayers).toHaveLength(7);
    // create, update, set exercises/diets, delete, approve/reject and resolve reports
    expect(adminLayers).toHaveLength(6);
    for (const layer of userLayers) {
      expect(layer.route!.stack[0].handle).toBe(mockAuthenticate);
      expect(layer.route!.stack.map((entry) => entry.handle)).not.toContain(mockAdminAuthorization);
    }

    const pendingLayer = (challengeRouter.stack as RouteLayer[]).find(
      (layer) => layer.route?.path === '/approvals/pending',
    );
    expect(pendingLayer!.route!.stack.map((entry) => entry.handle).slice(0, 2)).toEqual([
      mockAuthenticate,
      mockAdminAuthorization,
    ]);

    for (const layer of adminLayers) {
      const handlers = layer.route!.stack.map((entry) => entry.handle);
      expect(handlers[0]).toBe(mockAuthenticate);
      expect(handlers[1]).toBe(mockAdminAuthorization);
    }
  });

  it('declares the authenticated payment-history route before admin ID routes', () => {
    const routeLayers = (subscriptionPaymentRouter.stack as RouteLayer[]).filter((layer) => layer.route);

    expect(routeLayers.map((layer) => layer.route!.path)).toEqual([
      '/me',
      '/',
      '/user/:userId',
      '/:id',
      '/',
      '/:id',
      '/:id',
    ]);

    const myPaymentHandlers = routeLayers[0].route!.stack.map((entry) => entry.handle);
    expect(myPaymentHandlers[0]).toBe(mockAuthenticate);
    expect(myPaymentHandlers).not.toContain(mockAdminAuthorization);

    for (const layer of routeLayers.slice(1)) {
      const handlers = layer.route!.stack.map((entry) => entry.handle);
      expect(handlers[0]).toBe(mockAuthenticate);
      expect(handlers[1]).toBe(mockAdminAuthorization);
    }
  });

  it('requires authentication on every favorite-meditation route', () => {
    const routeLayers = (favoriteMeditationRouter.stack as RouteLayer[]).filter((layer) => layer.route);

    expect(routeLayers[0].route!.path).toBe('/');
    for (const layer of routeLayers) {
      expect(layer.route!.stack[0].handle).toBe(mockAuthenticate);
      expect(layer.route!.stack[1].handle).toBe(mockRequireActiveLicense);
    }
  });

  it('requires an active license for playable meditation and sleep reads', () => {
    for (const router of [meditationRouter, meditationSessionRouter, sleepSoundRouter, sleepStoryRouter]) {
      const readLayers = (router.stack as RouteLayer[]).filter((layer) => layer.route?.methods.get);

      expect(readLayers.length).toBeGreaterThan(0);
      for (const layer of readLayers) {
        const handlers = layer.route!.stack.map((entry) => entry.handle);
        expect(handlers[0]).toBe(mockAuthenticate);
        expect(handlers[1]).toBe(mockRequireActiveLicense);
      }
    }
  });

  it('protects every progress route behind authentication and an active license', () => {
    const middleware = (progressRouter.stack as Array<{ route?: unknown; handle: unknown }>)
      .filter((layer) => !layer.route)
      .map((layer) => layer.handle);

    expect(middleware.slice(0, 2)).toEqual([mockAuthenticate, mockRequireActiveLicense]);
  });
});
