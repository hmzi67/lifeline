import { prisma } from '../config/database.js';

/** Days in a row the whole diet plan must be followed to earn a cheat day. */
export const CHEAT_DAY_STREAK = 7;
const DAY_MS = 86400000;

const dayStart = (key: string) => new Date(key);
const keyOf = (date: Date) => date.toISOString().slice(0, 10);

export type CheatDayEligibility = {
  eligible: boolean;
  streakDays: number;
  required: number;
  hasActivePlan: boolean;
};

/**
 * Eligible once every meal of the active diet plan was logged on each of the
 * CHEAT_DAY_STREAK days before `today` (YYYY-MM-DD, the user's local day).
 */
export const cheatDayEligibility = async (userId: string, today: string): Promise<CheatDayEligibility> => {
  const plan = await prisma.userActiveDietPlan.findFirst({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    include: { diet: { include: { dietPlanDays: { include: { _count: { select: { dietPlanMeals: true } } } } } } },
  });
  if (!plan) return { eligible: false, streakDays: 0, required: CHEAT_DAY_STREAK, hasActivePlan: false };

  const todayStart = dayStart(today);
  const windowStart = new Date(todayStart.getTime() - CHEAT_DAY_STREAK * DAY_MS);
  const logs = await prisma.dietMealLog.groupBy({
    by: ['date'],
    where: { userId, activePlanId: plan.id, date: { gte: windowStart, lt: todayStart } },
    _count: { _all: true },
  });
  const loggedByDay = new Map(logs.map((row) => [keyOf(row.date), row._count._all]));
  const mealsByDayNumber = new Map(plan.diet.dietPlanDays.map((day) => [day.dayNumber, day._count.dietPlanMeals]));
  const planStart = dayStart(keyOf(plan.startedAt));

  let streakDays = 0;
  for (let offset = 1; offset <= CHEAT_DAY_STREAK; offset += 1) {
    const day = new Date(todayStart.getTime() - offset * DAY_MS);
    const dayNumber = Math.floor((day.getTime() - planStart.getTime()) / DAY_MS) + 1;
    if (dayNumber < 1) break; // before the plan started
    const planned = mealsByDayNumber.get(dayNumber) ?? 0;
    if (planned === 0 || (loggedByDay.get(keyOf(day)) ?? 0) < planned) break;
    streakDays += 1;
  }

  return { eligible: streakDays >= CHEAT_DAY_STREAK, streakDays, required: CHEAT_DAY_STREAK, hasActivePlan: true };
};
