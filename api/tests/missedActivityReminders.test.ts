export {};

const mockPrisma: any = {
  appSetting: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
  waterIntakeLog: { aggregate: jest.fn() },
  userWaterGoal: { findFirst: jest.fn() },
  dietMealLog: { findFirst: jest.fn() },
  foodLog: { findFirst: jest.fn() },
  userActiveDietPlan: { findFirst: jest.fn() },
  userActiveExercisePlan: { findFirst: jest.fn() },
  userExerciseProgress: { findFirst: jest.fn() },
  sleepLog: { findFirst: jest.fn() },
  userMeditationLog: { findFirst: jest.fn() },
  userDailyRoutine: { findFirst: jest.fn() },
  weightLog: { findFirst: jest.fn() },
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma), Prisma: {} }));

const mockNotifyUser = jest.fn();
jest.mock('../src/services/notificationService', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
}));

const {
  localDateAndHour,
  localDayBounds,
  missedActivities,
  reminderFor,
  sendMissedActivityReminders,
} = require('../src/services/missedActivityReminders') as typeof import('../src/services/missedActivityReminders');

const nothingMissed = {
  waterMl: 2500,
  waterGoalMl: 2500,
  mealsLogged: true,
  dietPlanActive: false,
  exercisePlanId: null,
  workoutScheduled: false,
  workoutDone: false,
  sleepLogged: true,
  meditated: true,
  weighed: true,
};

describe('local time', () => {
  it('reads the local day and hour in the user timezone', () => {
    // 16:00 UTC is 21:00 in Karachi (UTC+5), still 11:00 in New York (UTC-5 in November).
    const instant = new Date('2026-11-02T16:00:00Z');
    expect(localDateAndHour(instant, 'Asia/Karachi')).toEqual({ date: '2026-11-02', hour: 21 });
    expect(localDateAndHour(instant, 'America/New_York')).toEqual({ date: '2026-11-02', hour: 11 });
  });

  it('bounds a local day in UTC', () => {
    expect(localDayBounds('2026-11-02', 'Asia/Karachi')).toEqual({
      start: new Date('2026-11-01T19:00:00Z'),
      end: new Date('2026-11-02T19:00:00Z'),
    });
  });
});

describe('missedActivities', () => {
  it('lists nothing when everything is logged', () => {
    expect(missedActivities(nothingMissed)).toEqual([]);
  });

  it('lists each missing activity; a rest day has no workout to miss', () => {
    expect(missedActivities({ ...nothingMissed, waterMl: 1000, sleepLogged: false, weighed: false })).toEqual(['water', 'sleep', 'weight']);
    expect(missedActivities({ ...nothingMissed, workoutScheduled: true })).toEqual(['exercise']);
  });
});

describe('reminderFor', () => {
  it('names every missed activity and opens the first on that day', () => {
    const reminder = reminderFor(['water', 'meals', 'sleep'], '2026-11-02', { dietPlanActive: true, exercisePlanId: null });
    expect(reminder.body).toBe("You haven't logged your water, meals and sleep yet. Tap to add them.");
    expect(reminder.data).toEqual({ screen: '/waterIntake?date=2026-11-02', date: '2026-11-02', missed: 'water,meals,sleep' });
  });

  it('opens the active plans for meals and workouts', () => {
    expect(reminderFor(['meals'], '2026-11-02', { dietPlanActive: true, exercisePlanId: null }).data.screen).toBe('/(main)/ActivePlan?date=2026-11-02');
    expect(reminderFor(['exercise'], '2026-11-02', { dietPlanActive: false, exercisePlanId: 'plan1' }).data.screen).toBe('/(main)/ViewPlan?planId=plan1&date=2026-11-02');
  });
});

describe('sendMissedActivityReminders', () => {
  const at9pmKarachi = new Date('2026-11-02T16:10:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.waterIntakeLog.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    mockPrisma.userWaterGoal.findFirst.mockResolvedValue({ goalAmount: 2000 });
    mockPrisma.appSetting.findFirst.mockResolvedValue(null);
    for (const model of ['dietMealLog', 'foodLog', 'userActiveDietPlan', 'userExerciseProgress', 'userMeditationLog', 'userDailyRoutine']) {
      mockPrisma[model].findFirst.mockResolvedValue(null);
    }
    mockPrisma.userActiveExercisePlan.findFirst.mockResolvedValue(null);
    mockPrisma.sleepLog.findFirst.mockResolvedValue({ id: 's' });
    mockPrisma.weightLog.findFirst.mockResolvedValue({ id: 'w' });
  });

  const settings = (scope: string, values: Record<string, string>) =>
    Object.entries(values).map(([key, value]) => ({ scope, key, value }));

  it('reminds users at 9 PM their time, once a day', async () => {
    mockPrisma.appSetting.findMany.mockResolvedValue([
      ...settings('user:due', { push_token: 't1', timezone: 'Asia/Karachi' }),
      ...settings('user:already', { push_token: 't2', timezone: 'Asia/Karachi', missed_activity_reminder_date: '2026-11-02' }),
      ...settings('user:morning', { push_token: 't3', timezone: 'America/New_York' }),
      ...settings('user:off', { push_token: 't4', timezone: 'Asia/Karachi', notifications_enabled: 'false' }),
      ...settings('user:nozone', { push_token: 't5' }),
    ]);

    await expect(sendMissedActivityReminders(at9pmKarachi)).resolves.toBe(1);

    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appSetting.upsert.mock.calls[0][0].create).toMatchObject({ key: 'missed_activity_reminder_date', value: '2026-11-02', scope: 'user:due' });
    expect(mockNotifyUser).toHaveBeenCalledWith('due', expect.objectContaining({
      body: "You haven't logged your water, meals and meditation yet. Tap to add them.",
      data: expect.objectContaining({ screen: '/waterIntake?date=2026-11-02' }),
    }));
  });

  it('marks the day without a push when nothing was missed', async () => {
    mockPrisma.appSetting.findMany.mockResolvedValue(settings('user:done', { push_token: 't', timezone: 'Asia/Karachi' }));
    mockPrisma.waterIntakeLog.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });
    mockPrisma.foodLog.findFirst.mockResolvedValue({ id: 'f' });
    mockPrisma.userMeditationLog.findFirst.mockResolvedValue({ id: 'm' });

    await expect(sendMissedActivityReminders(at9pmKarachi)).resolves.toBe(0);
    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });
});
