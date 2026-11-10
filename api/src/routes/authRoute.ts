import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    appleAuth,
    appleMobileAuth,
    checkVerificationStatus,
    exchangeOAuthLoginCode,
    getCurrentUser,
    googleAuth,
    googleAuthCallback,
    googleMobileAuth,
    login,
    logout,
    refreshToken,
    requestPasswordReset,
    resendVerificationEmail,
    resetPassword,
    signup,
    verify,
} from '../controllers/authController.js';
import { validateBody } from '../middleware/validateRequest.js';
import { appleMobileBody, emailBody, googleMobileBody, oauthExchangeBody, refreshTokenBody, resetPasswordBody, verifyEmailBody } from '../validators/accountSchemas.js';

const authRoute = Router();

// Stricter rate limit for auth endpoints (5 attempts per 15 minutes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// One-time-code endpoints. Each code also locks after a few wrong guesses; this
// caps how many codes one client can request or try across accounts.
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Authentication routes
authRoute.post('/login', authLimiter, login);
authRoute.post('/signup', authLimiter, signup);
authRoute.post('/logout', validateBody(refreshTokenBody), logout);
authRoute.post('/refresh-token', validateBody(refreshTokenBody), refreshToken);
authRoute.get('/me', getCurrentUser);

// Password reset routes
authRoute.post('/request-password-reset', otpLimiter, validateBody(emailBody), requestPasswordReset);
authRoute.post('/reset-password', otpLimiter, validateBody(resetPasswordBody), resetPassword);

// Verification route
authRoute.post('/resend-verification', otpLimiter, validateBody(emailBody), resendVerificationEmail)
authRoute.post('/verify', otpLimiter, validateBody(verifyEmailBody), verify)
authRoute.get('/check-verification', checkVerificationStatus)

// OAuth routes
authRoute.get('/google', googleAuth);
authRoute.get('/google/callback', googleAuthCallback);
authRoute.post('/google/mobile', validateBody(googleMobileBody), googleMobileAuth); // Mobile Google authentication
authRoute.get('/apple', appleAuth);
// POST /apple/callback is mounted in app.ts, before CORS.
authRoute.post('/apple/mobile', authLimiter, validateBody(appleMobileBody), appleMobileAuth); // Mobile Apple authentication
authRoute.post('/oauth/exchange', otpLimiter, validateBody(oauthExchangeBody), exchangeOAuthLoginCode); // Web: single-use code from /auth/callback

export default authRoute;
