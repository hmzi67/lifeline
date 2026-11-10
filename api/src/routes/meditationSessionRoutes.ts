import { Router } from 'express';
import {
    createMeditationSession,
    deleteMeditationSession,
    getMeditationSessionById,
    getMeditationSessions,
    updateMeditationSession
} from '../controllers/meditationSessionController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';
import { validateBody } from '../middleware/validateRequest.js';
import { meditationSessionBody } from '../validators/contentSchemas.js';

const router = Router();

// GET /api/meditation-sessions/meditation/:meditationId - Get all sessions for a meditation
router.get('/meditation/:meditationId', authenticate, requireActiveLicense, getMeditationSessions);

// GET /api/meditation-sessions/:id - Get session by ID
router.get('/:id', authenticate, requireActiveLicense, getMeditationSessionById);

// POST /api/meditation-sessions - Create meditation session
router.post('/', authenticate, authorize(['admin']), validateBody(meditationSessionBody), createMeditationSession);

// PUT /api/meditation-sessions/:id - Update meditation session
router.put('/:id', authenticate, authorize(['admin']), validateBody(meditationSessionBody), updateMeditationSession);

// DELETE /api/meditation-sessions/:id - Delete meditation session
router.delete('/:id', authenticate, authorize(['admin']), deleteMeditationSession);

export default router;
