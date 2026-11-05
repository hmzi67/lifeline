import {
    Home,
    Users,
    Package,
    Dumbbell,
    BookOpen,
    FileText,
    DollarSign,
    ShoppingCart,
    CreditCard,
    Shield,
    FolderOpen,
    Utensils,
    Target,
    Waves,
    Music,
    Ticket,
    Link2,
    UserPlus,
    Activity,
    TrendingUp,
    CheckCircle,
    CalendarDays,
    Bell
} from 'lucide-react';
import type { NavigationItem, StatData, DashboardData } from '@/types';

export const navigationItems: NavigationItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'diet', label: 'Diet Plans', icon: Package },
    { id: 'mealTypes', label: 'Meal Types', icon: Utensils },
    { id: 'exercise', label: 'Exercises', icon: Dumbbell },
    { id: 'exercisePlans', label: 'Exercise Plans', icon: CalendarDays },
    { id: 'challenges', label: 'Challenges', icon: Target },
    { id: 'mindMeditation', label: 'Meditation', icon: Music },
    { id: 'sleepStories', label: 'Sleep Stories', icon: BookOpen },
    { id: 'sleepSounds', label: 'Sleep Sounds', icon: Waves },
    { id: 'blogCategories', label: 'Blog Categories', icon: FolderOpen },
    { id: 'blog', label: 'Blogs', icon: FileText },
    { id: 'pricingPlans', label: 'Pricing Plans', icon: DollarSign },
    { id: 'coupons', label: 'Coupon Codes', icon: Ticket },
    { id: 'referralCodes', label: 'Referral Codes', icon: Link2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

export const getStatsData = (dashboardData: DashboardData | null): StatData[] => [
    {
        title: 'Total Users',
        value: dashboardData?.users.total ?? 0,
        unit: 'Users',
        icon: Users,
        gradient: 'from-emerald-400 to-teal-500',
        bgGradient: 'from-emerald-50 to-teal-50',
        iconBg: 'from-emerald-100 to-teal-100',
        chart: dashboardData?.users.dailyGrowth.map(d => d.count) ?? [],
        trend: `+${dashboardData?.users.newThisMonth ?? 0} this month`,
        trendDirection: 'up'
    },
    {
        title: 'New Users (30d)',
        value: dashboardData?.users.newThisMonth ?? 0,
        unit: 'Users',
        icon: UserPlus,
        gradient: 'from-orange-400 to-red-500',
        bgGradient: 'from-orange-50 to-red-50',
        iconBg: 'from-orange-100 to-red-100',
        trend: `${dashboardData?.users.verificationRate ?? 0}% verified`,
        trendDirection: 'up'
    },
    {
        title: 'Active Subscriptions',
        value: dashboardData?.subscriptions.active ?? 0,
        unit: 'Subscriptions',
        icon: CreditCard,
        gradient: 'from-blue-400 to-purple-500',
        bgGradient: 'from-blue-50 to-purple-50',
        iconBg: 'from-blue-100 to-purple-100',
        trend: `$${(dashboardData?.subscriptions.totalRevenue ?? 0).toLocaleString()} revenue`,
        trendDirection: 'up'
    },
    {
        title: 'Verification Rate',
        value: `${dashboardData?.users.verificationRate ?? 0}%`,
        unit: 'Verified',
        icon: CheckCircle,
        gradient: 'from-cyan-400 to-blue-500',
        bgGradient: 'from-cyan-50 to-blue-50',
        iconBg: 'from-cyan-100 to-blue-100',
        percentage: dashboardData?.users.verificationRate ?? 0,
        trend: `${dashboardData?.users.verified ?? 0} of ${dashboardData?.users.total ?? 0}`,
        trendDirection: 'up'
    }
];