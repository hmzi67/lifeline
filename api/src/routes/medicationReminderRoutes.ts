import { Router } from 'express';
import {
    createMedicationReminder,
    deleteMedicationReminder,
    getMedicationReminderById,
    getMedicationReminders,
    getUserMedicationReminders,
    toggleMedicationReminder,
    updateMedicationReminder
} from '../controllers/medicationReminderController.js';
import authenticate from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validateRequest.js';
import { medicationReminderBody } from '../validators/trackingSchemas.js';

const router = Router();

// GET /api/medication-reminders/medication/:medicationId - Get reminders for a medication
router.get('/medication/:medicationId', authenticate, getMedicationReminders);

// GET /api/medication-reminders/user/:userId - Get user's all medication reminders
router.get('/user/:userId', authenticate, getUserMedicationReminders);

// GET /api/medication-reminders/:id - Get reminder by ID
router.get('/:id', authenticate, getMedicationReminderById);

// POST /api/medication-reminders - Create medication reminder
router.post('/', authenticate, validateBody(medicationReminderBody), createMedicationReminder);

// PUT /api/medication-reminders/:id - Update medication reminder
router.put('/:id', authenticate, validateBody(medicationReminderBody), updateMedicationReminder);

// PUT /api/medication-reminders/:id/toggle - Toggle reminder enabled status
router.put('/:id/toggle', authenticate, toggleMedicationReminder);

// DELETE /api/medication-reminders/:id - Delete medication reminder
router.delete('/:id', authenticate, deleteMedicationReminder);

export default router;
