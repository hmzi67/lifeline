import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { findActiveLicense, findFreeWeek } from '../services/subscriptionAccessService.js';

const resumableRoutes = [
  '/(auth)/Gender',
  '/(auth)/Male',
  '/(auth)/Female',
  '/(auth)/PrimaryGoal',
  '/(auth)/Nutrition',
  '/(auth)/diabeticConset',
  '/(auth)/Exclusion',
  '/(auth)/fitnessLevel',
  '/(auth)/Routine',
  '/(auth)/Limitation',
  '/(auth)/focusArea',
  '/(auth)/focusAreaAndroid',
  '/(auth)/age',
  '/(auth)/height',
  '/(auth)/currentWeight',
  '/(auth)/goalWeight',
  '/(auth)/fitnessGoal',
  '/(auth)/wedding',
  '/(auth)/engagment',
  '/(auth)/birthday',
  '/(auth)/travelling',
  '/(auth)/graph',
  '/(auth)/subscription',
  '/(auth)/PaymentMethod',
] as const;

const onboardingProgressPatchSchema = z.object({
  lastRoute: z.enum(resumableRoutes).nullable().optional(),
  pricingPlanId: z.string().min(1).max(191).nullable().optional(),
  isComplete: z.boolean().optional(),
  visitedGenderInfo: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one onboarding field is required',
    });
  }

  if (value.isComplete === true && value.lastRoute) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A completed onboarding flow cannot have a resume route',
      path: ['lastRoute'],
    });
  }

  if (
    value.pricingPlanId !== undefined
    && value.lastRoute !== '/(auth)/PaymentMethod'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pricingPlanId can only be saved with the payment-method route',
      path: ['pricingPlanId'],
    });
  }
});

const toResponse = (progress?: {
  lastRoute: string | null;
  pricingPlanId: string | null;
  isComplete: boolean;
  visitedGenderInfo: boolean;
  completedAt: Date | null;
} | null) => ({
  lastRoute: progress?.lastRoute ?? null,
  pricingPlanId: progress?.pricingPlanId ?? null,
  isComplete: progress?.isComplete ?? false,
  visitedGenderInfo: progress?.visitedGenderInfo ?? false,
  completedAt: progress?.completedAt?.toISOString() ?? null,
});

export const getOnboardingProgress = async (
  req: Request,
  res: Response,
) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId },
    select: {
      lastRoute: true,
      pricingPlanId: true,
      isComplete: true,
      visitedGenderInfo: true,
      completedAt: true,
    },
  });

  return res.status(200).json({
    success: true,
    data: { onboardingProgress: toResponse(progress) },
  });
};

export const updateOnboardingProgress = async (
  req: Request,
  res: Response,
) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const parsed = onboardingProgressPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: parsed.error.issues.map(error => ({
        field: error.path.join('.'),
        message: error.message,
      })),
    });
  }

  const patch = parsed.data;

  if (patch.isComplete === true) {
    // Paid, or chose "Continue for free" (the free week then decides whether the app is usable).
    const user = (req as AuthenticatedRequest).user!;
    const [activeLicense, freeWeek] = await Promise.all([findActiveLicense(userId), findFreeWeek(user.email)]);

    if (!activeLicense && !freeWeek.startedAt) {
      return res.status(409).json({
        success: false,
        message: 'A confirmed subscription is required to finish onboarding',
      });
    }
  }

  const data: {
    lastRoute?: string | null;
    pricingPlanId?: string | null;
    isComplete?: boolean;
    visitedGenderInfo?: boolean;
    completedAt?: Date | null;
  } = {};

  if (patch.lastRoute !== undefined) {
    data.lastRoute = patch.lastRoute;
    if (patch.lastRoute !== '/(auth)/PaymentMethod') {
      data.pricingPlanId = null;
    }
    if (patch.lastRoute) {
      data.isComplete = false;
      data.completedAt = null;
    }
  }

  if (patch.pricingPlanId !== undefined) {
    data.pricingPlanId = patch.pricingPlanId;
  }

  if (patch.visitedGenderInfo !== undefined) {
    data.visitedGenderInfo = patch.visitedGenderInfo;
  }

  if (patch.isComplete !== undefined) {
    data.isComplete = patch.isComplete;
    data.completedAt = patch.isComplete ? new Date() : null;
    if (patch.isComplete) {
      data.lastRoute = null;
      data.pricingPlanId = null;
    }
  }

  const progress = await prisma.onboardingProgress.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: {
      lastRoute: true,
      pricingPlanId: true,
      isComplete: true,
      visitedGenderInfo: true,
      completedAt: true,
    },
  });

  return res.status(200).json({
    success: true,
    data: { onboardingProgress: toResponse(progress) },
  });
};
