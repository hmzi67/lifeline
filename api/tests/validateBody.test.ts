import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const mockWarn = jest.fn();
jest.mock('../src/utils/logger', () => ({ logger: { warn: (...args: unknown[]) => mockWarn(...args) } }));

const { validateBody } = require('../src/middleware/validateRequest') as typeof import('../src/middleware/validateRequest');

const run = (schema: z.ZodObject, body: unknown) => {
  const req: any = { body, method: 'POST', baseUrl: '/api/things', route: { path: '/' } };
  const res: any = { statusCode: 200 };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((payload: unknown) => { res.body = payload; return res; });
  const next = jest.fn();
  validateBody(schema)(req, res, next);
  return { req, res, next };
};

describe('validateBody', () => {
  const schema = z.object({ name: z.string().max(5).nullish(), amount: z.number().nullish() });

  beforeEach(() => mockWarn.mockClear());

  it('passes on only the allowed fields and logs the names of dropped ones', () => {
    const { req, next } = run(schema, { name: 'ok', amount: 2, role: 'admin', isEmailVerified: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'ok', amount: 2 });
    expect(mockWarn.mock.calls[0][0]).toBe('Dropped unknown body keys on POST /api/things/: role, isEmailVerified');
  });

  it('rejects values that break the schema', () => {
    const { res, next } = run(schema, { name: 'far too long' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error.details[0].field).toBe('name');
  });

  it('treats a missing body as empty', () => {
    const { req, next } = run(schema, undefined);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({});
  });
});

// Every write route in these routers runs a body schema before its handler.
const COVERED_ROUTERS = [
  'cheatDayRoutes', 'dietMealLogRoutes', 'fastingLogRoutes', 'sleepLogRoutes', 'waterIntakeRoutes',
  'medicationRoutes', 'medicationReminderRoutes', 'notificationRoutes', 'userFavoriteSleepItemRoutes',
  'userFavoriteExercisePlanRoutes', 'userFavoriteMeditationRoutes', 'userWaterGoalRoutes',
  'userExerciseProgressRoutes', 'userActiveDietPlanRoutes', 'userActiveExercisePlanRoutes',
  'userDietPlanRoutes', 'userExerciseRoutes', 'foodScanRoutes', 'inAppPurchaseRoutes', 'weightLogRoutes',
  'dietPlanRoutes', 'dietPlanDayRoutes', 'dietPlanMealRoutes', 'exerciseRoutes', 'exerciseDetailRoutes',
  'exercisePlanRoutes', 'exercisePlanScheduleRoutes', 'exercisePlanWeekRoutes', 'mealTypeRoutes',
  'meditationRoutes', 'meditationSessionRoutes', 'sleepSoundRoutes', 'sleepStoryRoutes', 'roleRoutes',
  'appSettingRoutes', 'blogRoutes',
];
// Write routes that take no body, or whose handler validates it with its own zod schema.
const NO_BODY_OR_OWN_SCHEMA = /\b(recordIntake|toggleMedicationReminder|markAllNotificationsRead|markNotificationRead|pause\w+|resume\w+|end\w+|saveDietPlanSchedule|saveExercisePlanSchedule)\b/;

describe('body schema coverage', () => {
  it.each(COVERED_ROUTERS)('%s validates the body of every write route', (name) => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes', `${name}.ts`), 'utf8');
    const writes = source.split('\n').filter((line) => /\.(post|put|patch)\(/.test(line) && !NO_BODY_OR_OWN_SCHEMA.test(line));
    expect(writes.length).toBeGreaterThan(0);
    for (const line of writes) expect(line).toContain('validateBody(');
  });
});
