import { NextFunction, Request, Response } from 'express';

/**
 * Many controllers answer a 500 with `{ message, error: error.message }`, which
 * can expose Prisma, schema or library internals. In production, drop that raw
 * `error` string from 5xx bodies; the full error is still logged server-side.
 */
const hideInternalErrors = (_req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production') return next();

  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      const { error: _internal, ...safeBody } = body as Record<string, unknown>;
      return json(safeBody);
    }
    return json(body);
  };
  next();
};

export default hideInternalErrors;
