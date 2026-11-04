import { prisma } from '../config/database.js';
import { notifyUser } from './notificationService.js';

/**
 * Evening nudge: at 9 PM in each user's own timezone, one push listing what they
 * haven't logged that day (water goal, meals, workout, sleep, meditation, weight).
 * Tapping it opens the first missed activity on that day, where it can be added.
 *
 * The app stores the device timezone in app_settings next to the push token, so
 * users who never registered a device are skipped.
 */
export const REMINDER_HOUR = 21;
const TIMEZONE_KEY = 'timezone';
/** The local date of the last reminder, so each user gets at most one a day. */
const SENT_KEY = 'missed_activity_reminder_date';
const DEFAULT_WATER_GOAL_ML = 2500;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export type Activity = 'water' | 'meals' | 'exercise' | 'sleep' | 'meditation' | 'weight';

/** In the order they are listed. */
export const ACTIVITY_LABELS: Record<Activity, string> = {
  water: 'water',
  meals: 'meals',
  exercise: 'workout',
  sleep: 'sleep',
  meditation: 'meditation',
  weight: 'weight',
};

/** The app screen where an activity is added for `date` (each reads `?date=`). */
export const screenFor = (activity: Activity, date: string, day: Pick<DayActivity, 'dietPlanActive' | 'exercisePlanId'>): string => {
  switch (activity) {
    case 'water': return `/waterIntake?date=${date}`;
    case 'meals': return day.dietPlanActive ? `/(main)/ActivePlan?date=${date}` : '/(tabs)/diet';
    case 'exercise': return `/(main)/ViewPlan?planId=${encodeURIComponent(day.exercisePlanId ?? '')}&date=${date}`;
    case 'sleep': return `/(main)/Analysis?date=${date}`;
    case 'meditation': return `/(main)/meditation?date=${date}`;
    case 'weight': return `/(tabs)/Progress?date=${date}`;
  }
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** Wall-clock parts of `instant` in `timeZone`. */
const zonedParts = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
};

/** The local calendar day (YYYY-MM-DD) and hour of `instant` in `timeZone`. */
export const localDateAndHour = (instant: Date, timeZone: string): { date: string; hour: number } => {
  const { year, month, day, hour } = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${year}-${pad(month)}-${pad(day)}`, hour };
};

/** How far `timeZone` is ahead of UTC at `instant`, in ms. */
const offsetMs = (instant: Date, timeZone: string): number => {
  const p = zonedParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000;
};

/**
 * The UTC instants where a local calendar day starts and ends, for timestamp
 * columns (meditation and workout completions). Date-only columns hold the
 * local day as UTC midnight and are matched with `dateColumnRange` instead.
 */
export const localDayBounds = (date: string, timeZone: string): { start: Date; end: Date } => {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  const start = new Date(midnightUtc - offsetMs(new Date(midnightUtc), timeZone));
  const nextMidnightUtc = midnightUtc + DAY_MS;
  const end = new Date(nextMidnightUtc - offsetMs(new Date(nextMidnightUtc), timeZone));
  return { start, end };
};

const dateColumnRange = (date: string) => {
  const start = new Date(`${date}T00:00:00Z`);
  return { gte: start, lt: new Date(start.getTime() + DAY_MS) };
};

export interface DayActivity {
  waterMl: number;
  waterGoalMl: number;
  mealsLogged: boolean;
  /** Meals are ticked off on the diet plan when there is one. */
  dietPlanActive: boolean;
  exercisePlanId: string | null;
  /** False without an active plan or on a rest day: nothing to miss. */
  workoutScheduled: boolean;
  workoutDone: boolean;
  sleepLogged: boolean;
  meditated: boolean;
  weighed: boolean;
}

export const missedActivities = (day: DayActivity): Activity[] => {
  const missed: Activity[] = [];
  if (day.waterMl < day.waterGoalMl) missed.push('water');
  if (!day.mealsLogged) missed.push('meals');
  if (day.workoutScheduled && !day.workoutDone) missed.push('exercise');
  if (!day.sleepLogged) missed.push('sleep');
  if (!day.meditated) missed.push('meditation');
  if (!day.weighed) missed.push('weight');
  return missed;
};

/** "water", "water and sleep", "water, sleep and weight". */
const joinLabels = (labels: string[]): string =>
  labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/** One push for the day; tapping it opens the first missed activity. */
export const reminderFor = (missed: Activity[], date: string, day: Pick<DayActivity, 'dietPlanActive' | 'exercisePlanId'>) => ({
  title: "Don't forget today's activities",
  body: `You haven't logged your ${joinLabels(missed.map(activity => ACTIVITY_LABELS[activity]))} yet. Tap to add them.`,
  type: 'reminder',
  data: { screen: screenFor(missed[0], date, day), date, missed: missed.join(',') },
});

