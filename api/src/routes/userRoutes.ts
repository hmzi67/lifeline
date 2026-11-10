import { NextFunction, Request, Response, Router } from 'express';
import {
    createUser,
    deleteOwnAccount,
    deleteUser,
    exportOwnData,
    getAllUsers,
    getCurrentUser,
    getUserSettings,
    getUserStats,
    getUserWithRelations,
    registerPushToken,
    updateOwnProfile,
    updateUser,
    updateUserSettings,
} from '../controllers/userController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { imageUpload, mediaUpload, getMediaCategory } from '../middleware/upload.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { validateBody } from '../middleware/validateRequest.js';
import { adminUserBody, deleteAccountBody, ownProfileBody, pushTokenBody, userSettingsBody } from '../validators/accountSchemas.js';

const userRoute = Router();

// Middleware to ensure a user can only modify their own profile
const checkProfileOwnership = (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as AuthenticatedRequest).user;
    if (authUser && req.params.id !== authUser.id) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only modify your own profile',
        });
    }
    next();
};

// Regular user routes
userRoute.get('/profile', authenticate, getCurrentUser);
userRoute.put('/profile/:id', authenticate, checkProfileOwnership, imageUpload.single('file'), validateBody(ownProfileBody), updateOwnProfile);
userRoute.delete('/profile/:id', authenticate, checkProfileOwnership, validateBody(deleteAccountBody), deleteOwnAccount);
// Self-service account deletion — requires password (or the typed phrase for Google/Apple accounts) in the body
userRoute.delete('/account', authenticate, validateBody(deleteAccountBody), deleteOwnAccount);
userRoute.get('/export', authenticate, exportOwnData);
userRoute.get('/settings', authenticate, getUserSettings);
userRoute.put('/settings', authenticate, validateBody(userSettingsBody), updateUserSettings);
userRoute.post('/push-token', authenticate, validateBody(pushTokenBody), registerPushToken);

// Admin-only routes
userRoute.get('/admin/users', authenticate, authorize(['admin']), getAllUsers);
userRoute.get('/admin/stats', authenticate, authorize(['admin']), getUserStats);
userRoute.get('/admin/users/:id', authenticate, authorize(['admin']), getUserWithRelations);
userRoute.put('/admin/users/:id', authenticate, authorize(['admin']), mediaUpload.single('file'), validateBody(adminUserBody), updateUser);
userRoute.post('/admin/users', authenticate, authorize(['admin']), validateBody(adminUserBody), createUser);
userRoute.delete('/admin/users/:id', authenticate, authorize(['admin']), deleteUser);

export default userRoute;
