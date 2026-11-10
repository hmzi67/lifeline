import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { MIN_CARD_CHARGE } from './paymentController.js';
import { partialWithoutDefaults } from '../utils/partialWithoutDefaults.js';

const pricingPlanSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().optional(),
    // Card checkout charges this price, and Stripe refuses charges under its minimum.
    price: z.number().min(MIN_CARD_CHARGE, `Price must be at least $${MIN_CARD_CHARGE.toFixed(2)}`),
    originalPrice: z.number().positive().optional().nullable(),
    appleProductId: z.string().trim().min(1).max(255).optional().nullable(),
    durationMonths: z.number().int().min(1).max(120),
    trialDays: z.number().int().min(0).max(730).default(0),
    features: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
    isHighlighted: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
});

export const getAllPricingPlans = async (_req: Request, res: Response) => {
    try {
        const plans = await prisma.pricingPlan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error('Error fetching pricing plans:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricing plans' });
    }
};

export const getAllPricingPlansAdmin = async (_req: Request, res: Response) => {
    try {
        const plans = await prisma.pricingPlan.findMany({
            orderBy: { sortOrder: 'asc' },
        });
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error('Error fetching admin pricing plans:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricing plans' });
    }
};

export const getPricingPlanById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = await prisma.pricingPlan.findUnique({ where: { id } });
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Pricing plan not found' });
        }
        res.json({ success: true, data: plan });
    } catch (error) {
        console.error('Error fetching pricing plan:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricing plan' });
    }
};

/** The struck-through "original" price only makes sense above the real one. */
const originalPriceError = (price: number, originalPrice: number | null | undefined) =>
    originalPrice != null && originalPrice <= price
        ? 'Original price must be higher than the price (it is shown struck through)'
        : null;

const isDuplicateAppleProductId = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2002'
    && String(error.meta?.target ?? '').includes('apple_product_id');

const DUPLICATE_APPLE_PRODUCT = 'Another plan already uses this App Store product ID';

export const createPricingPlan = async (req: Request, res: Response) => {
    try {
        const data = pricingPlanSchema.parse(req.body);
        const priceError = originalPriceError(data.price, data.originalPrice);
        if (priceError) {
            return res.status(400).json({ success: false, message: priceError });
        }
        const plan = await prisma.pricingPlan.create({ data });
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
            });
        }
        if (isDuplicateAppleProductId(error)) {
            return res.status(409).json({ success: false, message: DUPLICATE_APPLE_PRODUCT });
        }
        console.error('Error creating pricing plan:', error);
        res.status(500).json({ success: false, message: 'Failed to create pricing plan' });
    }
};

export const updatePricingPlan = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = partialWithoutDefaults(pricingPlanSchema).parse(req.body);
        const existing = await prisma.pricingPlan.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Pricing plan not found' });
        }

        const priceError = originalPriceError(
            data.price ?? Number(existing.price),
            data.originalPrice !== undefined
                ? data.originalPrice
                : existing.originalPrice === null ? null : Number(existing.originalPrice),
        );
        if (priceError) {
            return res.status(400).json({ success: false, message: priceError });
        }

        // App Store subscribers are matched to their plan by this ID on every
        // renewal; changing it would leave them without access while Apple bills them.
        const changesAppleProduct = data.appleProductId !== undefined
            && (data.appleProductId ?? null) !== existing.appleProductId;
        if (changesAppleProduct && existing.appleProductId) {
            const appStoreSubscribers = await prisma.subscriptionPayment.count({
                where: { pricingPlanId: id, method: 'app_store' },
            });
            if (appStoreSubscribers > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'This plan has App Store subscribers, so its App Store product ID cannot change. Create a new plan for a new product instead.',
                });
            }
        }

        const plan = await prisma.pricingPlan.update({ where: { id }, data });
        res.json({ success: true, data: plan });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
            });
        }
        if (isDuplicateAppleProductId(error)) {
            return res.status(409).json({ success: false, message: DUPLICATE_APPLE_PRODUCT });
        }
        console.error('Error updating pricing plan:', error);
        res.status(500).json({ success: false, message: 'Failed to update pricing plan' });
    }
};

export const deletePricingPlan = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = await prisma.pricingPlan.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({ success: true, data: plan, message: 'Pricing plan archived' });
    } catch (error) {
        console.error('Error deleting pricing plan:', error);
        res.status(500).json({ success: false, message: 'Failed to delete pricing plan' });
    }
};
