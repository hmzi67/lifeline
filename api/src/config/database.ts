import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import {NextFunction, Request, Response} from "express";


// The one Prisma client for the whole API: import this rather than constructing another,
// since each client opens its own connection pool. Size the pool with connection_limit
// (and pool_timeout) on DATABASE_URL.
export const prisma = new PrismaClient();

// Public contract marker lets deployment checks reject an older API artifact.
export const API_CONTRACT_VERSION = '2026-10-24.routines-weight.v1';

// Database connection function
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Graceful disconnect
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Database disconnection failed:', error);
    throw error;
  }
};

export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    const healthStatus = {
      status: 'healthy',
      apiContract: API_CONTRACT_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      },
      version: process.env.APP_VERSION || '1.0.0'
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    const healthStatus = {
      status: 'unhealthy',
      apiContract: API_CONTRACT_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        server: 'running'
      },
      version: process.env.APP_VERSION || '1.0.0'
    };

    res.status(503).json(healthStatus);
  }
};
