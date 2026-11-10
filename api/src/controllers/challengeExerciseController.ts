import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError, handleError, sendResponse } from '../utils/responseHandler.js';

// ---- Validation Schemas ----
const challengeExerciseSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  exerciseId: z.string().min(1, 'Exercise ID is required'),
});

const multipleExercisesSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  exerciseIds: z.array(z.string().min(1, 'Exercise ID is required')),
});

// ---- Common Prisma Include ----
const challengeExerciseInclude = {
  include: {
    challenge: true,
    exercise: true,
  },
};

// ---- Helpers ----
const validateIds = (challengeId: string, exerciseId: string) => {
  try {
    return {
      challengeId: z.string().min(1).parse(challengeId),
      exerciseId: z.string().min(1).parse(exerciseId),
    };
  } catch {
    throw new AppError('Invalid ID format', 400);
  }
};

// ---- Controllers ----

// Get all challenge exercises
export const getAllChallengeExercises = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const challengeExercises = await prisma.challengeExercise.findMany({
      ...challengeExerciseInclude,
    });

    sendResponse(res, 200, challengeExercises, 'Challenge exercises retrieved successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// Get exercises by challenge
export const getExercisesByChallenge = async (
  req: Request<{ challengeId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { challengeId } = validateIds(req.params.challengeId, '00000000-0000-0000-0000-000000000000');

    const challengeExercises = await prisma.challengeExercise.findMany({
      where: { challengeId },
      ...challengeExerciseInclude,
    });

    sendResponse(res, 200, challengeExercises, 'Exercises for challenge retrieved successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// Get challenges by exercise
export const getChallengesByExercise = async (
  req: Request<{ exerciseId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { exerciseId } = validateIds('00000000-0000-0000-0000-000000000000', req.params.exerciseId);

    const challengeExercises = await prisma.challengeExercise.findMany({
      where: { exerciseId },
      ...challengeExerciseInclude,
    });

    sendResponse(res, 200, challengeExercises, 'Challenges for exercise retrieved successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// Add a single exercise to challenge
export const addExerciseToChallenge = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { challengeId, exerciseId } = challengeExerciseSchema.parse(req.body);

    const existingRelation = await prisma.challengeExercise.findFirst({
      where: { challengeId, exerciseId },
    });

    if (existingRelation) throw new AppError('Exercise is already added to this challenge', 409);

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError('Challenge not found', 404);

    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) throw new AppError('Exercise not found', 404);

    const challengeExercise = await prisma.challengeExercise.create({
      data: { challengeId, exerciseId },
      ...challengeExerciseInclude,
    });

    sendResponse(res, 201, challengeExercise, 'Exercise added to challenge successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// Remove exercise from challenge
export const removeExerciseFromChallenge = async (
  req: Request<{ challengeId: string; exerciseId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { challengeId, exerciseId } = validateIds(req.params.challengeId, req.params.exerciseId);

    const existingRelation = await prisma.challengeExercise.findFirst({ where: { challengeId, exerciseId } });
    if (!existingRelation) throw new AppError('Exercise is not associated with this challenge', 404);

    await prisma.challengeExercise.delete({
      where: { challengeId_exerciseId: { challengeId, exerciseId } },
    });

    sendResponse(res, 200, { challengeId, exerciseId }, 'Exercise removed from challenge successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// Add multiple exercises to challenge
export const addMultipleExercisesToChallenge = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { challengeId, exerciseIds } = multipleExercisesSchema.parse(req.body);

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError('Challenge not found', 404);

    const exercises = await prisma.exercise.findMany({ where: { id: { in: exerciseIds } } });
    if (exercises.length !== exerciseIds.length) {
      const foundIds = exercises.map((e) => e.id);
      const missingIds = exerciseIds.filter((id) => !foundIds.includes(id));
      throw new AppError(`Some exercises not found: ${missingIds.join(', ')}`, 404);
    }

    const existingRelations = await prisma.challengeExercise.findMany({
      where: { challengeId, exerciseId: { in: exerciseIds } },
      select: { exerciseId: true },
    });

    if (existingRelations.length > 0) {
      const existingIds = existingRelations.map((r) => r.exerciseId);
      throw new AppError(`Some exercises are already added: ${existingIds.join(', ')}`, 409);
    }

    const createdRelations = await prisma.$transaction(
      exerciseIds.map((exerciseId) =>
        prisma.challengeExercise.create({
          data: { challengeId, exerciseId },
          ...challengeExerciseInclude,
        })
      )
    );

    sendResponse(res, 201, createdRelations, 'Exercises added to challenge successfully');
  } catch (error) {
    handleError(error, res);
  }
};

// ---- Graceful shutdown ----
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
