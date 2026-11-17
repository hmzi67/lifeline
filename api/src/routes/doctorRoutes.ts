import { Router } from 'express';
import { createDoctor, deleteDoctor, getAllDoctors, getDoctorById, updateDoctor } from '../controllers/doctorController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { doctorBody } from '../validators/contentSchemas.js';

// Doctors who hand out coupon codes. Admin only.
const router = Router();

router.get('/', authenticate, authorize(['admin']), getAllDoctors);
router.post('/', authenticate, authorize(['admin']), validateBody(doctorBody), createDoctor);
router.get('/:id', authenticate, authorize(['admin']), getDoctorById);
router.put('/:id', authenticate, authorize(['admin']), validateBody(doctorBody), updateDoctor);
router.delete('/:id', authenticate, authorize(['admin']), deleteDoctor);

export default router;
