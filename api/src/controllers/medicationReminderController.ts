import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

// Get all reminders for a medication
export const getMedicationReminders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { medicationId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;

    // Only the caller's reminders on the caller's medication.
    const reminders = await prisma.medicationReminder.findMany({
      where: { medicationId, userId, medication: { userId } },
      include: {
        medication: true
      }
    });

    res.status(200).json({
      success: true,
      data: reminders,
      message: 'Medication reminders retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching medication reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user's all medication reminders
export const getUserMedicationReminders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only access your own medication reminders' });
      return;
    }

    const reminders = await prisma.medicationReminder.findMany({
      where: { userId },
      include: {
        medication: true
      },
      orderBy: {
        reminderTime: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: reminders,
      message: 'User medication reminders retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user medication reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get reminder by ID
export const getMedicationReminderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const reminder = await prisma.medicationReminder.findUnique({
      where: { id },
      include: {
        medication: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    if (!reminder) {
      res.status(404).json({
        success: false,
        message: 'Medication reminder not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== reminder.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only access your own medication reminders' });
      return;
    }

    res.status(200).json({
      success: true,
      data: reminder,
      message: 'Medication reminder retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching medication reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create medication reminder
export const createMedicationReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { medicationId, userId, reminderTime, repeatType, enabled } = req.body;

    const authUser = (req as AuthenticatedRequest).user;
    if (!userId || authUser?.id !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only create reminders for yourself' });
      return;
    }

    if (!medicationId || !reminderTime) {
      res.status(400).json({
        success: false,
        message: 'Medication ID, user ID, and reminder time are required'
      });
      return;
    }

    // Verify medication exists
    const medication = await prisma.medication.findUnique({
      where: { id: medicationId }
    });

    // Someone else's medication is reported as missing, not as forbidden.
    if (!medication || medication.userId !== authUser?.id) {
      res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const reminder = await prisma.medicationReminder.create({
      data: {
        medicationId,
        userId,
        reminderTime: new Date(reminderTime),
        repeatType: repeatType || null,
        enabled: enabled !== undefined ? enabled : true
      },
      include: {
        medication: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: reminder,
      message: 'Medication reminder created successfully'
    });
  } catch (error) {
    console.error('Error creating medication reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update medication reminder
export const updateMedicationReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reminderTime, repeatType, enabled } = req.body;

    const existingReminder = await prisma.medicationReminder.findUnique({
      where: { id }
    });

    if (!existingReminder) {
      res.status(404).json({
        success: false,
        message: 'Medication reminder not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== existingReminder.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only update your own medication reminders' });
      return;
    }

    const updateData: any = {};
    if (reminderTime !== undefined) updateData.reminderTime = new Date(reminderTime);
    if (repeatType !== undefined) updateData.repeatType = repeatType;
    if (enabled !== undefined) updateData.enabled = enabled;

    const reminder = await prisma.medicationReminder.update({
      where: { id },
      data: updateData,
      include: {
        medication: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: reminder,
      message: 'Medication reminder updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Toggle reminder enabled status
export const toggleMedicationReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingReminder = await prisma.medicationReminder.findUnique({
      where: { id }
    });

    if (!existingReminder) {
      res.status(404).json({
        success: false,
        message: 'Medication reminder not found'
      });
      return;
    }

    const authUser = (req as AuthenticatedRequest).user;
    if (authUser?.id !== existingReminder.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only toggle your own medication reminders' });
      return;
    }

    const reminder = await prisma.medicationReminder.update({
      where: { id },
      data: {
        enabled: !existingReminder.enabled
      },
      include: {
        medication: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: reminder,
      message: `Medication reminder ${reminder.enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling medication reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete medication reminder
export const deleteMedicationReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingReminder = await prisma.medicationReminder.findUnique({
      where: { id }
    });

    if (!existingReminder) {
      res.status(404).json({
        success: false,
        message: 'Medication reminder not found'
      });
      return;
    }

    const authUserDel = (req as AuthenticatedRequest).user;
    if (authUserDel?.id !== existingReminder.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own medication reminders' });
      return;
    }

    await prisma.medicationReminder.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Medication reminder deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
