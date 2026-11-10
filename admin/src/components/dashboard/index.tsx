import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    TrendingUp,
    CreditCard,
    PieChart,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Loader2,
    AlertCircle,
    RefreshCw,
    Dumbbell,
    BookOpen,
    Music,
    FileText,
    Target,
    Waves,
    Users,
    Package
} from 'lucide-react';
import { GlowingCard, CircularProgress, StatsCard } from '../shared';
import { dashboardService, type DashboardData } from '@/services/dashboardService';
import { getStatsData } from '@/components/constants';
import type { StatData } from '@/types';

// User Growth Chart Component
export const UserGrowthChart: React.FC<{ data: Array<{ date: string; count: number }> }> = ({ data }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <GlowingCard className="p-8 mb-8" glowColor="rgba(62, 198, 201, 0.1)">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">User Growth</h3>
                        <p className="text-gray-500">New user registrations (last 30 days)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">Last 30 Days</span>
                </div>
            </div>

            <div className="relative h-64 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
                <div className="flex items-end justify-between h-full relative z-10 gap-1">
                    {data.map((item, index) => (
                        <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                            <div
                                className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500 ease-out hover:from-blue-600 hover:to-blue-500"
                                style={{
                                    height: `${(item.count / maxCount) * 200}px`,
                                    width: '100%',
                                    maxWidth: '20px'
                                }}
                                title={`${item.date}: ${item.count} new users`}
                            />
                        </div>
                    ))}
                </div>
                <div className="absolute bottom-2 left-6 right-6 flex justify-between text-xs text-gray-500">
                    <span>{data[0]?.date}</span>
                    <span>{data[data.length - 1]?.date}</span>
                </div>
            </div>
        </GlowingCard>
    );
};

