import { PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { notifyUser } from '../services/notificationService.js';

// ---------------- Types ----------------
type ChallengeWithRelations = {
  challengeExercises: Array<{ exercise: any }>; // Replace any with Exercise type
  challengeDiets: Array<{ diet: any }>; // Replace any with Diet type
  challengeFees: any[]; // Replace any with Fee type
  userChallenges: any[]; // Replace any with UserChallenge type
};

type PaginationQuery = {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
};

type ChallengeInput = {
  name: string;
  purpose: string;
  description: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'COMPLETED';
  scheduledAt?: string;
};

// ---------------- Utilities ----------------
const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message = ''
) => {
  const response: { success: boolean; message?: string; data: T } = {
    success: statusCode >= 200 && statusCode < 300,
    data,
  };
  if (message) response.message = message;
  return res.status(statusCode).json(response);
};

class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

const handleError = (err: unknown, res: Response): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    sendResponse(res, err.statusCode, { error: err.message }, err.message);
    return;
  }

  if (typeof err === 'object' && err !== null && 'code' in err) {
    const e = err as { code: string; message?: string };

    if (e.code === 'P1001') {
      sendResponse(
        res,
        503,
        { error: 'Database is temporarily unavailable. Please try again shortly.' },
        'Service Unavailable'
      );
      return;
    }

    if (e.code === 'P2002') {
      sendResponse(res, 409, { error: 'A challenge with this name already exists' }, 'Conflict');
      return;
    }

    if (e.code === 'P2025') {
      sendResponse(res, 404, { error: 'Challenge not found' }, 'Not Found');
      return;
    }
  }

  if (err instanceof z.ZodError) {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendResponse(res, 400, { errors }, 'Validation Error');
    return;
  }

  if (err instanceof PrismaClientInitializationError) {
    sendResponse(
      res,
      503,
      { error: 'Database is temporarily unavailable. Please try again shortly.' },
      'Service Unavailable'
    );
    return;
  }

  sendResponse(res, 500, { error: 'Internal Server Error' }, 'Internal Server Error');
};

const idSchema = z.string().cuid('Invalid ID format');
const validateId = (id: string): string => {
  try {
    return idSchema.parse(id);
  } catch {
    throw new AppError('Invalid ID format', 400);
  }
};

// ---------------- Validation Schemas ----------------
const challengeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  purpose: z.string().min(1, 'Purpose is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'COMPLETED']).optional().default('DRAFT'),
  scheduledAt: z.string().datetime('Invalid scheduledAt datetime').optional(),
});

// ---------------- Common Includes ----------------
const challengeInclude = {
  challengeExercises: { include: { exercise: true } },
  challengeDiets: { include: { diet: true } },
  challengeFees: true,
  userChallenges: true,
};

// ---------------- Controllers ----------------

// Get all challenges
export const getAllChallenges = async (
  req: Request<{}, {}, {}, PaginationQuery>,
  res: Response
): Promise<void> => {
  try {
    const { page = '1', limit = '10', status, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [challenges, total] = await Promise.all([
      prisma.challenge.findMany({
        where,
        include: challengeInclude,
        skip,
        take: limitNum,
      }),
      prisma.challenge.count({ where }),
    ]);

    sendResponse(res, 200, {
      challenges,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    handleError(err, res);
  }
};

// Get challenge by ID
export const getChallengeById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const id = validateId(req.params.id);

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: challengeInclude,
    });

    if (!challenge) throw new AppError('Challenge not found', 404);

    sendResponse(res, 200, challenge);
  } catch (err) {
    handleError(err, res);
  }
};

// Create challenge
export const createChallenge = async (
  req: Request<{}, {}, ChallengeInput>,
  res: Response
): Promise<void> => {
  try {
    const validatedData = challengeSchema.parse(req.body);

    const existingChallenge = await prisma.challenge.findFirst({
      where: { name: { equals: validatedData.name, mode: 'insensitive' } },
    });

    if (existingChallenge) throw new AppError('A challenge with this name already exists', 409);

    const challenge = await prisma.challenge.create({
      data: validatedData,
      include: challengeInclude,
    });

    sendResponse<ChallengeWithRelations>(res, 201, challenge, 'Challenge created successfully');
  } catch (err) {
    handleError(err, res);
  }
};

// Update challenge
export const updateChallenge = async (
  req: Request<{ id: string }, {}, Partial<ChallengeInput>>,
  res: Response
): Promise<void> => {
  try {
    const id = validateId(req.params.id);
    const updateSchema = challengeSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    const existingChallenge = await prisma.challenge.findUnique({ where: { id } });
    if (!existingChallenge) throw new AppError('Challenge not found', 404);

    if (validatedData.name && validatedData.name !== existingChallenge.name) {
      const nameConflict = await prisma.challenge.findFirst({
        where: {
          name: { equals: validatedData.name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (nameConflict) throw new AppError('A challenge with this name already exists', 409);
    }

    const updatedChallenge = await prisma.challenge.update({
      where: { id },
      data: validatedData,
      include: challengeInclude,
    });

    sendResponse<ChallengeWithRelations>(res, 200, updatedChallenge, 'Challenge updated successfully');
  } catch (err) {
    handleError(err, res);
  }
};

// Delete challenge
export const deleteChallenge = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const id = validateId(req.params.id);

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: challengeInclude,
    });
    if (!challenge) throw new AppError('Challenge not found', 404);

    if (
      challenge.challengeExercises.length > 0 ||
      challenge.challengeDiets.length > 0 ||
      challenge.challengeFees.length > 0 ||
      challenge.userChallenges.length > 0
    ) {
      throw new AppError('Cannot delete challenge with associated records. Remove dependencies first.', 400);
    }

    await prisma.challenge.delete({ where: { id } });
    sendResponse(res, 200, { id }, 'Challenge deleted successfully');
  } catch (err) {
    handleError(err, res);
  }
};

// Join a challenge (create UserChallenge record)
export const joinChallenge = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const challengeId = validateId(req.params.id);
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify challenge exists
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError('Challenge not found', 404);

    // Check if already joined
    const existing = await prisma.userChallenge.findFirst({
      where: { challengeId, userId },
    });
    if (existing) {
      throw new AppError('You have already joined this challenge', 409);
    }

    const userChallenge = await prisma.userChallenge.create({
      data: {
        challengeId,
        userId,
        joinedAt: new Date(),
      },
      include: { challenge: true },
    });

    await notifyUser(userId, {
      type: 'challenge',
      title: 'Challenge joined',
      body: `You joined "${challenge.name ?? 'a challenge'}". Good luck!`,
      data: { challengeId },
    });

    sendResponse(res, 201, userChallenge, 'Successfully joined the challenge');
  } catch (err) {
    handleError(err, res);
  }
};

// ---------------- Graceful Shutdown ----------------
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
