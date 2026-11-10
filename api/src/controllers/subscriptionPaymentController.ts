import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const prisma = new PrismaClient();

const createPaymentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planName: z.string().min(1, 'Plan name is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  method: z.string().min(1, 'Payment method is required')
}).strict();

const updatePaymentSchema = z.object({
  planName: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  method: z.string().min(1).optional()
}).strict();

// Get all subscription payments with pagination
export const getAllSubscriptionPayments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.subscriptionPayment.count()
    ]);

    res.status(200).json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching subscription payments:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching subscription payments'
    });
  }
};

// Get a single subscription payment by ID
export const getSubscriptionPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID format (assuming UUID)
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Subscription payment not found' });
    }

    res.status(200).json(payment);
  } catch (error) {
    console.error('Error fetching subscription payment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching subscription payment'
    });
  }
};

// Create a new subscription payment
export const createSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = createPaymentSchema.parse(req.body);

    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id: validatedData.userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        userId: validatedData.userId,
        planName: validatedData.planName,
        amount: validatedData.amount,
        method: validatedData.method,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating subscription payment:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating subscription payment'
    });
  }
};

// Update a subscription payment
export const updateSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    // Validate request body
    const validatedData = updatePaymentSchema.parse(req.body);

    // Check if payment exists
    const existingPayment = await prisma.subscriptionPayment.findUnique({
      where: { id }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Subscription payment not found' });
    }

    // Only update fields that are provided
    const updateData: any = {};
    if (validatedData.planName !== undefined) updateData.planName = validatedData.planName;
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.method !== undefined) updateData.method = validatedData.method;

    const payment = await prisma.subscriptionPayment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(200).json(payment);
  } catch (error) {
    console.error('Error updating subscription payment:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating subscription payment'
    });
  }
};

// Delete a subscription payment
export const deleteSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    // Check if payment exists
    const existingPayment = await prisma.subscriptionPayment.findUnique({
      where: { id }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Subscription payment not found' });
    }

    await prisma.subscriptionPayment.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting subscription payment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error deleting subscription payment'
    });
  }
};

// Get all payments for a specific user with pagination
export const getPaymentsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [paymentRecords, total] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.subscriptionPayment.count({
        where: { userId }
      })
    ]);
    const now = new Date();
    const payments = paymentRecords.map((payment) => ({
      ...payment,
      isEntitled:
        ['COMPLETED', 'TRIALING'].includes((payment.status || '').toUpperCase())
        && !!payment.currentPeriodEnd
        && payment.currentPeriodEnd > now,
    }));

    res.status(200).json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user subscription payments:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching user subscription payments'
    });
  }
};

// Get payments for the authenticated user. The user ID always comes from the
// verified token rather than a caller-controlled path or request body.
export const getMySubscriptionPayments = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.params.userId = userId;
  return getPaymentsByUserId(req, res);
};

// Gracefully close Prisma connection
export const closePrismaConnection = async () => {
  await prisma.$disconnect();
};
