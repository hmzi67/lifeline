import { Prisma } from '@prisma/client';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { notifyUser } from '../services/notificationService.js';
import { challengePhase, isChallengeVisible, visibleChallengeWhere } from '../services/challengeTimeline.js';
import {
  CHALLENGE_DURATIONS,
  ChallengePaymentError,
  challengePricing,
  confirmStripeCheckout,
  DEFAULT_DAILY_FEE,
  recordApplePurchase,
  startAppleCheckout,
  startStripeCheckout,
} from '../services/challengePaymentService.js';
import { getStripeClient } from './paymentController.js';
import { AppStoreServiceError } from '../services/appStoreService.js';

// ---------------- Types ----------------
type PaginationQuery = {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
};

type ChallengeInput = {
  name: string;
  purpose?: string;
  description: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'COMPLETED';
  scheduledAt?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  videoUrl?: string;
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

  if (err instanceof AppError || err instanceof ChallengePaymentError || err instanceof AppStoreServiceError) {
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
// Form clients send '' or null for fields left blank.
const blankToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);
const optionalText = z.preprocess(blankToUndefined, z.string().optional());
// 'YYYY-MM-DD' from date inputs; stored in @db.Date columns.
const optionalDate = z.preprocess(blankToUndefined, z.coerce.date({ invalid_type_error: 'Invalid date' }).optional());
const dateTime = z.string().datetime('Invalid scheduledAt datetime').transform(value => new Date(value));

const challengeFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  purpose: optionalText,
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'COMPLETED']).optional().default('DRAFT'),
  scheduledAt: z.preprocess(blankToUndefined, dateTime.optional()),
  startDate: optionalDate,
  endDate: optionalDate,
  image: optionalText,
  videoUrl: optionalText,
  // Paid challenges: joiners pay dailyFee x durationDays. No fee means free to join.
  durationDays: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(365).optional()),
  dailyFee: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(1000).optional()),
});

const endsAfterStart = (data: { startDate?: Date; endDate?: Date }) =>
  !data.startDate || !data.endDate || data.endDate >= data.startDate;
const endsAfterStartIssue = { message: 'End date must be on or after the start date', path: ['endDate'] };

const challengeSchema = challengeFields.refine(endsAfterStart, endsAfterStartIssue);
const challengeUpdateSchema = challengeFields.partial().refine(endsAfterStart, endsAfterStartIssue);

// What a regular user can submit for review from the app.
const submissionSchema = z
  .object({
    name: challengeFields.shape.name,
    purpose: optionalText,
    description: challengeFields.shape.description,
    scheduledAt: dateTime,
    durationDays: z.coerce
      .number()
      .refine(days => (CHALLENGE_DURATIONS as readonly number[]).includes(days), {
        message: `Duration must be ${CHALLENGE_DURATIONS.join(', ')} days`,
      }),
  })
  // A few minutes of slack for the time spent filling in the form.
  .refine(data => data.scheduledAt.getTime() > Date.now() - 5 * 60 * 1000, {
    message: 'Challenge time must be in the future',
    path: ['scheduledAt'],
  });

const MAX_PENDING_SUBMISSIONS = 5;

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: optionalText,
});

export const CHALLENGE_REPORT_REASONS = ['INAPPROPRIATE', 'SPAM', 'UNSAFE', 'OTHER'] as const;

const reportSchema = z.object({
  reason: z.enum(CHALLENGE_REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

const reportResolutionSchema = z.object({
  action: z.enum(['remove', 'dismiss']),
});

// ---------------- Common Includes ----------------
const PARTICIPANT_AVATAR_LIMIT = 4;
// Challenges added within this window are badged "New" in the app.
const NEW_CHALLENGE_DAYS = 14;

// Public shape: a participant count and a few avatars instead of every
// UserChallenge row (which exposed other users' IDs to any caller).
const challengeInclude = {
  challengeExercises: { include: { exercise: true } },
  challengeDiets: { include: { diet: true } },
  challengeFees: true,
  _count: { select: { userChallenges: true } },
  userChallenges: {
    where: { user: { profileImage: { not: null } } },
    orderBy: { joinedAt: 'desc' as const },
    take: PARTICIPANT_AVATAR_LIMIT,
    select: { user: { select: { profileImage: true } } },
  },
  submittedBy: { select: { id: true, username: true, displayName: true, email: true, profileImage: true } },
};

// Delete only needs to know whether dependants exist.
const challengeDependencyInclude = {
  _count: {
    select: { challengeExercises: true, challengeDiets: true, challengeFees: true, userChallenges: true },
  },
};

type Viewer = { userId: string | null; isAdmin: boolean };

// Create/update sit behind authorize(['admin']).
const ADMIN_VIEWER: Viewer = { userId: null, isAdmin: true };

// List/detail routes are public; a valid token only personalises the result.
const resolveViewer = async (req: Request): Promise<Viewer> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return { userId: null, isAdmin: false };
  try {
    const { userId } = jwt.verify(header.substring(7), config.jwt.secret) as { userId?: string };
    if (!userId) return { userId: null, isAdmin: false };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { name: true } } } });
    return { userId, isAdmin: user?.role?.name === 'admin' };
  } catch {
    return { userId: null, isAdmin: false };
  }
};

