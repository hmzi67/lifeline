import { Router } from 'express';
import {
  createMeditation,
  getMeditations,
  getMeditationById,
  updateMeditation,
  deleteMeditation,
  getMeditationsByType
} from '../controllers/meditationController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';

const router = Router();

// Meditation responses include playable media URLs and are VIP-only.
router.get('/', authenticate, requireActiveLicense, getMeditations);
router.get('/type/:type', authenticate, requireActiveLicense, getMeditationsByType);
router.get('/:id', authenticate, requireActiveLicense, getMeditationById);

// Protected routes (require authentication for admin operations)
router.post('/', authenticate, authorize(['admin']), createMeditation);
router.put('/:id', authenticate, authorize(['admin']), updateMeditation);
router.delete('/:id', authenticate, authorize(['admin']), deleteMeditation);

export default router;
