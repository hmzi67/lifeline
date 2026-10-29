import { prisma } from '../config/database.js';

const DAY_MS = 86400000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export type AdherenceSummary = {
  taken: number;
  skipped: number;
  missed: number;
  takenPercent: number;
  skippedPercent: number;
  missedPercent: number;
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Taken / skipped / missed doses over the `days` days ending on `today` (YYYY-MM-DD, the
 * user's local day). A past day with no record for a medication counts as missed; today
 * isn't missed yet. "As needed" medications are never missed.
 */
export const medicationAdherence = async (userId: string, days: number, today: string): Promise<AdherenceSummary> => {
  const end = new Date(today);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);

  const [medications, intakes] = await Promise.all([
    prisma.medication.findMany({ where: { userId }, select: { id: true, frequency: true, addedAt: true } }),
    prisma.medicationIntake.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { medicationId: true, date: true, status: true },
    }),
  ]);

  const recorded = new Set(intakes.map((intake) => `${intake.medicationId}:${dayKey(intake.date)}`));
  const taken = intakes.filter((intake) => intake.status === 'TAKEN').length;
  const skipped = intakes.filter((intake) => intake.status === 'SKIPPED').length;

  let missed = 0;
  for (const medication of medications) {
    if (medication.frequency?.toLowerCase().includes('needed')) continue;
    const added = medication.addedAt ? new Date(dayKey(medication.addedAt)) : start;
    for (let t = Math.max(start.getTime(), added.getTime()); t < end.getTime(); t += DAY_MS) {
      if (!recorded.has(`${medication.id}:${dayKey(new Date(t))}`)) missed += 1;
    }
  }

  const total = taken + skipped + missed;
  return {
    taken,
    skipped,
    missed,
    takenPercent: percent(taken, total),
    skippedPercent: percent(skipped, total),
    missedPercent: percent(missed, total),
  };
};