type IncludedChallenge = {
  id: string;
  status: string | null;
  createdAt: Date | null;
  scheduledAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  dailyFee: Prisma.Decimal | null;
  challengeFees: unknown[];
  _count: { userChallenges: number };
  userChallenges: Array<{ user: { profileImage: string | null } | null }>;
  submittedBy: { id: string; username: string | null; displayName: string | null; email: string; profileImage: string | null } | null;
};

const toPublicChallenge = <T extends IncludedChallenge>(
  { _count, userChallenges, challengeFees, submittedBy, ...challenge }: T,
  viewer: Viewer,
  joinedIds: ViewerJoins,
) => ({
  ...challenge,
  // Fee rows are other users' payments, and submitter emails are private; only admins need them.
  ...(viewer.isAdmin ? { challengeFees, submittedBy } : {}),
  host: submittedBy
    ? { id: submittedBy.id, username: submittedBy.displayName || submittedBy.username, profileImage: submittedBy.profileImage }
    : null,
  phase: challengePhase(challenge),
  ...challengePricing(challenge),
  participantsCount: _count.userChallenges,
  participantAvatars: userChallenges
    .map(uc => uc.user?.profileImage)
    .filter((url): url is string => !!url),
  isJoined: joinedIds.has(challenge.id),
  isCompleted: !!joinedIds.get(challenge.id),
  isNew: !!challenge.createdAt && Date.now() - challenge.createdAt.getTime() < NEW_CHALLENGE_DAYS * 86400000,
});

/** The viewer's joins among `challengeIds`: challenge id -> when they completed it (null if not yet). */
type ViewerJoins = Map<string, Date | null>;

const joinedChallengeIds = async (viewer: Viewer, challengeIds: string[]): Promise<ViewerJoins> => {
  if (!viewer.userId || challengeIds.length === 0) return new Map();
  const rows = await prisma.userChallenge.findMany({
    where: { userId: viewer.userId, challengeId: { in: challengeIds } },
    select: { challengeId: true, completedAt: true },
  });
  return new Map(rows.filter(r => r.challengeId).map(r => [r.challengeId!, r.completedAt] as const));
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

    const viewer = await resolveViewer(req);
    const where: any = {};
    if (status) where.status = status
    // Pending/rejected submissions and draft/inactive challenges stay out of the app; admins see all.
    if (!viewer.isAdmin) where.AND = [visibleChallengeWhere];
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
        orderBy: [
          { createdAt: { sort: 'desc', nulls: 'last' } },
          { startDate: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.challenge.count({ where }),
    ]);

    const joinedIds = await joinedChallengeIds(viewer, challenges.map(c => c.id));

    sendResponse(res, 200, {
      challenges: challenges.map(c => toPublicChallenge(c, viewer, joinedIds)),
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

    const viewer = await resolveViewer(req);
    if (!challenge || (!viewer.isAdmin && !isChallengeVisible(challenge))) {
      throw new AppError('Challenge not found', 404);
    }

    const joinedIds = await joinedChallengeIds(viewer, [challenge.id]);
    sendResponse(res, 200, toPublicChallenge(challenge, viewer, joinedIds));
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

    sendResponse(res, 201, toPublicChallenge(challenge, ADMIN_VIEWER, new Map()), 'Challenge created successfully');
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
    const validatedData = challengeUpdateSchema.parse(req.body);

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

    sendResponse(res, 200, toPublicChallenge(updatedChallenge, ADMIN_VIEWER, new Map()), 'Challenge updated successfully');
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
      include: challengeDependencyInclude,
    });
    if (!challenge) throw new AppError('Challenge not found', 404);

    const { challengeExercises, challengeDiets, challengeFees, userChallenges } = challenge._count;
    if (challengeExercises > 0 || challengeDiets > 0 || challengeFees > 0 || userChallenges > 0) {
      throw new AppError('Cannot delete challenge with associated records. Remove dependencies first.', 400);
    }

    await prisma.challenge.delete({ where: { id } });
    sendResponse(res, 200, { id }, 'Challenge deleted successfully');
  } catch (err) {
    handleError(err, res);
  }
};

