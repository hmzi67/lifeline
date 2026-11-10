import { z } from 'zod';

export const createUserSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(12),
        name: z.string().min(2)
    })
});

export const updateUserSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        email: z.string().email().optional(),
        name: z.string().min(2).optional()
    })
});