import { Router } from 'express';
import {
    addFavoriteMeditation,
    checkFavoriteMeditation,
    getUserFavoriteMeditations,
    removeFavoriteMeditation
} from '../controllers/userFavoriteMeditationController.js';
import authenticate from '../middleware/authenticate.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';
import { validateBody } from '../middleware/validateRequest.js';
import { favoriteMeditationBody } from '../validators/trackingSchemas.js';

const router = Router();

// GET /api/favorite-meditations - Get authenticated user's favorite meditations
router.get('/', authenticate, requireActiveLicense, getUserFavoriteMeditations);

// GET /api/favorite-meditations/user/:userId - Get user's favorite meditations
router.get('/user/:userId', authenticate, requireActiveLicense, getUserFavoriteMeditations);

// GET /api/favorite-meditations/check/:userId/:sessionId - Check if meditation is favorited
router.get('/check/:userId/:sessionId', authenticate, requireActiveLicense, checkFavoriteMeditation);

// POST /api/favorite-meditations - Add meditation to favorites
router.post('/', authenticate, requireActiveLicense, validateBody(favoriteMeditationBody), addFavoriteMeditation);

// DELETE /api/favorite-meditations/:id - Remove meditation from favorites
router.delete('/:id', authenticate, requireActiveLicense, removeFavoriteMeditation);

export default router;
