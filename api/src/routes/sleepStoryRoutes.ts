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
import { validateBody } from '../middleware/validateRequest.js';
import { sleepStoryBody } from '../validators/contentSchemas.js';

const router = Router();

router.get('/', authenticate, requireActiveLicense, getSleepStories);
router.get('/:id', authenticate, requireActiveLicense, getSleepStoryById);
router.post('/', authenticate, authorize(['admin']), validateBody(sleepStoryBody), createSleepStory);
router.put('/:id', authenticate, authorize(['admin']), validateBody(sleepStoryBody), updateSleepStory);
router.delete('/:id', authenticate, authorize(['admin']), deleteSleepStory);

export default router;
