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

const fastingRoutes = Router();


// CRUD operations
fastingRoutes.post('/', authenticate, createFastingLog);
fastingRoutes.get('/', authenticate, getUserFastingLogs);
fastingRoutes.get('/stats', authenticate, getFastingStats);
fastingRoutes.get('/active', authenticate, getActiveFastingLog);
fastingRoutes.get('/:id', authenticate, getFastingLogById);
fastingRoutes.put('/:id', authenticate, updateFastingLog);
fastingRoutes.delete('/:id', authenticate, deleteFastingLog);

export default fastingRoutes;