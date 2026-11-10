import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const intakeSchema = z.object({
  // The user's local day the dose belongs to.
  date: dayKey,
  status: z.enum(['TAKEN', 'SKIPPED']),
});

const userIdOf = (req: Request) => (req as AuthenticatedRequest).user?.id;

const ownsMedication = async (medicationId: string, userId: string) =>
  !!(await prisma.medication.findFirst({ where: { id: medicationId, userId }, select: { id: true } }));

// GET /api/medications/intakes?date=YYYY-MM-DD - the caller's taken/skipped records for a day
export const getIntakesForDay = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  const parsed = dayKey.safeParse(req.query.date);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });

  try {
    const intakes = await prisma.medicationIntake.findMany({
      where: { userId, date: new Date(parsed.data) },
      select: { id: true, medicationId: true, date: true, status: true, recordedAt: true },
    });
    res.status(200).json({ success: true, data: intakes });
  } catch (error) {
    console.error('Get medication intakes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch medication intakes' });
  }
};

// PUT /api/medications/:id/intakes - mark a day's dose taken or skipped (replaces any earlier mark)
export const recordIntake = async (req: Request<{ id: string }>, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message ?? 'Invalid intake' });
  }

  try {
    if (!(await ownsMedication(req.params.id, userId))) {
      return res.status(404).json({ success: false, message: 'Medication not found' });
    }
    const date = new Date(parsed.data.date);
    const intake = await prisma.medicationIntake.upsert({
      where: { medicationId_date: { medicationId: req.params.id, date } },
      create: { medicationId: req.params.id, userId, date, status: parsed.data.status },
      update: { status: parsed.data.status, recordedAt: new Date() },
    });
    res.status(200).json({ success: true, data: intake });
  } catch (error) {
    console.error('Record medication intake error:', error);
    res.status(500).json({ success: false, message: 'Failed to record medication intake' });
  }
};

// DELETE /api/medications/:id/intakes/:date - undo a day's mark
export const clearIntake = async (req: Request<{ id: string; date: string }>, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  const parsed = dayKey.safeParse(req.params.date);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });

  try {
    await prisma.medicationIntake.deleteMany({
      where: { medicationId: req.params.id, userId, date: new Date(parsed.data) },
    });
    res.status(200).json({ success: true, data: { medicationId: req.params.id, date: parsed.data } });
  } catch (error) {
    console.error('Clear medication intake error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear medication intake' });
  }
};
