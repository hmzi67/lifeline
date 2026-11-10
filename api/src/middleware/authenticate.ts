import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { config } from '../config/index.js';
import { accountAccessDenial } from '../utils/accountAccess.js';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token not provided',
        code: 'TOKEN_MISSING',
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Optional: Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isEmailVerified: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const denial = accountAccessDenial(user);
    if (denial) {
      return res.status(403).json({ success: false, ...denial });
    }

    // Attach user information to request object
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role ? user.role.name : '', // Ensure role is a string
      isEmailVerified: user.isEmailVerified,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN',
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      code: 'AUTHENTICATION_ERROR',
    });
  }
};

export default authenticate;
