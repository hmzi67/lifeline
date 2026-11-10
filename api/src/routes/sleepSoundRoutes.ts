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
import { validateBody } from '../middleware/validateRequest.js';
import { sleepSoundBody } from '../validators/contentSchemas.js';

const router = Router();

router.get('/', authenticate, requireActiveLicense, getSleepSounds);
router.get('/:id', authenticate, requireActiveLicense, getSleepSoundById);
router.post('/', authenticate, authorize(['admin']), validateBody(sleepSoundBody), createSleepSound);
router.put('/:id', authenticate, authorize(['admin']), validateBody(sleepSoundBody), updateSleepSound);
router.delete('/:id', authenticate, authorize(['admin']), deleteSleepSound);

export default router;