// Content Statistics Component
export const ContentStatsCard: React.FC<{
    content: DashboardData['content'];
}> = ({ content }) => {
    const stats = [
        { label: 'Diet Plans', value: content.dietPlans, icon: Package, color: 'bg-green-100 text-green-600' },
        { label: 'Exercises', value: content.exercises, icon: Dumbbell, color: 'bg-blue-100 text-blue-600' },
        { label: 'Meditations', value: content.meditations, icon: Music, color: 'bg-purple-100 text-purple-600' },
        { label: 'Sleep Stories', value: content.sleepStories, icon: BookOpen, color: 'bg-indigo-100 text-indigo-600' },
        { label: 'Sleep Sounds', value: content.sleepSounds, icon: Waves, color: 'bg-cyan-100 text-cyan-600' },
        { label: 'Blogs', value: content.blogs, icon: FileText, color: 'bg-orange-100 text-orange-600' },
        { label: 'Challenges', value: content.challenges, icon: Target, color: 'bg-red-100 text-red-600' },
    ];

    const totalContent = stats.reduce((sum, s) => sum + s.value, 0);

    return (
        <GlowingCard className="p-8" glowColor="rgba(62, 198, 201, 0.1)">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                        <PieChart className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Content Library</h3>
                        <p className="text-gray-500">{totalContent} total items</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {stats.map((stat, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 ${stat.color} rounded-lg`}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{stat.label}</p>
                                <p className="text-sm text-gray-500">Total items</p>
                            </div>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                    </div>
                ))}
            </div>
        </GlowingCard>
    );
};

// Subscription Revenue Component
export const SubscriptionRevenueCard: React.FC<{
    subscriptions: DashboardData['subscriptions'];
}> = ({ subscriptions }) => (
    <GlowingCard className="p-8" glowColor="rgba(62, 198, 201, 0.1)">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-gray-900">Subscription Revenue</h3>
                    <p className="text-gray-500">Total earnings from subscriptions</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">{subscriptions.active} active</span>
            </div>
        </div>

        <div className="mb-6">
            <span className="text-4xl font-bold text-gray-900">${subscriptions.totalRevenue.toLocaleString()}</span>
            <p className="text-gray-500 mt-2">Total Revenue</p>
        </div>

        <RevenueTrend months={subscriptions.monthlyRevenue ?? []} />
    </GlowingCard>
);

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

// Revenue per month from the API; nothing is drawn when there is no revenue.
const RevenueTrend: React.FC<{ months: Array<{ month: string; amount: number }> }> = ({ months }) => {
    const max = Math.max(0, ...months.map((m) => m.amount));
    if (months.length === 0 || max === 0) {
        return (
            <div className="h-32 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl flex items-center justify-center text-sm text-gray-500">
                No revenue recorded in the last 6 months
            </div>
        );
    }
    const step = months.length > 1 ? 300 / (months.length - 1) : 0;
    const points = months.map((m, i) => ({ x: 25 + i * step, y: 75 - (m.amount / max) * 60, ...m }));
    return (
        <div className="h-36 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl px-4 pt-4 pb-2">
            <svg className="w-full h-full" viewBox="0 0 350 100" aria-label="Revenue per month, last 6 months">
                <defs>
                    <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0.6" />
                    </linearGradient>
                </defs>
                <polyline
                    fill="none"
                    stroke="url(#revenueGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
                {points.map((p) => (
                    <g key={p.month}>
                        <circle cx={p.x} cy={p.y} r="4" fill="#f59e0b">
                            <title>{`${p.month}: $${p.amount.toLocaleString()}`}</title>
                        </circle>
                        <text x={p.x} y={96} textAnchor="middle" fontSize="10" fill="#6b7280">
                            {MONTH_LABEL.format(new Date(`${p.month}-01T00:00:00Z`))}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

// Engagement Stats Component
export const EngagementStatsCard: React.FC<{
    engagement: DashboardData['engagement'];
}> = ({ engagement }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlowingCard className="p-6" glowColor="rgba(59, 130, 246, 0.1)">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">Challenges Joined</h4>
                    <p className="text-sm text-gray-500">User participation</p>
                </div>
            </div>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{engagement.challengesJoined}</span>
            </div>
        </GlowingCard>

        <GlowingCard className="p-6" glowColor="rgba(16, 185, 129, 0.1)">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">Referral Codes</h4>
                    <p className="text-sm text-gray-500">Active referrals</p>
                </div>
            </div>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{engagement.referralCodes}</span>
            </div>
        </GlowingCard>

        <GlowingCard className="p-6" glowColor="rgba(168, 85, 247, 0.1)">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">Coupons</h4>
                    <p className="text-sm text-gray-500">Available coupons</p>
                </div>
            </div>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{engagement.coupons}</span>
            </div>
        </GlowingCard>
    </div>
);

// Recent Payments Component
export const RecentPaymentsCard: React.FC<{
    payments: DashboardData['subscriptions']['recentPayments'];
}> = ({ payments }) => (
    <GlowingCard className="p-8" glowColor="rgba(62, 198, 201, 0.1)">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl">
                    <CreditCard className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-gray-900">Recent Payments</h3>
                    <p className="text-gray-500">Latest subscription transactions</p>
                </div>
            </div>
        </div>

        {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No payments recorded yet</p>
            </div>
        ) : (
            <div className="space-y-4">
                {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                                payment.status === 'COMPLETED' ? 'bg-green-100' :
                                payment.status === 'PENDING' ? 'bg-yellow-100' : 'bg-red-100'
                            }`}>
                                <CreditCard className={`w-4 h-4 ${
                                    payment.status === 'COMPLETED' ? 'text-green-600' :
                                    payment.status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{payment.username}</p>
                                <p className="text-sm text-gray-500">{payment.planName} - {payment.method}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-lg font-bold ${
                                payment.status === 'COMPLETED' ? 'text-green-600' :
                                payment.status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                                ${payment.amount?.toFixed(2) ?? '0.00'}
                            </span>
                            <p className="text-xs text-gray-500">
                                {new Date(payment.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </GlowingCard>
);

// Loading Component
const DashboardLoading: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Loading dashboard data...</p>
    </div>
);

// Error Component
const DashboardError: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-700 font-medium mb-2">Failed to load dashboard</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
            <RefreshCw className="w-4 h-4" />
            Retry
        </button>
    </div>
);

// Main Dashboard Component
export const DashboardComponent: React.FC = () => {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await dashboardService.getDashboardData();
            if (response.success) {
                setDashboardData(response.data);
            } else {
                setError(response.message || 'Failed to fetch dashboard data');
            }
        } catch (err: any) {
            console.error('Dashboard fetch error:', err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();

        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    if (loading && !dashboardData) {
        return <DashboardLoading />;
    }

    if (error && !dashboardData) {
        return <DashboardError error={error} onRetry={fetchDashboardData} />;
    }

    const statsData = getStatsData(dashboardData);

    return (
        <div className="space-y-8">
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {statsData.map((stat, index) => (
                    <StatsCard key={index} stat={stat} index={index} />
                ))}
            </div>

            {/* User Growth Chart */}
            {dashboardData?.users.dailyGrowth && (
                <UserGrowthChart data={dashboardData.users.dailyGrowth} />
            )}

            {/* Content Stats and Subscription Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {dashboardData?.content && (
                    <ContentStatsCard content={dashboardData.content} />
                )}
                {dashboardData?.subscriptions && (
                    <SubscriptionRevenueCard subscriptions={dashboardData.subscriptions} />
                )}
            </div>

            {/* Engagement Stats */}
            {dashboardData?.engagement && (
                <EngagementStatsCard engagement={dashboardData.engagement} />
            )}

            {/* Recent Payments */}
            {dashboardData?.subscriptions.recentPayments && (
                <RecentPaymentsCard payments={dashboardData.subscriptions.recentPayments} />
            )}
        </div>
    );
};
