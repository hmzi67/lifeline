import { z } from 'zod';
import { flag, id, numeric, text, url } from './fields.js';

// Bodies the admin panel sends for catalog content (plans, exercises, meditations, sleep, blog).

export const dietPlanBody = z.object({
  name: text(200),
  calories: numeric,
  duration: numeric,
  description: text(5000),
  image: url,
  cuisineName: text(100),
  gender: text(20),
  goal: text(50),
});

export const dietPlanDayBody = z.object({ dietId: id, dayNumber: numeric, notes: text(2000) });

export const dietPlanMealBody = z.object({
  dayId: id,
  mealTypeId: id,
  name: text(200),
  calories: numeric,
  portionSize: text(100),
  image: url,
  recipe: text(10000),
});

export const exerciseBody = z.object({
  name: text(200),
  purpose: text(200),
  description: text(5000),
  image: url,
  duration: numeric,
  videoUrl: url,
  difficulty: text(50),
  caloriesBurnEstimate: numeric,
});

export const exerciseDetailBody = z.object({
  exerciseId: id,
  sets: numeric,
  reps: numeric,
  calories: numeric,
  timeRequired: numeric,
  mediaUrl: url,
  instructions: text(10000),
});

export const exercisePlanBody = z.object({
  name: text(200),
  description: text(5000),
  image: url,
  level: text(50),
  durationWeeks: numeric,
});

export const exercisePlanScheduleBody = z.object({
  weekId: id,
  exerciseId: id,
  dayOfWeek: z.union([z.number(), z.string().max(20)]).nullish(),
  sets: numeric,
  reps: numeric,
  duration: numeric,
  orderIndex: numeric,
  completed: flag,
});

export const exercisePlanWeekBody = z.object({ planId: id, weekNumber: numeric });

export const mealTypeBody = z.object({ name: text(100) });

export const meditationBody = z.object({
  name: text(200),
  type: text(50),
  soundUrl: url,
  durationMinutes: numeric,
  description: text(5000),
  image: url,
});

export const meditationSessionBody = z.object({
  meditationId: id,
  durationMinutes: numeric,
  image: url,
  soundUrl: url,
  difficulty: text(50),
});

export const sleepSoundBody = z.object({
  name: text(200),
  description: text(5000),
  image: url,
  soundUrl: url,
  category: text(100),
  duration: numeric,
  isActive: flag,
});

export const sleepStoryBody = z.object({
  title: text(200),
  author: text(200),
  description: text(5000),
  image: url,
  audioUrl: url,
  category: text(100),
  duration: numeric,
  isActive: flag,
});

export const roleBody = z.object({ name: text(50), description: text(500) });

// A setting's value is whatever the app stores under that key (text, number, flag or JSON).
const settingValue = z.unknown().refine((value) => JSON.stringify(value ?? null).length <= 100_000, 'Value is too large');
const appSetting = z.object({ key: text(200), value: settingValue, scope: text(50) });
export const appSettingBody = appSetting;
export const appSettingsBulkBody = z.object({ settings: z.array(appSetting).max(500).nullish() });

export const blogCategoryBody = z.object({ name: text(100), slug: text(150) });

export const blogBody = z.object({
  title: text(300),
  slug: text(300),
  // Rich-text HTML; the JSON body limit (1MB) is the outer bound.
  content: text(500_000),
  excerpt: text(2000),
  coverImage: url,
  status: text(20),
  categoryId: id,
});

export const blogCommentBody = z.object({ content: text(5000), parentId: id });
