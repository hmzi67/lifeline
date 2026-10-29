import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { StatData } from '@/types';


// Animated Line Chart Component
export const AnimatedLineChart: React.FC<{ data: number[]; gradient: string | number }> = ({ data, gradient }) => {
    if (!data || data.length === 0) return null;
    const maxVal = Math.max(...data) || 1;
    return (
    <div className="mt-4 h-12 relative">
        <svg className="w-full h-full" viewBox="0 0 200 50" aria-label="Activity chart">
            <defs>
                <linearGradient id={`gradient-${gradient}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3EC6C9" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <polyline
                fill="none"
                stroke={`url(#gradient-${gradient})`}
                strokeWidth="3"
                strokeLinecap="round"
                points={data.map((value, index) =>
                    `${(index / (data.length - 1)) * 200},${50 - (value / maxVal) * 40}`
                ).join(' ')}
                className="animate-pulse"
            />
            {data.map((value, index) => (
                <circle
                    key={index}
                    cx={(index / (data.length - 1)) * 200}
                    cy={50 - (value / maxVal) * 40}
                    r="3"
                    fill="#3EC6C9"
                    className="animate-pulse"
                    style={{ animationDelay: `${index * 100}ms` }}
                />
            ))}
        </svg>
    </div>
    );
};

// Circular Progress Component
export const CircularProgress: React.FC<{
    percentage: number;
    size?: number;
    showAnimation?: boolean
    /** Caption under the value; the stat card already names it, so it is optional. */
    label?: string
}> = ({ percentage, size = 120, showAnimation = true, label }) => {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                className={showAnimation ? "animate-spin" : ""}
                style={showAnimation ? { animationDuration: '8s', animationDirection: 'reverse' } : {}}
                aria-label={`Progress: ${percentage}%`}
            >
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3EC6C9" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#f1f5f9"
                    strokeWidth="12"
                    fill="transparent"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#progressGradient)"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(62, 198, 201, 0.3))' }}
                />
            </svg>
            {/* Text scales with the ring so it fits inside the 12px stroke at any size. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className="font-bold leading-none bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent"
                    style={{ fontSize: Math.round(size * 0.2) }}
                >
                    {percentage}%
                </span>
                {label && <span className="text-xs text-gray-500 mt-1">{label}</span>}
            </div>
        </div>
    );
};

// Glowing Card Component
export const GlowingCard: React.FC<{
    children: React.ReactNode;
    className?: string;
    glowColor?: string
}> = ({ children, className = "", glowColor = "rgba(62, 198, 201, 0.1)" }) => (
    <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 ${className}`}
        style={{
            boxShadow: `0 4px 20px ${glowColor}, 0 1px 3px rgba(0, 0, 0, 0.1)`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
    >
        {children}
    </div>
);

// Stats Card Component
export const StatsCard: React.FC<{ stat: StatData; index: number }> = ({ stat, index }) => (
    <GlowingCard
        className={`p-6 relative overflow-hidden bg-gradient-to-br ${stat.bgGradient} hover:scale-105 transform transition-all duration-500`}
        glowColor={index === 0 ? "rgba(16, 185, 129, 0.15)" :
            index === 1 ? "rgba(239, 68, 68, 0.15)" :
                index === 2 ? "rgba(59, 130, 246, 0.15)" : "rgba(6, 182, 212, 0.15)"}
    >
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full -translate-y-10 translate-x-10" />

        <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={`p-3 bg-gradient-to-br ${stat.iconBg} rounded-xl shadow-sm`}>
                <stat.icon className="w-6 h-6 text-gray-700" />
            </div>
            <div className="flex items-center gap-1">
                {stat.trendDirection === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${stat.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>{stat.trend}</span>
            </div>
        </div>

        <div className="relative z-10">
            <p className="text-gray-600 text-sm font-medium mb-2">{stat.title}</p>
            <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
                <span className="text-sm text-gray-600 mb-1">{stat.unit}</span>
            </div>
        </div>

        {stat.chart && (
            <AnimatedLineChart data={stat.chart} gradient={index} />
        )}
        {stat.percentage && (
            <div className="mt-4 flex items-center justify-center">
                <CircularProgress percentage={stat.percentage} size={80} showAnimation={false} />
            </div>
        )}
    </GlowingCard>
);