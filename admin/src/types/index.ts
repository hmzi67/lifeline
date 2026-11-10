// Export all types and interfaces
// export * from './auth.types';
// export * from './user.types';
// export * from './api.types';

import type { LucideIcon } from "lucide-react";


export interface StatData {
  title: string;
  value: number | string;
  unit: string;
  icon: LucideIcon;
  gradient: string;
  bgGradient: string;
  iconBg: string;
  chart?: number[];
  percentage?: number;
  trend: string;
  trendDirection: "up" | "down";
}

export interface WeekData {
  day: string;
  value: number;
  label: string;
  active: boolean;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface OrderStats {
  category: string;
  value: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export interface TransactionData {
  id: string;
  type: string;
  method: string;
  amount: number;
  icon: LucideIcon;
  color: string;
}

export interface RevenueData {
  month: string;
  current: number;
  previous: number;
}

export interface DashboardUserData {
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
}

export interface DashboardContentData {
  dietPlans: number;
  exercises: number;
  meditations: number;
  sleepStories: number;
  sleepSounds: number;
  blogs: number;
  challenges: number;
}

export interface DashboardSubscriptionData {
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
}

export interface DashboardEngagementData {
  challengesJoined: number;
  referralCodes: number;
  coupons: number;
}

export interface DashboardData {
  users: DashboardUserData;
  content: DashboardContentData;
  subscriptions: DashboardSubscriptionData;
  engagement: DashboardEngagementData;
}


