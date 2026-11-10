import { z } from 'zod';
import { dateText, flag, id, jsonObject, numeric, text, timeText, url } from './fields.js';

// Bodies the app and web client send for a user's own tracking data.

export const cheatDayBody = z.object({
  userId: id,
  foodName: text(200),
  image: url,
  mealType: text(50),
  portionSize: text(100),
  calories: numeric,
  protein: numeric,
  carbs: numeric,
  fat: numeric,
});

export const dietMealLogBody = z.object({
  activePlanId: id,
  mealId: id,
  mealName: text(200),
  mealType: text(50),
  calories: numeric,
  date: dateText,
});

export const fastingLogBody = z.object({
  date: dateText,
  timeStart: timeText,
  timeEnd: timeText,
  durationMinutes: numeric,
  startedAt: dateText,
  endedAt: dateText,
  targetMinutes: numeric,
});

export const sleepLogBody = z.object({
  date: dateText,
  timeStart: timeText,
  timeEnd: timeText,
  durationMinutes: numeric,
  sleepQuality: z.union([z.number(), z.string().max(50)]).nullish(),
});

export const waterIntakeBody = z.object({
  userId: id,
  date: dateText,
  timeStart: timeText,
  timeEnd: timeText,
  amount: numeric,
  unit: text(20),
  drinkType: text(50),
  notes: text(1000),
});

export const medicationBody = z.object({
  name: text(200),
  quantity: numeric,
  dose: text(100),
  frequency: text(100),
  reminderTime: dateText,
  image: url,
  icon: text(100),
  appearanceColor: text(50),
  appearanceIcon: text(100),
});

export const medicationReminderBody = z.object({
  medicationId: id,
  userId: id,
  reminderTime: dateText,
  repeatType: text(30),
  enabled: flag,
});

export const myNotificationBody = z.object({
  title: text(200),
  body: text(2000),
  type: text(50),
  data: jsonObject,
});

export const adminNotificationBody = myNotificationBody.extend({ userId: id });

export const favoriteSleepItemBody = z.object({ type: text(20), itemId: id });
export const favoriteExercisePlanBody = z.object({ planId: id });
export const favoriteMeditationBody = z.object({ meditationId: id, sessionId: id });

export const waterGoalBody = z.object({ userId: id, goalAmount: numeric, unit: text(20) });

export const exerciseProgressBody = z.object({
  userId: id,
  exerciseScheduleId: id,
  exerciseId: id,
  progressPercent: numeric,
  note: text(1000),
  completed: flag,
  completedAt: dateText,
  elapsedSeconds: numeric,
});

export const startActiveDietPlanBody = z.object({ userId: id, dietId: id, currentDay: numeric, replaceActive: flag });
export const activeDietPlanDayBody = z.object({ currentDay: numeric });
export const startActiveExercisePlanBody = z.object({ userId: id, planId: id, currentWeek: numeric });
export const activeExercisePlanWeekBody = z.object({ currentWeek: numeric });

export const userDietPlanBody = z.object({ userId: id, dietId: id });
export const userExerciseBody = z.object({ userId: id, exerciseId: id });

export const foodScanBody = z.object({
  // Base64 of an image up to the scanner's own byte limit; the route's JSON limit caps it too.
  image_base64: z.string().max(30 * 1024 * 1024).nullish(),
  mime_type: text(50),
});

export const inAppPurchaseSyncBody = z.object({
  signedTransaction: z.string().max(20000).nullish(),
  signedTransactions: z.array(z.string().max(20000)).max(100).nullish(),
});

export const weightLogBody = z.object({ weight: numeric, date: dateText });

// Sent by Apple's App Store Server Notifications V2.
export const appStoreNotificationBody = z.object({ signedPayload: z.string().max(200000).nullish() });
