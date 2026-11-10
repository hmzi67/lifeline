import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { handleChallengePaymentIntent } from '../services/challengePaymentService.js';
import { applyDiscount, CouponError, findUsableCoupon, recordCouponUsage } from '../services/couponService.js';
import { findActiveAppStoreLicense } from '../services/subscriptionAccessService.js';

let stripeClient: Stripe | null = null;

// Card errors ("Your card was declined.") are written for the payer; any other error text
// can expose configuration (price or customer IDs), so it stays in the server log.
const userFacingStripeMessage = (error: unknown) =>
  error instanceof Stripe.errors.StripeCardError ? error.message : null;

export const getStripeClient = (): Stripe | null => {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });

  return stripeClient;
};

// Validation schemas
const createSubscriptionSchema = z.object({
  pricingPlanId: z.string().min(1, 'Pricing plan ID is required'),
  couponCode: z.string().trim().min(1).optional(),
});

// Stripe's minimum charge in USD.
export const MIN_CARD_CHARGE = 0.5;

const confirmSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

const getSubscriptionPaymentIntent = (subscription: Stripe.Subscription): Stripe.PaymentIntent | null => {
  const invoice = (subscription as any).latest_invoice;
  const paymentIntent = invoice?.payment_intent;
  if (!paymentIntent || typeof paymentIntent === 'string') return null;
  return paymentIntent as Stripe.PaymentIntent;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const getSubscriptionClientSecret = (subscription: Stripe.Subscription): string | null => {
  const invoice = (subscription as any).latest_invoice;
  const confirmationSecret = invoice?.confirmation_secret;
  const paymentIntent = getSubscriptionPaymentIntent(subscription);

  if (confirmationSecret?.client_secret) return confirmationSecret.client_secret;
  return paymentIntent?.client_secret || null;
};

const getCurrentPeriodEnd = (subscription: Stripe.Subscription): Date | null => {
  const periodEnd = (subscription as any).current_period_end;
  return typeof periodEnd === 'number' ? new Date(periodEnd * 1000) : null;
};

const getOrCreateStripeCustomer = async (stripe: Stripe, userId: string): Promise<string> => {
  const existingPayment = await prisma.subscriptionPayment.findFirst({
    where: {
      userId,
      stripeCustomerId: { not: null },
    } as any,
    orderBy: { createdAt: 'desc' },
  });

  const existingCustomerId = (existingPayment as any)?.stripeCustomerId;
  if (existingCustomerId) return existingCustomerId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.username || undefined,
    metadata: { userId },
  });

  return customer.id;
};

const getWalletPaymentMethod = async (
  stripe: Stripe,
  paymentMethod: string | Stripe.PaymentMethod | null,
): Promise<{ id?: string; method: 'apple_pay' | 'stripe' }> => {
  if (!paymentMethod) return { method: 'stripe' };

  const paymentMethodId = typeof paymentMethod === 'string' ? paymentMethod : paymentMethod.id;

  try {
    const details = typeof paymentMethod === 'string'
      ? await stripe.paymentMethods.retrieve(paymentMethod)
      : paymentMethod;
    const isApplePay = details.type === 'card'
      && details.card?.wallet?.type === 'apple_pay';

    return {
      id: paymentMethodId,
      method: isApplePay ? 'apple_pay' : 'stripe',
    };
  } catch (error) {
    // Payment completion must not be blocked by a transient metadata lookup.
    console.warn('Unable to identify Stripe wallet type:', error);
    return { id: paymentMethodId, method: 'stripe' };
  }
};

const finalizePaidAccess = async (
  stripe: Stripe,
  paymentId: string,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> => {
  const paymentMethod = await getWalletPaymentMethod(stripe, paymentIntent.payment_method);

  await prisma.$transaction(async tx => {
    const payment = await tx.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment?.userId) return;

    const expiresAt = payment.currentPeriodEnd
      || addMonths(new Date(), payment.durationMonths || 1);

    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        method: paymentMethod.method,
        stripePaymentMethodId: paymentMethod.id,
        currentPeriodEnd: expiresAt,
      },
    });

    const license = await tx.userLicense.findFirst({
      where: { paymentId: payment.id, userId: payment.userId },
    });

    if (license) {
      if (!license.expiresAt || license.expiresAt < expiresAt) {
        await tx.userLicense.update({
          where: { id: license.id },
          data: { expiresAt },
        });
      }
    } else {
      await tx.userLicense.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          createdAt: new Date(),
          expiresAt,
        },
      });
    }

    if (paymentIntent.metadata?.couponCode) {
      await recordCouponUsage(tx, paymentIntent.metadata.couponCode, payment.userId, payment.id);
    }
  });
};

