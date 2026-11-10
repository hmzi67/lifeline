import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { partialWithoutDefaults } from '../utils/partialWithoutDefaults.js';

const prisma = new PrismaClient();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createReferralSchema = z.object({
  code: z
    .string()
    .min(3, 'Code must be at least 3 characters')
    .max(50, 'Code must be at most 50 characters')
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens and underscores'),
  referrerId: z.string().min(1, 'Referrer (doctor) user ID is required'),
  description: z.string().optional(),
  discountPercent: z
    .number()
    .int()
    .min(1, 'Discount must be at least 1%')
    .max(100, 'Discount cannot exceed 100%')
    .default(10),
  maxUses: z.number().int().min(1, 'Max uses must be at least 1'),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

const updateReferralSchema = partialWithoutDefaults(createReferralSchema).omit({ code: true, referrerId: true });

const validateReferralSchema = z.object({
  code: z.string().min(1, 'Referral code is required'),
});

// ─── Admin: Create Referral Code ──────────────────────────────────────────────

export const createReferralCode = async (req: Request, res: Response) => {
  try {
    const data = createReferralSchema.parse(req.body);

    // Verify referrer exists
    const referrer = await prisma.user.findUnique({
      where: { id: data.referrerId },
      select: { id: true, email: true, username: true },
    });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Referrer user not found' });
    }

    // Ensure code is unique
    const existing = await prisma.referralCode.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A referral code with this code already exists' });
    }

    const referralCode = await prisma.referralCode.create({
      data: {
        code: data.code,
        referrerId: data.referrerId,
        description: data.description,
        discountPercent: data.discountPercent,
        maxUses: data.maxUses,
        isActive: data.isActive,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        referrer: { select: { id: true, email: true, username: true } },
        _count: { select: { usages: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: referralCode,
      message: 'Referral code created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    console.error('createReferralCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create referral code', error: error.message });
  }
};

// ─── Admin: Get All Referral Codes ────────────────────────────────────────────

export const getAllReferralCodes = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search, referrerId, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) where.code = { contains: String(search).toUpperCase() };
    if (referrerId) where.referrerId = String(referrerId);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [referralCodes, total] = await Promise.all([
      prisma.referralCode.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: { select: { id: true, email: true, username: true } },
          _count: { select: { usages: true } },
        },
      }),
      prisma.referralCode.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: referralCodes,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
      message: 'Referral codes retrieved successfully',
    });
  } catch (error: any) {
    console.error('getAllReferralCodes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch referral codes', error: error.message });
  }
};

// ─── Admin: Get Referral Code By ID ───────────────────────────────────────────

export const getReferralCodeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const referralCode = await prisma.referralCode.findUnique({
      where: { id },
      include: {
        referrer: { select: { id: true, email: true, username: true } },
        usages: {
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { usedAt: 'desc' },
        },
      },
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, message: 'Referral code not found' });
    }

    return res.status(200).json({ success: true, data: referralCode, message: 'Referral code retrieved successfully' });
  } catch (error: any) {
    console.error('getReferralCodeById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch referral code', error: error.message });
  }
};

// ─── Admin: Update Referral Code ──────────────────────────────────────────────

export const updateReferralCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateReferralSchema.parse(req.body);

    const existing = await prisma.referralCode.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Referral code not found' });
    }

    const referralCode = await prisma.referralCode.update({
      where: { id },
      data: {
        ...data,
        expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : undefined,
      },
      include: {
        referrer: { select: { id: true, email: true, username: true } },
        _count: { select: { usages: true } },
      },
    });

    return res.status(200).json({ success: true, data: referralCode, message: 'Referral code updated successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    console.error('updateReferralCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update referral code', error: error.message });
  }
};

// ─── Admin: Delete Referral Code ──────────────────────────────────────────────

export const deleteReferralCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.referralCode.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Referral code not found' });
    }

    await prisma.referralUsage.deleteMany({ where: { referralCodeId: id } });
    await prisma.referralCode.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'Referral code deleted successfully' });
  } catch (error: any) {
    console.error('deleteReferralCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete referral code', error: error.message });
  }
};

// ─── User: Validate Referral Code (before payment) ────────────────────────────

export const validateReferralCode = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { code } = validateReferralSchema.parse(req.body);
    const upperCode = code.toUpperCase();

    const referralCode = await prisma.referralCode.findUnique({
      where: { code: upperCode },
      include: { referrer: { select: { id: true, email: true, username: true } } },
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    if (!referralCode.isActive) {
      return res.status(400).json({ success: false, message: 'This referral code is no longer active' });
    }

    if (referralCode.expiresAt && new Date() > referralCode.expiresAt) {
      return res.status(400).json({ success: false, message: 'This referral code has expired' });
    }

    if (referralCode.currentUses >= referralCode.maxUses) {
      return res.status(400).json({ success: false, message: 'This referral code has reached its usage limit' });
    }

    // A user cannot use their own referral code
    if (referralCode.referrerId === userId) {
      return res.status(400).json({ success: false, message: 'You cannot use your own referral code' });
    }

    // Check if user has already used this referral code
    const alreadyUsed = await prisma.referralUsage.findUnique({
      where: { referralCodeId_userId: { referralCodeId: referralCode.id, userId } },
    });

    if (alreadyUsed) {
      return res.status(400).json({ success: false, message: 'You have already used this referral code' });
    }

    return res.status(200).json({
      success: true,
      data: {
        referralCodeId: referralCode.id,
        code: referralCode.code,
        discountPercent: referralCode.discountPercent,
        description: referralCode.description,
        referredBy: referralCode.referrer?.username || referralCode.referrer?.email,
      },
      message: `Referral code applied! You get ${referralCode.discountPercent}% off`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    console.error('validateReferralCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate referral code', error: error.message });
  }
};

// ─── Admin: Get Referral Code Stats ───────────────────────────────────────────

export const getReferralCodeStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const referralCode = await prisma.referralCode.findUnique({
      where: { id },
      include: {
        referrer: { select: { id: true, email: true, username: true } },
        usages: {
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { usedAt: 'desc' },
        },
        _count: { select: { usages: true } },
      },
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, message: 'Referral code not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        referralCode,
        usageRate: `${referralCode._count.usages} / ${referralCode.maxUses}`,
        remainingUses: referralCode.maxUses - referralCode.currentUses,
      },
      message: 'Referral code stats retrieved successfully',
    });
  } catch (error: any) {
    console.error('getReferralCodeStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch referral code stats', error: error.message });
  }
};
