import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { verifyAccessToken } from '../utils/accessToken.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { accountAccessDenial } from '../utils/accountAccess.js';
import { isMobileAppRequest, MOBILE_ADMIN_DENIAL } from '../utils/adminRole.js';

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
    const decoded = verifyAccessToken(token) as JWTPayload;

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

    // Admin accounts manage content in the admin panel, not in the mobile app.
    if (user.role?.name === 'admin' && isMobileAppRequest(req)) {
      return res.status(403).json({ success: false, ...MOBILE_ADMIN_DENIAL });
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
    // TokenExpiredError extends JsonWebTokenError, so it must be checked first.
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN',
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