const finalizeTrialAccess = async (
  stripe: Stripe,
  paymentId: string,
  setupIntent: Stripe.SetupIntent,
): Promise<void> => {
  const paymentMethod = await getWalletPaymentMethod(stripe, setupIntent.payment_method);

  await prisma.$transaction(async tx => {
    const payment = await tx.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment?.userId) return;

    const existingLicense = await tx.userLicense.findFirst({
      where: { paymentId: payment.id, userId: payment.userId },
    });

    if (payment.status !== 'TRIALING') {
      const trialClaim = await tx.user.updateMany({
        where: { id: payment.userId, trialUsedAt: null },
        data: { trialUsedAt: new Date() },
      });

      if (trialClaim.count !== 1) {
        throw new Error('Free trial has already been used');
      }
    }

    const expiresAt = payment.currentPeriodEnd || new Date();
    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'TRIALING',
        method: paymentMethod.method,
        stripePaymentMethodId: paymentMethod.id,
      },
    });

    if (existingLicense) {
      if (!existingLicense.expiresAt || existingLicense.expiresAt < expiresAt) {
        await tx.userLicense.update({
          where: { id: existingLicense.id },
          data: { expiresAt },
        });
      }
    } else {
      await tx.userLicense.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          createdAt: new Date(),
          expiresAt,
        },
      });
    }

    if (setupIntent.metadata?.couponCode) {
      await recordCouponUsage(tx, setupIntent.metadata.couponCode, payment.userId, payment.id);
    }
  });
};

/**
 * Create a Stripe Payment Intent
 */
/**
 * Create a direct Stripe intent using the server-side pricing plan.
 *
 * The route name is retained for mobile compatibility, but this does not create
 * a Stripe Billing Subscription.
 */
export const createSubscription = async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Set STRIPE_SECRET_KEY to enable payments',
      });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { pricingPlanId, couponCode: requestedCoupon } = createSubscriptionSchema.parse(req.body);
    const [plan, user] = await Promise.all([
      prisma.pricingPlan.findFirst({
        where: { id: pricingPlanId, isActive: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, trialUsedAt: true },
      }),
    ]);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Pricing plan is inactive or no longer available',
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Apple bills App Store subscribers; a Stripe checkout would charge twice.
    if (await findActiveAppStoreLicense(userId)) {
      return res.status(409).json({
        success: false,
        message: 'Your VIP subscription is billed through the App Store. Manage it from your Apple ID subscription settings.',
      });
    }

    // The price always comes from the plan; a coupon is checked here, never trusted from the client.
    let price = Number(plan.price);
    let couponCode: string | undefined;
    if (requestedCoupon) {
      const coupon = await findUsableCoupon(prisma, requestedCoupon, userId);
      price = applyDiscount(price, coupon.discountPercent);
      couponCode = coupon.code;
    }
    if (price < MIN_CARD_CHARGE) {
      return res.status(400).json({
        success: false,
        message: 'This coupon cannot be used for card checkout. Please contact support.',
      });
    }

    const customerId = await getOrCreateStripeCustomer(stripe, userId);
    const metadata = {
      userId,
      pricingPlanId: plan.id,
      planName: plan.name,
      durationMonths: String(plan.durationMonths),
      ...(couponCode ? { couponCode } : {}),
    };
    const trialEligible = plan.trialDays > 0 && !user.trialUsedAt;
    const trialEndsAt = trialEligible
      ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    if (trialEligible) {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        // Card only: renewals charge the saved method off-session, which wallets like Cash App Pay don't reliably support.
        payment_method_types: ['card'],
        metadata,
      });

      if (!setupIntent.client_secret) {
        return res.status(500).json({
          success: false,
          message: 'Stripe did not return a client secret for this trial',
        });
      }

      const payment = await prisma.subscriptionPayment.create({
        data: {
          userId,
          pricingPlanId: plan.id,
          planName: plan.name,
          durationMonths: plan.durationMonths,
          amount: price,
          method: 'stripe',
          status: 'SETUP_PENDING',
          createdAt: new Date(),
          stripeCustomerId: customerId,
          stripeSetupIntentId: setupIntent.id,
          currentPeriodEnd: trialEndsAt,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          intentType: 'setup',
          clientSecret: setupIntent.client_secret,
          paymentIntentId: '',
          subscriptionId: payment.id,
          customerId,
        },
        message: 'Trial setup created successfully',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: 'usd',
      customer: customerId,
      setup_future_usage: 'off_session',
      // Card only: renewals charge the saved method off-session, which wallets like Cash App Pay don't reliably support.
      payment_method_types: ['card'],
      metadata,
    });

    if (!paymentIntent.client_secret) {
      return res.status(500).json({
        success: false,
        message: 'Stripe did not return a client secret for this payment',
      });
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        userId,
        pricingPlanId: plan.id,
        planName: plan.name,
        durationMonths: plan.durationMonths,
        amount: price,
        method: 'stripe',
        status: 'PENDING',
        createdAt: new Date(),
        stripeCustomerId: customerId,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        intentType: 'payment',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        subscriptionId: payment.id,
        customerId,
      },
      message: 'Payment created successfully',
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);

    if (error instanceof CouponError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({
      success: false,
      message: userFacingStripeMessage(error) || 'Failed to create subscription',
    });
  }
};

