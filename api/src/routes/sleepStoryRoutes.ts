import { Router } from 'express';
import {
  createSleepStory,
  getSleepStories,
  getSleepStoryById,
  updateSleepStory,
  deleteSleepStory,
} from '../controllers/sleepStoryController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import requireActiveLicense from '../middleware/requireActiveLicense.js';

const router = Router();

router.get('/', authenticate, requireActiveLicense, getSleepStories);
router.get('/:id', authenticate, requireActiveLicense, getSleepStoryById);
router.post('/', authenticate, authorize(['admin']), createSleepStory);
router.put('/:id', authenticate, authorize(['admin']), updateSleepStory);
router.delete('/:id', authenticate, authorize(['admin']), deleteSleepStory);

export default router;
