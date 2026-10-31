import express from 'express';
import 'express-async-errors';
import session from 'express-session';
import { healthCheck, prisma } from './config/database.js';
import { config } from './config/index.js';
import passport from './config/passport.js';
import {
  compression,
  cors,
  errorHandler,
  helmet,
  notFound,
  rateLimiter,
  requestLogger,
  timeout,
} from './middleware/index.js';
import { appleAuthCallback } from './controllers/authController.js';
import authRoute from './routes/authRoute.js';
import questionnaireRoutes from './routes/questionnaireRoutes.js';
// @ts-ignore - The compiler couldn't find the bundled type declarations for this package on your server
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { handleStripeWebhook } from './controllers/paymentController.js';
import { serveUploads } from './middleware/upload.js';
import hideInternalErrors from './middleware/hideInternalErrors.js';
import appSetttingsRoutes from './routes/appSettingRoutes.js';
import blogsRoutes from './routes/blogRoutes.js';
import challengeExerciseRouter from './routes/challengeExerciseRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import cheatDayRoutes from './routes/cheatDayRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import dietMealLogRoutes from './routes/dietMealLogRoutes.js';
import dietPlanDayRoutes from './routes/dietPlanDayRoutes.js';
import dietPlanMealRoutes from './routes/dietPlanMealRoutes.js';
import dietPlanRoutes from './routes/dietPlanRoutes.js';
import exerciseDetailRoutes from './routes/exerciseDetailRoutes.js';
import exercisePlanRoutes from './routes/exercisePlanRoutes.js';
import exercisePlanScheduleRoutes from './routes/exercisePlanScheduleRoutes.js';
import exercisePlanWeekRoutes from './routes/exercisePlanWeekRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import fastingRoutes from './routes/fastingLogRoutes.js';
import foodScanRoutes from './routes/foodScanRoutes.js';
import foodLogRoutes from './routes/foodLogRoutes.js';
import weightLogRoutes from './routes/weightLogRoutes.js';
import inAppPurchaseRoutes from './routes/inAppPurchaseRoutes.js';
import mealTypeRoutes from './routes/mealTypeRoutes.js';
import medicationReminderRoutes from './routes/medicationReminderRoutes.js';
import medicationRoutes from './routes/medicationRoutes.js';
import meditationRoutes from './routes/meditationRoutes.js';
import meditationSessionRoutes from './routes/meditationSessionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import onboardingProgressRoutes from './routes/onboardingProgressRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import sleepRoutes from './routes/sleepLogRoutes.js';
import sleepSoundRoutes from './routes/sleepSoundRoutes.js';
import sleepStoryRoutes from './routes/sleepStoryRoutes.js';
import subscriptionPaymentRoutes from './routes/subscriptionPaymentRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import pricingPlanRoutes from './routes/pricingPlanRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userActiveDietPlanRoutes from './routes/userActiveDietPlanRoutes.js';
import userActiveExercisePlanRoutes from './routes/userActiveExercisePlanRoutes.js';
import userDailyRoutes from './routes/userDailyRoutineRoutes.js';
import userDietPlanRoutes from './routes/userDietPlanRoutes.js';
import userExerciseRoutes from './routes/userExerciseRoutes.js';
import userExerciseProgressRoutes from './routes/userExerciseProgressRoutes.js';
import warmupRoutes from './routes/warmupRoutes.js';
import userFavoriteMeditationRoutes from './routes/userFavoriteMeditationRoutes.js';
import userFavoriteExercisePlanRoutes from './routes/userFavoriteExercisePlanRoutes.js';
import meditationLogRoutes from './routes/meditationLogRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import userRoute from './routes/userRoutes.js';
import userWaterGoalRoutes from './routes/userWaterGoalRoutes.js';
import waterIntakeRoutes from './routes/waterIntakeRoutes.js';

const app = express();

// Apple form-POSTs Sign in with Apple results from https://appleid.apple.com,
// which the CORS allowlist would reject, so this route is mounted before CORS.
app.post('/api/auth/apple/callback', express.urlencoded({ extended: false, limit: '64kb' }), appleAuthCallback);
app.use(cors);
app.set('trust proxy', 1);
// Security middlewares (should be first)
app.use(helmet);
app.use(hideInternalErrors);

