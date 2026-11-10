import { prisma } from '../config/database.js';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getMediaCategory } from '../middleware/upload.js';
import { config } from '../config/index.js';
import { cursorArgs, cursorPage } from '../utils/pagination.js';

// Helper function to get userId from token
const getUserIdFromToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
};

export const createMedication = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { name, quantity, dose, frequency, reminderTime, image, icon, appearanceColor, appearanceIcon } = req.body;

    if (!name || !dose || !frequency) {
      return res.status(400).json({
        success: false,
        message: 'Name, dose, and frequency are required'
      });
    }

    // Handle file upload - construct URL from uploaded file
    let imageUrl = image || null;
    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const relativePath = `/uploads/${category}/${req.file.filename}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      imageUrl = `${baseUrl}${relativePath}`;
    }

    const medication = await prisma.medication.create({
      data: {
        userId,
        name,
        quantity: quantity || null,
        dose,
        frequency,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        image: imageUrl,
        icon: icon || null,
        appearanceColor: appearanceColor || null,
        appearanceIcon: appearanceIcon || null,
        addedAt: new Date()
      } as any
    });

    res.status(201).json({
      success: true,
      data: medication,
      message: 'Medication created successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medication'
    });
  }
};

export const getMedications = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const medicationsPage = await prisma.medication.findMany({
      ...cursorArgs(req.query),
      orderBy: { id: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });
    const { items: medications, nextCursor } = cursorPage(medicationsPage, req.query);
    
    res.json({
      success: true,
      data: medications,
      nextCursor,
      count: medications.length
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medications'
    });
  }
};

export const getUserMedications = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const medications = await prisma.medication.findMany({
      where: {
        userId
      },
      include: {
        medicationReminders: true
      },
      orderBy: {
        addedAt: 'desc'
      }
    });
    
    res.json({
      success: true,
      data: medications,
      count: medications.length
    });
  } catch (error) {
    console.error('Error fetching user medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user medications'
    });
  }
};

export const getMedicationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromToken(req);

    const medication = await prisma.medication.findUnique({
      where: {
        id
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    // Check if the medication belongs to the user
    if (medication.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this medication'
      });
    }

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medication'
    });
  }
};

export const updateMedication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromToken(req);
    const { name, quantity, dose, frequency, reminderTime, image, icon } = req.body;

    // First check if medication exists and belongs to user
    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });
    
    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    if (existingMedication.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this medication'
      });
    }

    // Handle file upload - construct URL from uploaded file
    let imageUrl = image !== undefined ? image : (existingMedication as any).image;
    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const relativePath = `/uploads/${category}/${req.file.filename}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      imageUrl = `${baseUrl}${relativePath}`;
    }

    const medication = await prisma.medication.update({
      where: { id },
      data: {
        name,
        quantity: quantity !== undefined ? quantity : existingMedication.quantity,
        dose,
        frequency,
        reminderTime: reminderTime === null ? null : (reminderTime ? new Date(reminderTime) : existingMedication.reminderTime),
        image: imageUrl,
        icon: icon !== undefined ? icon : existingMedication.icon
      } as any
    });

    res.json({
      success: true,
      data: medication,
      message: 'Medication updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication'
    });
  }
};

export const deleteMedication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromToken(req);

    // First check if medication exists and belongs to user
    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });
    
    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    if (existingMedication.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this medication'
      });
    }

    // Delete associated reminders first to avoid FK constraint errors
    await prisma.medicationReminder.deleteMany({
      where: { medicationId: id }
    });

    await prisma.medication.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medication'
    });
  }
};
