import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';

const prisma = new PrismaClient();

// The app orders a week's workouts by these names (case-insensitive).
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const rowSchema = z.object({
  id: z.string().trim().min(1).optional(),
  exerciseId: z.string().trim().min(1, 'Every row needs an exercise'),
  sets: z.coerce.number().int().min(0).max(100).optional().nullable(),
  reps: z.string().trim().max(50, 'Reps must be 50 characters or fewer').optional().nullable(),
  duration: z.string().trim().max(50, 'Duration must be 50 characters or fewer').optional().nullable(),
});

const scheduleSchema = z.object({
  weeks: z.array(z.object({
    weekNumber: z.coerce.number().int().min(1).max(104),
    days: z.array(z.object({
      dayOfWeek: z.enum(WEEKDAYS),
      exercises: z.array(rowSchema).max(50, 'A day can have at most 50 exercises'),
    })).max(7),
  })).max(104),
}).superRefine((value, ctx) => {
  const weeks = new Set<number>();
  for (const week of value.weeks) {
    if (weeks.has(week.weekNumber)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Week ${week.weekNumber} appears twice` });
    weeks.add(week.weekNumber);
    const days = new Set<string>();
    for (const day of week.days) {
      if (days.has(day.dayOfWeek)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${day.dayOfWeek} appears twice in week ${week.weekNumber}` });
      days.add(day.dayOfWeek);
    }
  }
});

class ScheduleConflict extends Error {}

/**
 * PUT /api/exercise-plans/:id/schedule { weeks: [{ weekNumber, days: [{ dayOfWeek, exercises: [{ id?, exerciseId, sets?, reps?, duration? }] }] }] }
 * Makes the plan's weeks and workouts match the body. Rows sent with an id are updated in place so
 * users' progress stays attached; rows left out are removed unless someone has progress on them.
 */
export const saveExercisePlanSchedule = async (req: Request, res: Response): Promise<void> => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid schedule' });
    return;
  }
  const { weeks } = parsed.data;
  const planId = req.params.id;

  try {
    const plan = await prisma.exercisePlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) {
      res.status(404).json({ success: false, message: 'Exercise plan not found' });
      return;
    }

    const exerciseIds = [...new Set(weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.exerciseId))))];
    const known = await prisma.exercise.findMany({ where: { id: { in: exerciseIds } }, select: { id: true } });
    if (known.length !== exerciseIds.length) {
      res.status(400).json({ success: false, message: 'One of the exercises no longer exists. Reload the page and try again.' });
      return;
    }

    await prisma.$transaction(async tx => {
      const existingWeeks = await tx.exercisePlanWeek.findMany({
        where: { planId },
        include: {
          exercisePlanSchedule: {
            select: { id: true, dayOfWeek: true, exercise: { select: { name: true } }, _count: { select: { userExerciseProgress: true } } },
          },
        },
      });
      const existingRows = new Map(existingWeeks.flatMap(week => week.exercisePlanSchedule.map(row => [row.id, { ...row, weekNumber: week.weekNumber }] as const)));

      const keptIds = new Set(weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.id).filter((id): id is string => !!id))));
      for (const id of keptIds) {
        if (!existingRows.has(id)) throw new ScheduleConflict('An exercise in this plan was changed elsewhere. Reload the page and try again.');
      }
      const removed = [...existingRows.values()].filter(row => !keptIds.has(row.id));
      const used = removed.find(row => row._count.userExerciseProgress > 0);
      if (used) {
        throw new ScheduleConflict(`"${used.exercise.name}" on week ${used.weekNumber} ${used.dayOfWeek} has user progress, so it can't be removed. Edit it instead.`);
      }
      if (removed.length) await tx.exercisePlanSchedule.deleteMany({ where: { id: { in: removed.map(row => row.id) } } });

      const wantedWeeks = new Set(weeks.map(w => w.weekNumber));
      const removedWeeks = existingWeeks.filter(w => !wantedWeeks.has(w.weekNumber));
      if (removedWeeks.length) await tx.exercisePlanWeek.deleteMany({ where: { id: { in: removedWeeks.map(w => w.id) } } });

      for (const week of weeks) {
        const existing = existingWeeks.find(w => w.weekNumber === week.weekNumber);
        const weekRow = existing ?? await tx.exercisePlanWeek.create({ data: { planId, weekNumber: week.weekNumber } });

        for (const day of week.days) {
          for (const [index, row] of day.exercises.entries()) {
            const data = {
              weekId: weekRow.id,
              exerciseId: row.exerciseId,
              dayOfWeek: day.dayOfWeek,
              sets: row.sets ?? null,
              reps: row.reps || null,
              duration: row.duration || null,
              orderIndex: index + 1,
            };
            if (row.id) await tx.exercisePlanSchedule.update({ where: { id: row.id }, data });
            else await tx.exercisePlanSchedule.create({ data });
          }
        }
      }
    }, { timeout: 30_000 });

    const saved = await prisma.exercisePlanWeek.findMany({
      where: { planId },
      orderBy: { weekNumber: 'asc' },
      include: { exercisePlanSchedule: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
    });
    res.status(200).json({ success: true, data: saved, message: 'Exercise plan schedule saved' });
  } catch (error) {
    if (error instanceof ScheduleConflict) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error('Error saving exercise plan schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to save the exercise plan schedule' });
  }
};
