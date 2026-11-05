import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';

const prisma = new PrismaClient();

// Column limits from schema.prisma, checked here so a long value is a 400, not a database error.
const mealSchema = z.object({
  id: z.string().trim().min(1).optional(),
  mealTypeId: z.string().trim().min(1, 'Every meal needs a meal type'),
  name: z.string().trim().min(1, 'Every meal needs a name').max(100, 'Meal names must be 100 characters or fewer'),
  calories: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  portionSize: z.string().trim().max(150, 'Portion size must be 150 characters or fewer').optional().nullable(),
  // Grams per serving.
  protein: z.coerce.number().min(0).max(1000).optional().nullable(),
  carbs: z.coerce.number().min(0).max(1000).optional().nullable(),
  fats: z.coerce.number().min(0).max(1000).optional().nullable(),
  image: z.string().trim().max(2000).optional().nullable(),
  recipe: z.string().max(20000).optional().nullable(),
});

const scheduleSchema = z.object({
  days: z.array(z.object({
    dayNumber: z.coerce.number().int().min(1).max(366),
    notes: z.string().max(2000).optional().nullable(),
    meals: z.array(mealSchema).max(20, 'A day can have at most 20 meals'),
  })).max(366),
}).superRefine((value, ctx) => {
  const seen = new Set<number>();
  for (const day of value.days) {
    if (seen.has(day.dayNumber)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Day ${day.dayNumber} appears twice` });
    seen.add(day.dayNumber);
  }
});

class ScheduleConflict extends Error {}

// GET /api/diet-plans/:id/schedule - every day of the plan with its meals, in day order
export const getDietPlanSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await prisma.dietPlan.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!plan) {
      res.status(404).json({ success: false, message: 'Diet plan not found' });
      return;
    }
    const days = await prisma.dietPlanDay.findMany({
      where: { dietId: plan.id },
      orderBy: { dayNumber: 'asc' },
      include: { dietPlanMeals: { include: { mealType: true }, orderBy: { id: 'asc' } } },
    });
    res.status(200).json({ success: true, data: days });
  } catch (error) {
    console.error('Error fetching diet plan schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to load the diet plan schedule' });
  }
};

/**
 * PUT /api/diet-plans/:id/schedule { days: [{ dayNumber, notes?, meals: [{ id?, mealTypeId, name, ... }] }] }
 * Makes the plan's days and meals match the body. Meals sent with an id are updated in place, so
 * users' meal logs stay attached; meals left out are removed unless someone has logged them.
 */
export const saveDietPlanSchedule = async (req: Request, res: Response): Promise<void> => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid schedule' });
    return;
  }
  const { days } = parsed.data;
  const dietId = req.params.id;

  try {
    const plan = await prisma.dietPlan.findUnique({ where: { id: dietId }, select: { id: true } });
    if (!plan) {
      res.status(404).json({ success: false, message: 'Diet plan not found' });
      return;
    }

    const mealTypeIds = [...new Set(days.flatMap(day => day.meals.map(meal => meal.mealTypeId)))];
    const knownTypes = await prisma.mealType.findMany({ where: { id: { in: mealTypeIds } }, select: { id: true } });
    if (knownTypes.length !== mealTypeIds.length) {
      res.status(400).json({ success: false, message: 'One of the meal types no longer exists. Reload the page and try again.' });
      return;
    }

    await prisma.$transaction(async tx => {
      const existingDays = await tx.dietPlanDay.findMany({
        where: { dietId },
        include: { dietPlanMeals: { select: { id: true, name: true, _count: { select: { dietMealLogs: true } } } } },
      });
      const existingMeals = new Map(existingDays.flatMap(day => day.dietPlanMeals.map(meal => [meal.id, { ...meal, dayNumber: day.dayNumber }] as const)));

      const keptMealIds = new Set(days.flatMap(day => day.meals.map(meal => meal.id).filter((id): id is string => !!id)));
      for (const id of keptMealIds) {
        if (!existingMeals.has(id)) throw new ScheduleConflict('A meal in this plan was changed elsewhere. Reload the page and try again.');
      }
      const removedMeals = [...existingMeals.values()].filter(meal => !keptMealIds.has(meal.id));
      const logged = removedMeals.find(meal => meal._count.dietMealLogs > 0);
      if (logged) {
        throw new ScheduleConflict(`"${logged.name}" on day ${logged.dayNumber} has been logged by users, so it can't be removed. Edit it instead.`);
      }
      if (removedMeals.length) await tx.dietPlanMeal.deleteMany({ where: { id: { in: removedMeals.map(meal => meal.id) } } });

      const wantedDays = new Set(days.map(day => day.dayNumber));
      const removedDays = existingDays.filter(day => !wantedDays.has(day.dayNumber));
      if (removedDays.length) await tx.dietPlanDay.deleteMany({ where: { id: { in: removedDays.map(day => day.id) } } });

      for (const day of days) {
        const existing = existingDays.find(d => d.dayNumber === day.dayNumber);
        const dayRow = existing
          ? await tx.dietPlanDay.update({ where: { id: existing.id }, data: { notes: day.notes ?? null } })
          : await tx.dietPlanDay.create({ data: { dietId, dayNumber: day.dayNumber, notes: day.notes ?? null } });

        for (const meal of day.meals) {
          const data = {
            dayId: dayRow.id,
            mealTypeId: meal.mealTypeId,
            name: meal.name,
            calories: meal.calories ?? null,
            portionSize: meal.portionSize || null,
            protein: meal.protein ?? null,
            carbs: meal.carbs ?? null,
            fats: meal.fats ?? null,
            image: meal.image || null,
            recipe: meal.recipe || null,
          };
          if (meal.id) await tx.dietPlanMeal.update({ where: { id: meal.id }, data });
          else await tx.dietPlanMeal.create({ data });
        }
      }
    }, { timeout: 30_000 });

    const saved = await prisma.dietPlanDay.findMany({
      where: { dietId },
      orderBy: { dayNumber: 'asc' },
      include: { dietPlanMeals: { include: { mealType: true }, orderBy: { id: 'asc' } } },
    });
    res.status(200).json({ success: true, data: saved, message: 'Diet plan schedule saved' });
  } catch (error) {
    if (error instanceof ScheduleConflict) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error('Error saving diet plan schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to save the diet plan schedule' });
  }
};