// Request processing middlewares
app.use(compression);
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
// Only the routes that take base64 images in JSON get large bodies; the first
// parser to run on a request wins, so these must come before the default.
app.use('/api/food-scan', express.json({ limit: '30mb' }));
app.use('/api/user', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', ...serveUploads());

// Session middleware for Passport
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use(requestLogger);

// Rate limiting
app.use(rateLimiter);

// Request timeout
app.use(timeout(30000)); // 30-second timeout

// Health check route (should be before authentication)
app.get('/health', healthCheck);
// Keep the deployment probe behind the same /api reverse-proxy path as clients.
app.get('/api/health', healthCheck);

// route for authentication
app.use('/api/auth/', authRoute);

// Admin dashboard route
app.use('/api/admin/dashboard', adminDashboardRoutes);

// media upload route
app.use('/api/uploads', uploadRoutes);

// User routes
app.use('/api/user/', userRoute);

// questionnaire route
app.use('/api/questionnaire', questionnaireRoutes);

// Backend-owned onboarding resume state
app.use('/api/onboarding-progress', onboardingProgressRoutes);

// subscription payment routes
app.use('/api/subscription-payments', subscriptionPaymentRoutes);

// Backend-owned subscription entitlement status
app.use('/api/subscription', subscriptionRoutes);

// pricing plan routes
app.use('/api/pricing-plans', pricingPlanRoutes);

// payment routes (Stripe)
app.use('/api/payments', paymentRoutes);

// App Store subscriptions (StoreKit 2 transactions verified with Apple)
app.use('/api/iap', inAppPurchaseRoutes);

// Food scanner route
app.use('/api/food-scan', foodScanRoutes);
app.use('/api/food-logs', foodLogRoutes);
app.use('/api/weight-logs', weightLogRoutes);

// diet plan routes
app.use('/api/diet-plans', dietPlanRoutes);
app.use('/api/user-diet-plans', userDietPlanRoutes);

// Exercise routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/user-exercises', userExerciseRoutes);

// Challenge routes
app.use('/api/challenges', challengeRoutes);
app.use('/api/challenge-exercises', challengeExerciseRouter); // exercises for a challenge to user

// fasting routes
app.use('/api/fasting-logs', fastingRoutes);

// sleeping routes
app.use('/api/sleep-logs', sleepRoutes);
app.use('/api/sleep-stories', sleepStoryRoutes);
app.use('/api/sleep-sounds', sleepSoundRoutes);

// Water intake routes
app.use('/api/water-intake', waterIntakeRoutes);

// Medication routes
app.use('/api/medications', medicationRoutes);

// Meditation routes
app.use('/api/meditations', meditationRoutes);

// app settings routes
app.use('/api/app-settings', appSetttingsRoutes);

// user daily routines routes
app.use('/api/user-daily-routines', userDailyRoutes);

// adding blogs routes
app.use('/api/blogs', blogsRoutes);

// Diet plan structure routes
app.use('/api/meal-types', mealTypeRoutes);
app.use('/api/diet-plan-days', dietPlanDayRoutes);
app.use('/api/diet-plan-meals', dietPlanMealRoutes);
app.use('/api/diet-meal-logs', dietMealLogRoutes);

// Exercise plan structure routes
app.use('/api/exercise-plans', exercisePlanRoutes);
app.use('/api/exercise-plan-weeks', exercisePlanWeekRoutes);
app.use('/api/exercise-plan-schedules', exercisePlanScheduleRoutes);
app.use('/api/exercise-details', exerciseDetailRoutes);
app.use('/api/user-exercise-progress', userExerciseProgressRoutes);
app.use('/api/warmup', warmupRoutes);

// Active plan routes
app.use('/api/active-diet-plans', userActiveDietPlanRoutes);
app.use('/api/active-exercise-plans', userActiveExercisePlanRoutes);

// Meditation session routes
app.use('/api/meditation-sessions', meditationSessionRoutes);
app.use('/api/favorite-meditations', userFavoriteMeditationRoutes);
app.use('/api/favorite-exercise-plans', userFavoriteExercisePlanRoutes);
app.use('/api/meditation-logs', meditationLogRoutes);

// Water goal routes
app.use('/api/water-goals', userWaterGoalRoutes);

// Medication reminder routes
app.use('/api/medication-reminders', medicationReminderRoutes);

// Cheat day routes
app.use('/api/cheat-days', cheatDayRoutes);

// Role routes
app.use('/api/roles', roleRoutes);

// Progress / Stats routes (aggregation endpoints)
app.use('/api/progress', progressRoutes);

// Coupon routes (admin CRUD + user validate)
app.use('/api/coupons', couponRoutes);

// Referral code routes (admin CRUD + user validate)
app.use('/api/referral-codes', referralRoutes);

// Notification inbox
app.use('/api/notifications', notificationRoutes);

// Example protected route
// app.get('/api/protected', authenticate, (req, res) => {
//     res.json({ message: 'This is a protected route', user: req });
// });

// Example role-based route
// app.get('/api/admin', authenticate, authorize(['admin']), (req, res) => {
//     res.json({ message: 'Admin only content' });
// });

// Handler 404 (should be after all routes)
app.use(notFound);

// Error handling middleware (should be last)
app.use(errorHandler);

export default app;
