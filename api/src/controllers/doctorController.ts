import { Request, Response } from 'express';
import { prisma } from '../config/database.js';

/** Coupon totals per doctor: how many coupons, how many uses allowed, used and left. */
const couponTotals = async (doctorIds: string[]) => {
  const groups = await prisma.couponCode.groupBy({
    by: ['doctorId'],
    where: { doctorId: { in: doctorIds } },
    _count: { _all: true },
    _sum: { maxUses: true, currentUses: true },
  });
  const now = new Date();
  const usable = await prisma.couponCode.findMany({
    where: { doctorId: { in: doctorIds }, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { doctorId: true, maxUses: true, currentUses: true },
  });

  return new Map(
    doctorIds.map((doctorId) => {
      const group = groups.find((g) => g.doctorId === doctorId);
      const mine = usable.filter((c) => c.doctorId === doctorId);
      return [
        doctorId,
        {
          coupons: group?._count._all ?? 0,
          activeCoupons: mine.filter((c) => c.currentUses < c.maxUses).length,
          totalUses: group?._sum.maxUses ?? 0,
          usedUses: group?._sum.currentUses ?? 0,
          // Uses still redeemable: active, unexpired coupons only.
          usesLeft: mine.reduce((sum, c) => sum + Math.max(c.maxUses - c.currentUses, 0), 0),
        },
      ];
    }),
  );
};

export const getAllDoctors = async (_req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { name: 'asc' },
      take: 1000,
      include: { coupons: { select: { id: true, code: true }, orderBy: { createdAt: 'desc' } } },
    });
    const totals = await couponTotals(doctors.map((d) => d.id));
    return res.status(200).json({
      success: true,
      data: doctors.map((d) => ({ ...d, stats: totals.get(d.id) })),
      message: 'Doctors retrieved successfully',
    });
  } catch (error) {
    console.error('getAllDoctors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch doctors' });
  }
};

export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        coupons: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { usages: true } } },
        },
      },
    });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const totals = await couponTotals([doctor.id]);
    return res.status(200).json({ success: true, data: { ...doctor, stats: totals.get(doctor.id) } });
  } catch (error) {
    console.error('getDoctorById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
  }
};

const doctorData = (body: Record<string, unknown>) => ({
  name: String(body.name).trim(),
  clinic: (body.clinic as string | null | undefined) || null,
  phone: (body.phone as string | null | undefined) || null,
  email: (body.email as string | null | undefined) || null,
  notes: (body.notes as string | null | undefined) || null,
  ...(body.isActive !== undefined && body.isActive !== null ? { isActive: body.isActive === true || body.isActive === 'true' } : {}),
});

export const createDoctor = async (req: Request, res: Response) => {
  try {
    const doctor = await prisma.doctor.create({ data: doctorData(req.body) });
    return res.status(201).json({ success: true, data: doctor, message: 'Doctor added successfully' });
  } catch (error) {
    console.error('createDoctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add doctor' });
  }
};

export const updateDoctor = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.doctor.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const doctor = await prisma.doctor.update({ where: { id: req.params.id }, data: doctorData(req.body) });
    return res.status(200).json({ success: true, data: doctor, message: 'Doctor updated successfully' });
  } catch (error) {
    console.error('updateDoctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update doctor' });
  }
};

export const deleteDoctor = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { coupons: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Doctor not found' });
    // Their coupons' usage history belongs to them; keep it by marking the doctor inactive instead.
    if (existing._count.coupons > 0) {
      return res.status(409).json({
        success: false,
        message: `This doctor has ${existing._count.coupons} coupon(s). Mark the doctor inactive instead of deleting.`,
      });
    }
    await prisma.doctor.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('deleteDoctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete doctor' });
  }
};
