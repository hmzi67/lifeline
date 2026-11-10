import { Router } from 'express';
import { createFoodLog, deleteFoodLog, getFoodLogs } from '../controllers/foodLogController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// GET /api/food-logs?date=YYYY-MM-DD - The caller's food entries for a day
router.get('/', getFoodLogs);

// POST /api/food-logs - Log a barcode scan, photo scan or manual entry
router.post('/', createFoodLog);

// DELETE /api/food-logs/:id - Remove one of the caller's entries
router.delete('/:id', deleteFoodLog);

export default router;
