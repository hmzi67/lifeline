import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../types/middlewareTypes.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

class AppError extends Error implements CustomError {
    statusCode: number;
    isOperational: boolean;
    code?: string;
    details?: any;

    constructor(message: string, statusCode: number, code?: string, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.code = code;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

const handlePrismaError = (error: PrismaClientKnownRequestError): AppError => {
    switch (error.code) {
        case 'P2002':
            return new AppError(
                'Duplicate entry. Resource already exists.',
                409,
                'DUPLICATE_ENTRY',
                { field: error.meta?.target }
            );
        case 'P2025':
            return new AppError(
                'Resource not found.',
                404,
                'NOT_FOUND',
                { operation: error.meta?.cause }
            );
        case 'P2003':
            return new AppError(
                'Foreign key constraint failed.',
                400,
                'FOREIGN_KEY_CONSTRAINT',
                { field: error.meta?.field_name }
            );
        default:
            return new AppError('Database operation failed.', 500, 'DATABASE_ERROR');
    }
};

const sendErrorDev = (err: CustomError, res: Response) => {
    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            message: err.message,
            code: err.code,
            details: err.details,
            stack: err.stack
        }
    });
};

const sendErrorProd = (err: CustomError, res: Response) => {
    if (err.isOperational) {
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message,
                code: err.code,
                details: err.details
            }
        });
    } else {
        console.error('ERROR 💥', err);
        res.status(500).json({
            success: false,
            error: {
                message: 'Something went wrong!',
                code: 'INTERNAL_SERVER_ERROR'
            }
        });
    }
};

const errorHandler = (
    err: Error | CustomError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let error = { ...err } as CustomError;
    error.message = err.message;

    // Handle Prisma errors
    if (err instanceof PrismaClientKnownRequestError) {
        error = handlePrismaError(err);
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        error = new AppError(err.message, 400, 'VALIDATION_ERROR');
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    if (err.name === 'TokenExpiredError') {
        error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    }

    // Set default values
    error.statusCode = error.statusCode || 500;
    // Client errors raised by Express middleware (e.g. 413 body too large) are safe to report as-is.
    error.isOperational = error.isOperational || ((err as any).expose === true && error.statusCode < 500);

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(error, res);
    } else {
        sendErrorProd(error, res);
    }
};

export default errorHandler;
export { AppError };