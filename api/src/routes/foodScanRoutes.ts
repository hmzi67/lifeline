import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { scanFood } from '../controllers/foodScanController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { foodScanBody } from '../validators/trackingSchemas.js';

const router = Router();

const foodScanRateLimiter = rateLimit({
  windowMs: Number(process.env.FOOD_SCAN_RATE_LIMIT_WINDOW_MS || 60_000),
  limit: Number(process.env.FOOD_SCAN_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.id || 'anonymous',
  handler: (_req, res) => {
    res.status(429).json({
      error_code: 'rate_limit',
      message: 'Too many requests. Try again in a moment.',
    });
  },
});

router.post('/', authenticate, foodScanRateLimiter, validateBody(foodScanBody), scanFood);

export default router;
