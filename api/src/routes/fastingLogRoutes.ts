import { Router } from 'express';
import {
    createFastingLog,
    deleteFastingLog,
    getFastingLogById,
    getFastingStats,
  getActiveFastingLog,
    getUserFastingLogs,
    updateFastingLog,
} from '../controllers/fastingLogController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { fastingLogBody } from '../validators/trackingSchemas.js';

const fastingRoutes = Router();


// CRUD operations
fastingRoutes.post('/', authenticate, validateBody(fastingLogBody), createFastingLog);
fastingRoutes.get('/', authenticate, getUserFastingLogs);
fastingRoutes.get('/stats', authenticate, getFastingStats);
fastingRoutes.get('/active', authenticate, getActiveFastingLog);
fastingRoutes.get('/:id', authenticate, getFastingLogById);
fastingRoutes.put('/:id', authenticate, validateBody(fastingLogBody), updateFastingLog);
fastingRoutes.delete('/:id', authenticate, deleteFastingLog);

export default fastingRoutes;