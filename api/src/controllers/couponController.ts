import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { CouponError, findUsableCoupon } from '../services/couponService.js';
import { partialWithoutDefaults } from '../utils/partialWithoutDefaults.js';

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createCouponSchema = z.object({
  code: z
    .string()
    .min(3, 'Code must be at least 3 characters')
    .max(50, 'Code must be at most 50 characters')
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens and underscores'),
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

const updateCouponSchema = partialWithoutDefaults(createCouponSchema).omit({ code: true });

const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

// ─── Admin: Create Coupon ──────────────────────────────────────────────────────

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.id;
    const data = createCouponSchema.parse(req.body);

    // Ensure code is unique (case-insensitive already forced to upper)
    const existing = await prisma.couponCode.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A coupon with this code already exists',
      });
    }

    const coupon = await prisma.couponCode.create({
      data: {
        code: data.code,
        description: data.description,
        discountPercent: data.discountPercent,
        maxUses: data.maxUses,
        isActive: data.isActive,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: adminId ?? null,
      },
      include: {
        createdBy: { select: { id: true, email: true, username: true } },
        _count: { select: { usages: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: coupon,
      message: 'Coupon created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    console.error('createCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create coupon', error: error.message });
  }
};

// ─── Admin: Get All Coupons ────────────────────────────────────────────────────

export const getAllCoupons = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) where.code = { contains: String(search).toUpperCase() };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [coupons, total] = await Promise.all([
      prisma.couponCode.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true, username: true } },
          _count: { select: { usages: true } },
        },
      }),
      prisma.couponCode.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: coupons,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
      message: 'Coupons retrieved successfully',
    });
  } catch (error: any) {
    console.error('getAllCoupons error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coupons', error: error.message });
  }
};

// ─── Admin: Get Coupon By ID ───────────────────────────────────────────────────

export const getCouponById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.couponCode.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, username: true } },
        usages: {
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { usedAt: 'desc' },
        },
      },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    return res.status(200).json({ success: true, data: coupon, message: 'Coupon retrieved successfully' });
  } catch (error: any) {
    console.error('getCouponById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coupon', error: error.message });
  }
};

// ─── Admin: Update Coupon ──────────────────────────────────────────────────────

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateCouponSchema.parse(req.body);

    const existing = await prisma.couponCode.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const coupon = await prisma.couponCode.update({
      where: { id },
      data: {
        ...data,
        expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : undefined,
      },
      include: {
        createdBy: { select: { id: true, email: true, username: true } },
        _count: { select: { usages: true } },
      },
    });

    return res.status(200).json({ success: true, data: coupon, message: 'Coupon updated successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    console.error('updateCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update coupon', error: error.message });
  }
};

// ─── Admin: Delete Coupon ──────────────────────────────────────────────────────

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.couponCode.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Delete usages first, then the coupon
    await prisma.couponUsage.deleteMany({ where: { couponId: id } });
    await prisma.couponCode.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error: any) {
    console.error('deleteCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete coupon', error: error.message });
  }
};

// ─── User: Validate Coupon (before payment) ───────────────────────────────────

export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { code } = validateCouponSchema.parse(req.body);
    const coupon = await findUsableCoupon(prisma, code, userId);

    return res.status(200).json({
      success: true,
      data: {
        couponId: coupon.id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        description: coupon.description,
      },
      message: `Coupon applied! You get ${coupon.discountPercent}% off`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    }
    if (error instanceof CouponError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('validateCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate coupon', error: error.message });
  }
};

// ─── Admin: Get Coupon Usage Stats ────────────────────────────────────────────

export const getCouponStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.couponCode.findUnique({
      where: { id },
      include: {
        usages: {
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { usedAt: 'desc' },
        },
        _count: { select: { usages: true } },
      },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        coupon,
        usageRate: `${coupon._count.usages} / ${coupon.maxUses}`,
        remainingUses: coupon.maxUses - coupon.currentUses,
      },
      message: 'Coupon stats retrieved successfully',
    });
  } catch (error: any) {
    console.error('getCouponStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coupon stats', error: error.message });
  }
};
