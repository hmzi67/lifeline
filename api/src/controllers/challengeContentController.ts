import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';

const prisma = new PrismaClient();

const contentSchema = z.object({
  exerciseIds: z.array(z.string().trim().min(1)).max(100).optional(),
  dietIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

/**
 * PUT /api/challenges/:id/content { exerciseIds?, dietIds? }
 * Sets which exercises (shown on the app's Join Challenge screen) and diet plans belong to a
 * challenge. A list that is sent replaces the current one; a list left out is unchanged.
 */
export const setChallengeContent = async (req: Request, res: Response): Promise<void> => {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid content' });
    return;
  }
  const challengeId = req.params.id;
  const exerciseIds = parsed.data.exerciseIds ? [...new Set(parsed.data.exerciseIds)] : undefined;
  const dietIds = parsed.data.dietIds ? [...new Set(parsed.data.dietIds)] : undefined;

  try {
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { id: true } });
    if (!challenge) {
      res.status(404).json({ success: false, message: 'Challenge not found' });
      return;
    }
    if (exerciseIds?.length) {
      const found = await prisma.exercise.count({ where: { id: { in: exerciseIds } } });
      if (found !== exerciseIds.length) {
        res.status(400).json({ success: false, message: 'One of the exercises no longer exists. Reload the page and try again.' });
        return;
      }
    }
    if (dietIds?.length) {
      const found = await prisma.dietPlan.count({ where: { id: { in: dietIds } } });
      if (found !== dietIds.length) {
        res.status(400).json({ success: false, message: 'One of the diet plans no longer exists. Reload the page and try again.' });
        return;
      }
    }

    await prisma.$transaction([
      ...(exerciseIds
        ? [
            prisma.challengeExercise.deleteMany({ where: { challengeId, exerciseId: { notIn: exerciseIds } } }),
            prisma.challengeExercise.createMany({ data: exerciseIds.map(exerciseId => ({ challengeId, exerciseId })), skipDuplicates: true }),
          ]
        : []),
      ...(dietIds
        ? [
            prisma.challengeDiet.deleteMany({ where: { challengeId, dietId: { notIn: dietIds } } }),
            prisma.challengeDiet.createMany({ data: dietIds.map(dietId => ({ challengeId, dietId })), skipDuplicates: true }),
          ]
        : []),
    ]);

    const saved = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        challengeExercises: { select: { exerciseId: true, exercise: { select: { id: true, name: true } } } },
        challengeDiets: { select: { dietId: true, diet: { select: { id: true, name: true } } } },
      },
    });
    res.status(200).json({ success: true, data: saved, message: 'Challenge content saved' });
  } catch (error) {
    console.error('Error saving challenge content:', error);
    res.status(500).json({ success: false, message: 'Failed to save the challenge exercises and diets' });
  }
};
