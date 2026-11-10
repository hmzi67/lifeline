import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Many controllers answer a 500 with `{ message, error: error.message }`, which can
 * expose Prisma, schema or library internals. Outside development and test (so also
 * when NODE_ENV is unset or 'staging'), drop the raw `error` string and any `details`
 * or `stack` from 5xx bodies, and log what was dropped. The global errorHandler's own
 * `{ error: { message, code } }` objects are already safe and pass through.
 */
const hideInternalErrors = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return next();

  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === 'object') {
      const { error, details, stack, ...safeBody } = body as Record<string, unknown>;
      const keepError = error !== undefined && typeof error !== 'string';
      if (typeof error === 'string' || details !== undefined || stack !== undefined) {
        logger.error(`${req.method} ${req.path} answered ${res.statusCode}`, { error: typeof error === 'string' ? error : undefined, details, stack });
        return json(keepError ? { ...safeBody, error } : safeBody);
      }
    }
    return json(body);
  };
  next();
};

export default hideInternalErrors;
