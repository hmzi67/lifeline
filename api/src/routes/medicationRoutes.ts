import { Router } from 'express';
import {
    createMedication,
    deleteMedication,
    getMedicationById,
    getMedications,
    getUserMedications,
    updateMedication
} from '../controllers/medicationController.js';
import { clearIntake, getIntakesForDay, recordIntake } from '../controllers/medicationIntakeController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { imageUpload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validateRequest.js';
import { medicationBody } from '../validators/trackingSchemas.js';

const router = Router();

// Get all medications for the authenticated user
router.get('/user', authenticate, getUserMedications);

// Get every user's medications (includes owner emails) - admin only
router.get('/', authenticate, authorize(['admin']), getMedications);

// Taken/skipped records for a day (declared before /:id)
router.get('/intakes', authenticate, getIntakesForDay);

// Mark a day's dose taken or skipped, or undo it
router.put('/:id/intakes', authenticate, recordIntake);
router.delete('/:id/intakes/:date', authenticate, clearIntake);

// Get a specific medication by ID
router.get('/:id', authenticate, getMedicationById);

// Create a new medication
router.post('/', authenticate, imageUpload.single('file'), validateBody(medicationBody), createMedication);

// Update a medication
router.put('/:id', authenticate, imageUpload.single('file'), validateBody(medicationBody), updateMedication);

// Delete a medication
router.delete('/:id', authenticate, deleteMedication);

export default router;