import { Request, Response, NextFunction } from 'express';
import { createLogger, format, transports } from 'winston';
import { isDevelopment } from '../config/logging.js';

const logger = createLogger({
    // Production records server failures only.
    level: isDevelopment ? 'info' : 'error',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        }),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' })
    ]
});

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;

        if (!isDevelopment) {
            // No query string (it can carry tokens), IP or user agent in production logs.
            if (res.statusCode >= 500) {
                logger.error('Request failed', {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    requestId: (req as any).id
                });
            }
            return;
        }

        const logData = {
            method: req.method,
            // Path only: query strings can carry tokens, codes or emails, even in development.
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            requestId: (req as any).id
        };

        if (res.statusCode >= 400) {
            logger.error('Request failed', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

export default requestLogger;
