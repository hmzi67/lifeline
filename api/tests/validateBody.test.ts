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

// Every write route in the API runs a body schema before its handler, unless it is listed
// below: handlers that parse the body with their own zod schema, and routes with no body.
const OWN_SCHEMA = [
  'login', 'signup', 'submitChallenge', 'recordChallengeApplePurchase', 'createChallenge', 'updateChallenge',
  'setChallengeContent', 'startChallengeCheckout', 'confirmChallengeCheckout', 'reviewChallenge',
  'reportChallenge', 'resolveChallengeReports', 'addExerciseToChallenge', 'addMultipleExercisesToChallenge',
  'validateCoupon', 'createCoupon', 'updateCoupon', 'validateReferralCode', 'createReferralCode',
  'updateReferralCode', 'createPricingPlan', 'updatePricingPlan', 'createSubscriptionPayment',
  'updateSubscriptionPayment', 'createSubscription', 'confirmSubscriptionPayment', 'createOrUpdateQuestionnaire',
  'updateOnboardingProgress', 'createFoodLog', 'createMeditationLog', 'recordIntake', 'saveDietPlanSchedule',
  'saveExercisePlanSchedule',
  // questionnaireController: each per-field update parses the body with its field schema.
  'updateHeightData', 'updateWeightData', 'updateGender', 'updateGoal', 'updateDietType', 'updateIsDiabetic',
  'updateAllergenFood', 'updateFitnessLevel', 'updateTypicalDayType', 'updatePhysicalLimitations',
  'updateBodyFocusArea', 'updateDateOfBirth', 'updateHeight', 'updateHeightUnit', 'updateWeight',
  'updateWeightUnit', 'updateGoalWeight', 'updateMotivationFor',
];
const NO_BODY = [
  'toggleMedicationReminder', 'markAllNotificationsRead', 'markNotificationRead', 'joinChallenge',
  'completeChallenge', 'startFreeWeekAccess',
  'pauseActiveDietPlan', 'resumeActiveDietPlan', 'endActiveDietPlan', 'pauseActiveExercisePlan', 'resumeActiveExercisePlan',
];
const exempt = new RegExp(`\\b(${[...OWN_SCHEMA, ...NO_BODY].join('|')})\\b`);
// Inline handlers: the admin broadcast parses broadcastSchema; uploads take a multipart file, not fields.
const INLINE_EXEMPT: Record<string, string[]> = { adminNotificationRoutes: ["'/broadcast'"], uploadRoutes: ["router.post('/'"] };

const routesDir = path.join(__dirname, '../src/routes');
const routerFiles = fs.readdirSync(routesDir).filter((file) => file.endsWith('.ts'));

describe('body schema coverage', () => {
  it.each(routerFiles)('%s validates the body of every write route', (file) => {
    const name = file.replace(/\.ts$/, '');
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const writes = source
      .split('\n')
      .filter((line) => /\.(post|put|patch)\(/.test(line) && !exempt.test(line))
      .filter((line) => !(INLINE_EXEMPT[name] ?? []).some((marker) => line.includes(marker)));
    for (const line of writes) expect(line).toContain('validateBody(');
  });
});