// Submit a challenge from the app; it stays hidden until an admin approves it.
export const submitChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) throw new AppError('Authentication required', 401);

    const data = submissionSchema.parse(req.body);

    const pending = await prisma.challenge.count({
      where: { submittedById: userId, approvalStatus: 'PENDING' },
    });
    if (pending >= MAX_PENDING_SUBMISSIONS) {
      throw new AppError(
        `You already have ${MAX_PENDING_SUBMISSIONS} challenges waiting for review. Please wait for them to be approved.`,
        429,
      );
    }

    const nameTaken = await prisma.challenge.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (nameTaken) throw new AppError('A challenge with this name already exists', 409);

    const challenge = await prisma.challenge.create({
      data: {
        ...data,
        // Joiners pay the standard daily rate; the challenge runs for durationDays from its start.
        dailyFee: DEFAULT_DAILY_FEE,
        endDate: new Date(data.scheduledAt.getTime() + (data.durationDays - 1) * 86400000),
        status: 'ACTIVE',
        approvalStatus: 'PENDING',
        submittedById: userId,
      },
      include: challengeInclude,
    });

    sendResponse(
      res,
      201,
      toPublicChallenge(challenge, { userId, isAdmin: false }, new Map()),
      'Challenge submitted for review',
    );
  } catch (err) {
    handleError(err, res);
  }
};

// Admin: challenges waiting for review, oldest first.
export const getPendingChallenges = async (_req: Request, res: Response): Promise<void> => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: { approvalStatus: 'PENDING' },
      include: challengeInclude,
      orderBy: [{ createdAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
    sendResponse(res, 200, {
      challenges: challenges.map(c => toPublicChallenge(c, ADMIN_VIEWER, new Map())),
    });
  } catch (err) {
    handleError(err, res);
  }
};

// Admin: approve or reject a submitted challenge and tell the submitter.
export const reviewChallenge = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = validateId(req.params.id);
    const { action, rejectionReason } = reviewSchema.parse(req.body);

    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw new AppError('Challenge not found', 404);

    const approved = action === 'approve';
    const challenge = await prisma.challenge.update({
      where: { id },
      data: {
        approvalStatus: approved ? 'APPROVED' : 'REJECTED',
        rejectionReason: approved ? null : rejectionReason ?? null,
      },
      include: challengeInclude,
    });

    if (existing.submittedById) {
      const name = existing.name ?? 'Your challenge';
      await notifyUser(existing.submittedById, {
        type: 'challenge',
        title: approved ? 'Challenge approved' : 'Challenge not approved',
        body: approved
          ? `"${name}" is now live for everyone to join.`
          : `"${name}" was not approved${rejectionReason ? `: ${rejectionReason}` : '.'}`,
        data: { challengeId: id },
      });
    }

    sendResponse(
      res,
      200,
      toPublicChallenge(challenge, ADMIN_VIEWER, new Map()),
      approved ? 'Challenge approved' : 'Challenge rejected',
    );
  } catch (err) {
    handleError(err, res);
  }
};

// A user flags a live challenge as objectionable. One report per user and challenge;
// reporting again replaces the reason and reopens it.
export const reportChallenge = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) throw new AppError('Authentication required', 401);

    const challengeId = validateId(req.params.id);
    const { reason, details } = reportSchema.parse(req.body);

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !isChallengeVisible(challenge)) throw new AppError('Challenge not found', 404);
    if (challenge.submittedById === userId) throw new AppError("You can't report your own challenge", 400);

    await prisma.challengeReport.upsert({
      where: { challengeId_reporterId: { challengeId, reporterId: userId } },
      create: { challengeId, reporterId: userId, reason, details: details || null },
      update: { reason, details: details || null, status: 'OPEN', createdAt: new Date(), resolvedAt: null },
    });

    sendResponse(res, 201, { reported: true }, 'Thanks. Our team will review this challenge.');
  } catch (err) {
    handleError(err, res);
  }
};

