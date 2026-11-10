import { Router } from 'express';
import {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
} from '../controllers/roleController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// GET /api/roles - Get all roles
router.get('/', authenticate, authorize(['admin']), getAllRoles);

// GET /api/roles/:id - Get role by ID
router.get('/:id', authenticate, authorize(['admin']), getRoleById);

// POST /api/roles - Create new role
router.post('/', authenticate, authorize(['admin']), createRole);

// PUT /api/roles/:id - Update role
router.put('/:id', authenticate, authorize(['admin']), updateRole);

// DELETE /api/roles/:id - Delete role
router.delete('/:id', authenticate, authorize(['admin']), deleteRole);

export default router;