const loadDayActivity = async (userId: string, date: string, timeZone: string): Promise<DayActivity> => {
  const dateRange = dateColumnRange(date);
  const { start, end } = localDayBounds(date, timeZone);

  const [water, waterGoal, defaultGoal, mealLog, foodLog, dietPlan, plan, workout, sleep, meditationLog, routine, weight] = await Promise.all([
    prisma.waterIntakeLog.aggregate({ where: { userId, date: dateRange }, _sum: { amount: true } }),
    prisma.userWaterGoal.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { goalAmount: true } }),
    prisma.appSetting.findFirst({ where: { key: 'daily_water_goal_ml', scope: 'user' }, select: { value: true } }),
    prisma.dietMealLog.findFirst({ where: { userId, date: dateRange }, select: { id: true } }),
    prisma.foodLog.findFirst({ where: { userId, date: dateRange }, select: { id: true } }),
    prisma.userActiveDietPlan.findFirst({ where: { userId }, select: { id: true } }),
    prisma.userActiveExercisePlan.findFirst({
      where: { userId, pausedAt: null },
      orderBy: { startedAt: 'desc' },
      select: {
        planId: true,
        currentWeek: true,
        plan: { select: { exercisePlanWeeks: { select: { weekNumber: true, exercisePlanSchedule: { select: { dayOfWeek: true } } } } } },
      },
    }),
    prisma.userExerciseProgress.findFirst({ where: { userId, completed: true, completedAt: { gte: start, lt: end } }, select: { id: true } }),
    prisma.sleepLog.findFirst({ where: { userId, date: dateRange }, select: { id: true } }),
    prisma.userMeditationLog.findFirst({ where: { userId, completedAt: { gte: start, lt: end } }, select: { id: true } }),
    prisma.userDailyRoutine.findFirst({ where: { userId, routinesDate: dateRange, meditationId: { not: null } }, select: { id: true } }),
    prisma.weightLog.findFirst({ where: { userId, date: dateRange }, select: { id: true } }),
  ]);

  // Same rule as Home's "today's workout": the current week's schedule for this weekday.
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const week = plan?.plan.exercisePlanWeeks.find(w => w.weekNumber === plan.currentWeek);
  const workoutScheduled = !!week?.exercisePlanSchedule.some(item => item.dayOfWeek.toLowerCase() === weekday);

  const parsedDefault = Number(defaultGoal?.value);
  return {
    waterMl: water._sum.amount ?? 0,
    waterGoalMl: waterGoal?.goalAmount || (parsedDefault > 0 ? parsedDefault : DEFAULT_WATER_GOAL_ML),
    mealsLogged: !!mealLog || !!foodLog,
    dietPlanActive: !!dietPlan,
    exercisePlanId: plan?.planId ?? null,
    workoutScheduled,
    workoutDone: !!workout,
    sleepLogged: !!sleep,
    meditated: !!meditationLog || !!routine,
    weighed: !!weight,
  };
};

const markSent = (userId: string, date: string) => {
  const scope = `user:${userId}`;
  return prisma.appSetting.upsert({
    where: { id: `${scope}:${SENT_KEY}` },
    update: { value: date },
    create: { id: `${scope}:${SENT_KEY}`, key: SENT_KEY, value: date, scope },
  });
};

/** Sends today's reminder to every user whose local time is now in the 9 PM hour. */
export const sendMissedActivityReminders = async (now: Date = new Date()): Promise<number> => {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ['push_token', 'notifications_enabled', TIMEZONE_KEY, SENT_KEY] }, scope: { startsWith: 'user:' } },
    select: { scope: true, key: true, value: true },
  });

  const byUser = new Map<string, Map<string, string>>();
  for (const setting of settings) {
    if (!setting.scope || !setting.key) continue;
    const values = byUser.get(setting.scope) ?? new Map<string, string>();
    values.set(setting.key, setting.value ?? '');
    byUser.set(setting.scope, values);
  }

  let sent = 0;
  for (const [scope, values] of byUser) {
    const timeZone = values.get(TIMEZONE_KEY);
    if (!values.get('push_token') || values.get('notifications_enabled') === 'false') continue;
    if (!timeZone || !isValidTimeZone(timeZone)) continue;

    const local = localDateAndHour(now, timeZone);
    if (local.hour !== REMINDER_HOUR || values.get(SENT_KEY) === local.date) continue;

    const userId = scope.slice('user:'.length);
    try {
      // Marked first: a failure must not turn into a reminder every few minutes.
      await markSent(userId, local.date);
      const day = await loadDayActivity(userId, local.date, timeZone);
      const missed = missedActivities(day);
      if (missed.length) {
        await notifyUser(userId, reminderFor(missed, local.date, day));
        sent++;
      }
    } catch (error) {
      console.error('Missed activity reminder failed:', error);
    }
  }
  return sent;
};