// Admin: challenges with open reports, most reported first.
export const getChallengeReports = async (_req: Request, res: Response): Promise<void> => {
  try {
    const reports = await prisma.challengeReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        challenge: {
          select: {
            id: true, name: true, purpose: true, description: true, approvalStatus: true,
            submittedBy: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    const byChallenge = new Map<string, { challenge: (typeof reports)[number]['challenge']; reports: unknown[] }>();
    for (const { challenge, ...report } of reports) {
      const entry = byChallenge.get(challenge.id) ?? { challenge, reports: [] };
      entry.reports.push(report);
      byChallenge.set(challenge.id, entry);
    }
    const challenges = [...byChallenge.values()].sort((a, b) => b.reports.length - a.reports.length);

    sendResponse(res, 200, { challenges, total: challenges.length });
  } catch (err) {
    handleError(err, res);
  }
};

// Admin: take a reported challenge down, or keep it and dismiss its open reports.
export const resolveChallengeReports = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = validateId(req.params.id);
    const { action } = reportResolutionSchema.parse(req.body);

    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new AppError('Challenge not found', 404);

    const remove = action === 'remove';
    if (remove) {
      await prisma.challenge.update({
        where: { id },
        data: { approvalStatus: 'REJECTED', rejectionReason: 'Removed after review of user reports' },
      });
    }
    await prisma.challengeReport.updateMany({
      where: { challengeId: id, status: 'OPEN' },
      data: { status: remove ? 'RESOLVED' : 'DISMISSED', resolvedAt: new Date() },
    });

    if (remove && challenge.submittedById) {
      await notifyUser(challenge.submittedById, {
        type: 'challenge',
        title: 'Challenge removed',
        body: `"${challenge.name ?? 'Your challenge'}" was removed after a review of user reports.`,
        data: { challengeId: id },
      });
    }

    sendResponse(res, 200, { challengeId: id, action }, remove ? 'Challenge removed' : 'Reports dismissed');
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

    // Verify challenge exists and is open: pending/rejected submissions are hidden from users.
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !isChallengeVisible(challenge)) throw new AppError('Challenge not found', 404);
    if (challengePhase(challenge) === 'ended') throw new AppError('This challenge has ended', 400);
    if (challengePricing(challenge).isPaid) {
      throw new AppError('This challenge requires payment. Use checkout to join.', 402);
    }

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

// Mark the caller's joined challenge as completed. Idempotent; can't complete before it starts.
export const completeChallenge = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) throw new AppError('Authentication required', 401);
    const challengeId = validateId(req.params.id);

    const userChallenge = await prisma.userChallenge.findFirst({
      where: { userId, challengeId },
      include: { challenge: true },
    });
    if (!userChallenge?.challenge) throw new AppError('Join this challenge before completing it', 404);
    if (challengePhase(userChallenge.challenge) === 'upcoming') {
      throw new AppError("This challenge hasn't started yet", 400);
    }

    const completed = userChallenge.completedAt
      ? userChallenge
      : await prisma.userChallenge.update({ where: { id: userChallenge.id }, data: { completedAt: new Date() } });

    sendResponse(res, 200, { challengeId, completedAt: completed.completedAt }, 'Challenge completed');
  } catch (err) {
    handleError(err, res);
  }
};

// ---------------- Paid challenges ----------------
const checkoutSchema = z.object({ platform: z.enum(['stripe', 'apple']) });
const confirmCheckoutSchema = z.object({ paymentIntentId: z.string().min(1, 'paymentIntentId is required') });
const applePurchaseSchema = z.object({ signedTransaction: z.string().min(1, 'signedTransaction is required') });

const requireUserId = (req: Request): string => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) throw new AppError('Authentication required', 401);
  return userId;
};

const requireStripe = () => {
  const stripe = getStripeClient();
  if (!stripe) throw new AppError('Card payments are not available right now', 503);
  return stripe;
};

// Start paying to join: a Stripe PaymentSheet intent (Android) or the App Store product to buy (iOS).
export const startChallengeCheckout = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req);
    const challengeId = validateId(req.params.id);
    const { platform } = checkoutSchema.parse(req.body);

    const checkout =
      platform === 'stripe'
        ? await startStripeCheckout(requireStripe(), challengeId, userId)
        : await startAppleCheckout(challengeId, userId);
    sendResponse(res, 200, checkout);
  } catch (err) {
    handleError(err, res);
  }
};

// Android: after PaymentSheet succeeds, verify the payment with Stripe and join.
export const confirmChallengeCheckout = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req);
    const challengeId = validateId(req.params.id);
    const { paymentIntentId } = confirmCheckoutSchema.parse(req.body);

    const fee = await confirmStripeCheckout(requireStripe(), challengeId, userId, paymentIntentId);
    sendResponse(res, 200, { challengeId: fee.challengeId, status: fee.status }, 'Successfully joined the challenge');
  } catch (err) {
    handleError(err, res);
  }
};

// iOS: a StoreKit transaction for a challenge product, from the purchase flow or the transaction listener.
export const recordChallengeApplePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req);
    const { signedTransaction } = applePurchaseSchema.parse(req.body);

    const fee = await recordApplePurchase(userId, signedTransaction);
    sendResponse(res, 200, { challengeId: fee.challengeId, status: fee.status }, 'Successfully joined the challenge');
  } catch (err) {
    handleError(err, res);
  }
};

// ---------------- Graceful Shutdown ----------------
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
