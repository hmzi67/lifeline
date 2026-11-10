import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  PORT: z.string().transform(Number).default(3000),
  HOST: z.string().default('localhost'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  SESSION_SECRET: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().transform(Number).optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  UPLOAD_PATH: z.string().default('uploads/'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  BCRYPT_ROUNDS: z.string().transform(Number).default(12),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/app.log'),
});

// Validate environment variables
const env = envSchema.parse(process.env);

// Signs the express-session cookie (Google OAuth state and PKCE verifier).
// Without SESSION_SECRET, derive a distinct key from the validated JWT secret
// rather than falling back to a value anyone can read in the source.
const sessionSecret =
  env.SESSION_SECRET ?? createHmac('sha256', env.JWT_SECRET).update('lifeline-express-session').digest('hex');

export const config = {
  port: env.PORT,
  host: env.HOST,
  databaseUrl: env.DATABASE_URL,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  sessionSecret,
  corsOrigin: env.CORS_ORIGIN,
  smtp: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
  upload: {
    path: env.UPLOAD_PATH,
  },
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  bcryptRounds: env.BCRYPT_ROUNDS,
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
} as const;
