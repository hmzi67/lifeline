import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

/**
 * Get all roles
 */
export const getAllRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });

        res.status(200).json({
            success: true,
            data: roles,
            message: 'Roles retrieved successfully',
        });
    } catch (error: any) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch roles',
            error: error.message,
        });
    }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found',
            });
        }

        res.status(200).json({
            success: true,
            data: role,
            message: 'Role retrieved successfully',
        });
    } catch (error: any) {
        console.error('Error fetching role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch role',
            error: error.message,
        });
    }
};

/**
 * Create new role
 */
export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required',
            });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description,
            },
        });

        res.status(201).json({
            success: true,
            data: role,
            message: 'Role created successfully',
        });
    } catch (error: any) {
        console.error('Error creating role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create role',
            error: error.message,
        });
    }
};

/**
 * Update role
 */
export const updateRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const role = await prisma.role.update({
            where: { id },
            data: {
                name,
                description,
            },
        });

        res.status(200).json({
            success: true,
            data: role,
            message: 'Role updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating role:', error);

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Role not found',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update role',
            error: error.message,
        });
    }
};

/**
 * Delete role
 */
export const deleteRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if role has users
        const roleWithUsers = await prisma.role.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });

        if (roleWithUsers && roleWithUsers._count.users > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role. ${roleWithUsers._count.users} user(s) are assigned to this role.`,
            });
        }

        await prisma.role.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: 'Role deleted successfully',
        });
    } catch (error: any) {
        console.error('Error deleting role:', error);

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Role not found',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete role',
            error: error.message,
        });
    }
};
