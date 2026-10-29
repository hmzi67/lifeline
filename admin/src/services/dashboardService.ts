import api from '@/lib/axios';

export interface DashboardData {
  users: {
    total: number;
    newThisMonth: number;
    verified: number;
    verificationRate: number;
    byStatus: {
      active: number;
      pending: number;
      blocked: number;
    };
    dailyGrowth: Array<{ date: string; count: number }>;
  };
  content: {
    dietPlans: number;
    exercises: number;
    meditations: number;
    sleepStories: number;
    sleepSounds: number;
    blogs: number;
    challenges: number;
  };
  subscriptions: {
    active: number;
    totalRevenue: number;
    /** Completed revenue per month ("YYYY-MM"), last 6 months, oldest first. */
    monthlyRevenue: Array<{ month: string; amount: number }>;
    recentPayments: Array<{
      id: string;
      username: string;
      planName: string;
      amount: number;
      method: string;
      status: string;
      createdAt: string;
    }>;
  };
  engagement: {
    challengesJoined: number;
    referralCodes: number;
    coupons: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class DashboardService {
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    const response = await api.get<ApiResponse<DashboardData>>('/admin/dashboard');
    return response.data;
  }
}

export const dashboardService = new DashboardService();
