import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

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
