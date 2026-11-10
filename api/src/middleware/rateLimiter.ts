import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/index.js';

const rateLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
    max: config.rateLimitMaxRequests || 1000,
    message: {
        success: false,
        error: {
            message: 'Too many requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                message: 'Too many requests from this IP, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });
    }
});

export default rateLimiter;