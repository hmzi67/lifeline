import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodType } from 'zod';
import { logger } from '../utils/logger.js';

const validateRequest = (schema: ZodType) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: error.issues.map(err => ({
                            field: err.path.join('.'),
                            message: err.message
                        }))
                    }
                });
            }
            next(error);
        }
    };
};

export default validateRequest;

/**
 * Replaces req.body with the fields `schema` allows, so a handler can never write a
 * column the client was not meant to set. Unknown keys are dropped, not rejected, while
 * clients are brought in line; each drop is logged (key names only) so the endpoint can
 * move to .strict() once the log is quiet. Invalid values get a 400.
 */
export const validateBody = (schema: z.ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: parsed.error.issues[0]?.message || 'Validation failed',
            error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
            },
        });
    }
    const dropped = Object.keys(body).filter(key => !(key in schema.shape));
    if (dropped.length) {
        logger.warn(`Dropped unknown body keys on ${req.method} ${req.baseUrl}${req.route?.path ?? ''}: ${dropped.join(', ')}`);
    }
    req.body = parsed.data;
    next();
};