/**
 * Confirm a direct PaymentIntent or SetupIntent and grant time-limited access.
 */
export const confirmSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Set STRIPE_SECRET_KEY to enable payments',
      });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { subscriptionId } = confirmSubscriptionSchema.parse(req.body);
    const payment = await prisma.subscriptionPayment.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    if (payment.status === 'COMPLETED' || payment.status === 'TRIALING') {
      const existingLicense = await prisma.userLicense.findFirst({
        where: { paymentId: payment.id, userId },
      });
      if (!existingLicense) {
        const expiresAt = payment.currentPeriodEnd
          || addMonths(new Date(), payment.durationMonths || 1);
        await prisma.$transaction([
          prisma.subscriptionPayment.update({
            where: { id: payment.id },
            data: { currentPeriodEnd: expiresAt },
          }),
          prisma.userLicense.create({
            data: { userId, paymentId: payment.id, createdAt: new Date(), expiresAt },
          }),
        ]);
      }
      return res.status(200).json({
        success: true,
        data: { subscriptionPaymentId: payment.id, status: payment.status },
        message: 'Payment already confirmed',
      });
    }

    if (payment.stripeSetupIntentId) {
      const setupIntent = await stripe.setupIntents.retrieve(payment.stripeSetupIntentId);
      if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method) {
        return res.status(400).json({
          success: false,
          message: 'Payment method setup has not succeeded',
        });
      }

      await finalizeTrialAccess(stripe, payment.id, setupIntent);

      return res.status(200).json({
        success: true,
        data: { subscriptionPaymentId: payment.id, status: 'TRIALING' },
        message: 'Trial activated successfully',
      });
    }

    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({ success: false, message: 'Payment intent is missing' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: 'Payment has not succeeded' });
    }

    await finalizePaidAccess(stripe, payment.id, paymentIntent);

    res.status(200).json({
      success: true,
      data: {
        subscriptionPaymentId: payment.id,
        status: 'COMPLETED',
      },
      message: 'Payment confirmed successfully',
    });
  } catch (error: any) {
    console.error('Error confirming subscription:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({
      success: false,
      message: userFacingStripeMessage(error) || 'Failed to confirm subscription',
    });
  }
};

/**
 * Charge cards saved by trial SetupIntents when their trial expires.
 * Stripe idempotency keys make this safe to retry after process restarts.
 */
