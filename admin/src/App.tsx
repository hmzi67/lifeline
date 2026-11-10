import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar, Header } from '@/components/layout';
import LoginPage from '@/components/pages/LoginPage';
import { navigationItems } from '@/components/constants';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';

// Each section is its own chunk, so the login screen doesn't download the whole panel.
const DashboardComponent = lazy(() => import('@/components/dashboard').then((m) => ({ default: m.DashboardComponent })));
const UsersComponent = lazy(() => import('@/components/pages/UsersComponent'));
const RoleComponent = lazy(() => import('@/components/pages/RoleComponent'));
const DietComponent = lazy(() => import('@/components/pages/DietComponent'));
const MealTypeComponent = lazy(() => import('@/components/pages/MealTypeComponent'));
const ExerciseComponent = lazy(() => import('@/components/pages/ExerciseComponent'));
const ExercisePlanComponent = lazy(() => import('@/components/pages/ExercisePlanComponent'));
const AnnouncementComponent = lazy(() => import('@/components/pages/AnnouncementComponent'));
const ChallengeComponent = lazy(() => import('@/components/pages/ChallengeComponent'));
const MeditationComponent = lazy(() => import('@/components/pages/MeditationComponent'));
const SleepStoriesComponent = lazy(() => import('@/components/pages/SleepStoriesComponent'));
const SleepSoundsComponent = lazy(() => import('@/components/pages/SleepSoundsComponent'));
const BlogCategoryComponent = lazy(() => import('@/components/pages/BlogCategoryComponent'));
const BlogComponent = lazy(() => import('@/components/pages/BlogComponent'));
const PricingPlanComponent = lazy(() => import('@/components/pages/PricingPlanComponent'));
const CouponComponent = lazy(() => import('@/components/pages/CouponComponent'));
const ReferralComponent = lazy(() => import('@/components/pages/ReferralComponent'));

const SectionFallback = () => (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
    </div>
);

// ── Protected layout ──────────────────────────────────────────────────────────
// Below Tailwind's `lg` breakpoint the open sidebar would cover most of the page.
const isWideScreen = () => window.matchMedia('(min-width: 1024px)').matches;

const AdminLayout: React.FC = () => {
    const [activeNav, setActiveNavState] = useState<string>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(isWideScreen);

    const setActiveNav = (nav: string) => {
        setActiveNavState(nav);
        if (!isWideScreen()) setSidebarOpen(false);
    };

    const renderContent = () => {
        switch (activeNav) {
            case 'dashboard':
                return <DashboardComponent />;
            case 'users':
                return <UsersComponent />;
            case 'roles':
                return <RoleComponent />;
            case 'diet':
                return <DietComponent />;
            case 'mealTypes':
                return <MealTypeComponent />;
            case 'exercise':
                return <ExerciseComponent />;
            case 'exercisePlans':
                return <ExercisePlanComponent />;
            case 'challenges':
                return <ChallengeComponent />;
            case 'mindMeditation':
                return <MeditationComponent />;
            case 'sleepStories':
                return <SleepStoriesComponent />;
            case 'sleepSounds':
                return <SleepSoundsComponent />;
            case 'blogCategories':
                return <BlogCategoryComponent />;
            case 'blog':
                return <BlogComponent />;
            case 'pricingPlans':
                return <PricingPlanComponent />;
            case 'coupons':
                return <CouponComponent />;
            case 'notifications':
                return <AnnouncementComponent />;
            case 'referralCodes':
                return <ReferralComponent />;
            default:
                return <DashboardComponent />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 flex relative">
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                activeNav={activeNav}
                setActiveNav={setActiveNav}
                navigationItems={navigationItems}
            />
            <main className="flex-1 min-w-0 overflow-x-hidden">
                <div className="p-4 sm:p-8">
                    <Header activeNav={activeNav} />
                    <Suspense fallback={<SectionFallback />}>{renderContent()}</Suspense>
                </div>
            </main>
        </div>
    );
};

// ── Auth guard ────────────────────────────────────────────────────────────────
// The persisted flag only says someone signed in here once. The server decides: nothing of
// the panel renders until /auth/me confirms an admin, and anyone else is signed out.
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const logout = useAuthStore((s) => s.logout);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        let live = true;
        authService
            .getCurrentUser()
            .then((res) => res?.data?.user?.role?.name?.toLowerCase() === 'admin')
            .catch(() => false)
            .then((admin) => {
                if (!live) return;
                // Clearing the store also stops the login page sending us straight back here.
                if (admin) setIsAdmin(true);
                else logout();
            });
        return () => {
            live = false;
        };
    }, [isAuthenticated, logout]);

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return isAdmin ? <>{children}</> : <SectionFallback />;
};

// ── Root app ──────────────────────────────────────────────────────────────────
const App: React.FC = () => (
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
            path="/*"
            element={
                <ProtectedRoute>
                    <AdminLayout />
                </ProtectedRoute>
            }
        />
    </Routes>
);

export default App;
