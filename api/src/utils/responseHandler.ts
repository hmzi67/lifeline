import { Response } from 'express';

// Custom error class for application errors
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Standardized response format
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

// Success response handler
export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message: string = ''
): Response<ApiResponse<T>> => {
  const response: ApiResponse<T> = {
    success: statusCode >= 200 && statusCode < 300,
    data,
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

// Error response handler
export const handleError = (error: any, res: Response): void => {
  console.error('Error:', error);

  // Handle known error types
  if (error instanceof AppError) {
    const { statusCode, message } = error;
    sendResponse(res, statusCode, { error: message }, message);
    return;
  }

  // Handle validation errors (e.g., from Zod)
  if (error.name === 'ZodError') {
    const errors = error.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    sendResponse(res, 400, { errors }, 'Validation Error');
    return;
  }

  // Handle Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        sendResponse(
          res,
          409,
          { error: 'Duplicate entry' },
          'A record with this data already exists'
        );
        return;
      case 'P2025':
        sendResponse(res, 404, { error: 'Not found' }, 'Record not found');
        return;
      // Add more Prisma error codes as needed
    }
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  sendResponse(
    res,
    statusCode,
    { error: message },
    process.env.NODE_ENV === 'development' ? error.stack : message
  );
};
