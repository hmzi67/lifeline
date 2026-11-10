import { Router } from 'express';
import {
    addFavoriteSleepItem,
    getFavoriteSleepItems,
    removeFavoriteSleepItem,
} from '../controllers/userFavoriteSleepItemController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { favoriteSleepItemBody } from '../validators/trackingSchemas.js';

const router = Router();

// Always the authenticated user's own favourites; like other favourites, no subscription needed.
router.use(authenticate);

// GET /api/favorite-sleep - List the caller's favourite sleep sounds and stories
router.get('/', getFavoriteSleepItems);

// POST /api/favorite-sleep - Add a sleep sound or story to favourites
router.post('/', validateBody(favoriteSleepItemBody), addFavoriteSleepItem);

// DELETE /api/favorite-sleep/:type/:itemId - Remove a sleep sound or story from favourites
router.delete('/:type/:itemId', removeFavoriteSleepItem);

export default router;
