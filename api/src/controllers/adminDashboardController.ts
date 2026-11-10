import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple in-memory cache (60s TTL)
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // Return cached data if fresh
    if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
      return res.status(200).json(cachedData);
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      totalUsers,
      newUsersThisMonth,
      verifiedUsers,
      usersByStatus,
      totalDietPlans,
      totalExercises,
      totalMeditations,
      totalSleepStories,
      totalSleepSounds,
      totalBlogs,
      totalChallenges,
      activeSubscriptions,
      totalRevenue,
      recentPayments,
      challengesJoined,
      totalReferralCodes,
      totalCoupons,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.user.count({
        where: { isEmailVerified: true },
      }),
      prisma.user.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.dietPlan.count(),
      prisma.exercise.count(),
      prisma.meditation.count(),
      prisma.sleepStory.count(),
      prisma.sleepSound.count(),
      prisma.blog.count(),
      prisma.challenge.count(),
      prisma.subscriptionPayment.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.subscriptionPayment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, email: true },
          },
        },
      }),
      prisma.userChallenge.count(),
      prisma.referralCode.count(),
      prisma.couponCode.count(),
    ]);

    // Get daily user growth for the last 30 days (single query instead of 30)
    const growthRows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Build a map for quick lookup
    const growthMap = new Map<string, number>();
    growthRows.forEach((row) => {
      const key = new Date(row.date).toISOString().split('T')[0];
      growthMap.set(key, Number(row.count));
    });

    // Fill in all 30 days (days with 0 users show as 0)
    const dailyGrowth: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyGrowth.push({ date: key, count: growthMap.get(key) ?? 0 });
    }

    // Completed revenue per calendar month for the last 6 months (UTC), oldest first.
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const revenueRows = await prisma.$queryRaw<Array<{ month: Date; total: unknown }>>`
      SELECT date_trunc('month', created_at) AS month, SUM(amount) AS total
      FROM subscription_payments
      WHERE status = 'COMPLETED' AND created_at >= ${firstMonth}
      GROUP BY 1
    `;
    const revenueByMonth = new Map(
      revenueRows.map((row) => [new Date(row.month).toISOString().slice(0, 7), Number(row.total ?? 0)])
    );
    const monthlyRevenue: Array<{ month: string; amount: number }> = [];
    for (let i = 0; i < 6; i++) {
      const month = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1))
        .toISOString()
        .slice(0, 7);
      monthlyRevenue.push({ month, amount: revenueByMonth.get(month) ?? 0 });
    }

    // Build status map
    const statusMap: Record<string, number> = {};
    usersByStatus.forEach((item) => {
      if (item.status) {
        statusMap[item.status] = item._count.status;
      }
    });

    const response = {
      success: true,
      data: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          verified: verifiedUsers,
          verificationRate:
            totalUsers > 0
              ? parseFloat(((verifiedUsers / totalUsers) * 100).toFixed(1))
              : 0,
          byStatus: {
            active: statusMap['active'] || 0,
            pending: statusMap['pending'] || 0,
            blocked: statusMap['blocked'] || 0,
          },
          dailyGrowth,
        },
        content: {
          dietPlans: totalDietPlans,
          exercises: totalExercises,
          meditations: totalMeditations,
          sleepStories: totalSleepStories,
          sleepSounds: totalSleepSounds,
          blogs: totalBlogs,
          challenges: totalChallenges,
        },
        subscriptions: {
          active: activeSubscriptions,
          // A Prisma Decimal serialises as a string; the panel expects a number.
          totalRevenue: Number(totalRevenue._sum.amount ?? 0),
          monthlyRevenue,
          recentPayments: recentPayments.map((p) => ({
            id: p.id,
            username: p.user?.username ?? 'Unknown',
            planName: p.planName ?? 'Unknown Plan',
            amount: p.amount ? p.amount.toNumber() : 0,
            method: p.method ?? 'Unknown',
            status: p.status ?? 'Unknown',
            createdAt: p.createdAt ?? new Date(),
          })),
        },
        engagement: {
          challengesJoined,
          referralCodes: totalReferralCodes,
          coupons: totalCoupons,
        },
      },
    };

    cachedData = response;
    cacheTimestamp = Date.now();

    res.status(200).json(response);
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
    });
  }
};
