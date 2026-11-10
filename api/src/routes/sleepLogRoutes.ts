import { Router } from 'express';
import {
    createSleepLog,
    deleteSleepLog,
    getSleepLogById,
    getSleepQuality,
    getSleepStats,
    getUserSleepLogs,
    updateSleepLog,
} from '../controllers/sleepLogController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { sleepLogBody } from '../validators/trackingSchemas.js';

const sleepRoutes = Router();

// CRUD operations
sleepRoutes.post('/', authenticate, validateBody(sleepLogBody), createSleepLog);
sleepRoutes.get('/', authenticate, getUserSleepLogs);
sleepRoutes.get('/stats', authenticate, getSleepStats);
sleepRoutes.get('/quality', authenticate, getSleepQuality);
sleepRoutes.get('/:id', authenticate, getSleepLogById);
sleepRoutes.put('/:id', authenticate, validateBody(sleepLogBody), updateSleepLog);
sleepRoutes.delete('/:id', authenticate, deleteSleepLog);

export default sleepRoutes;