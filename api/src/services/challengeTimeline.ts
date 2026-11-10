export type ChallengePhase = 'live' | 'upcoming' | 'ended';

/** Statuses an admin uses to keep a challenge out of the app. */
export const HIDDEN_CHALLENGE_STATUSES = ['DRAFT', 'INACTIVE'];

/** Prisma filter for challenges users may see. A missing status counts as visible. */
export const visibleChallengeWhere = {
  approvalStatus: 'APPROVED',
  OR: [{ status: null }, { status: { notIn: HIDDEN_CHALLENGE_STATUSES } }],
};

/** Whether users may see (and so join) this challenge. */
export const isChallengeVisible = (challenge: { approvalStatus: string; status: string | null }) =>
  challenge.approvalStatus === 'APPROVED' &&
  (challenge.status === null || !HIDDEN_CHALLENGE_STATUSES.includes(challenge.status));

type TimedChallenge = {
  status: string | null;
  scheduledAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
};

/** Where a challenge is in its timeline, so the app can split "Happening Now" from "Coming up". */
export const challengePhase = (challenge: TimedChallenge, now = new Date()): ChallengePhase => {
  if (challenge.status === 'COMPLETED') return 'ended';
  if (challenge.endDate) {
    // endDate is a calendar day; the challenge runs until that day is over.
    const endOfDay = new Date(challenge.endDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    if (endOfDay < now) return 'ended';
  }
  const start = challenge.scheduledAt ?? challenge.startDate;
  return start && start > now ? 'upcoming' : 'live';
};
