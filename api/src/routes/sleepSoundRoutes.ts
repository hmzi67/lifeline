import { Router } from 'express';
import {
  createSleepSound,
  getSleepSounds,
  getSleepSoundById,
  updateSleepSound,
  deleteSleepSound,
} from '../controllers/sleepSoundController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';

const router = Router();

router.get('/', authenticate, requireActiveLicense, getSleepSounds);
router.get('/:id', authenticate, requireActiveLicense, getSleepSoundById);
router.post('/', authenticate, authorize(['admin']), createSleepSound);
router.put('/:id', authenticate, authorize(['admin']), updateSleepSound);
router.delete('/:id', authenticate, authorize(['admin']), deleteSleepSound);

export default router;