export const processDueTrialCharges = async (): Promise<void> => {
  const stripe = getStripeClient();
  if (!stripe) return;

  const dueTrials = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'TRIALING',
      currentPeriodEnd: { lte: new Date() },
      stripeCustomerId: { not: null },
      stripePaymentMethodId: { not: null },
    },
    take: 100,
  });

  for (const payment of dueTrials) {
    try {
      // The user subscribed through the App Store during the trial; Apple bills
      // them now, so charging the saved card would bill them twice.
      if (payment.userId && await findActiveAppStoreLicense(payment.userId)) {
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'CANCELLED' },
        });
        continue;
      }

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(Number(payment.amount || 0) * 100),
          currency: 'usd',
          customer: payment.stripeCustomerId!,
          payment_method: payment.stripePaymentMethodId!,
          confirm: true,
          off_session: true,
          metadata: {
            userId: payment.userId || '',
            pricingPlanId: payment.pricingPlanId || '',
            subscriptionPaymentId: payment.id,
            chargeType: 'trial_conversion',
          },
        },
        { idempotencyKey: `trial-conversion-${payment.id}` },
      );

      if (paymentIntent.status !== 'succeeded') {
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PAYMENT_ACTION_REQUIRED',
            stripePaymentIntentId: paymentIntent.id,
          },
        });
        continue;
      }

      const expiresAt = addMonths(new Date(), payment.durationMonths || 1);
      await prisma.$transaction([
        prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            stripePaymentIntentId: paymentIntent.id,
            currentPeriodEnd: expiresAt,
          },
        }),
        prisma.userLicense.updateMany({
          where: { paymentId: payment.id },
          data: { expiresAt },
        }),
      ]);
    } catch (error: any) {
      console.error(`Failed to convert trial payment ${payment.id}:`, error);
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          stripePaymentIntentId: error?.payment_intent?.id,
        },
      });
    }
  }
};

/**
 * Webhook handler for Stripe events
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe not configured',
      message: 'Set STRIPE_SECRET_KEY to enable webhooks',
    });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook signature verification failed');
  }

  // Stripe redelivers events; the primary key on the event ID makes each one apply once.
  const { count: claimed } = await prisma.processedStripeEvent.createMany({
    data: [{ id: event.id, type: event.type }],
    skipDuplicates: true,
  });
  if (!claimed) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        if (await handleChallengePaymentIntent(paymentIntent)) break;
        const payment = await prisma.subscriptionPayment.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
          select: { id: true },
        });
        if (payment) await finalizePaidAccess(stripe, payment.id, paymentIntent);
        break;
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        console.log('SetupIntent succeeded:', setupIntent.id);
        const payment = await prisma.subscriptionPayment.findFirst({
          where: { stripeSetupIntentId: setupIntent.id },
          select: { id: true },
        });
        if (payment) await finalizeTrialAccess(stripe, payment.id, setupIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent failed:', failedPayment.id);
        if (await handleChallengePaymentIntent(failedPayment)) break;
        await prisma.subscriptionPayment.updateMany({
          where: { stripePaymentIntentId: failedPayment.id } as any,
          data: { status: 'FAILED' } as any,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription;
        const paymentIntentId = (invoice as any).payment_intent;

        if (typeof subscriptionId === 'string') {
          await prisma.subscriptionPayment.updateMany({
            where: { stripeSubscriptionId: subscriptionId } as any,
            data: {
              status: 'COMPLETED',
              stripePaymentIntentId: typeof paymentIntentId === 'string' ? paymentIntentId : undefined,
            } as any,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription;

        if (typeof subscriptionId === 'string') {
          await prisma.subscriptionPayment.updateMany({
            where: { stripeSubscriptionId: subscriptionId } as any,
            data: { status: 'FAILED' } as any,
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status === 'active' || subscription.status === 'trialing'
          ? 'COMPLETED'
          : subscription.status === 'canceled'
          ? 'CANCELLED'
          : 'PENDING';

        await prisma.subscriptionPayment.updateMany({
          where: { stripeSubscriptionId: subscription.id } as any,
          data: {
            status,
            currentPeriodEnd: getCurrentPeriodEnd(subscription),
            cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          } as any,
        });
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    // Release the claim so Stripe's retry of this event is processed instead of skipped.
    await prisma.processedStripeEvent.deleteMany({ where: { id: event.id } }).catch(() => undefined);
    throw error;
  }

  res.json({ received: true });
};

/**
 * Get Stripe publishable key
 */
export const getPublishableKey = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    },
    message: 'Stripe publishable key retrieved successfully',
  });
};
