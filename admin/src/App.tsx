import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, Header } from '@/components/layout';
import { LoginPage, UsersComponent, DietComponent, ExerciseComponent, BlogComponent, MeditationComponent, RoleComponent, BlogCategoryComponent, MealTypeComponent, ChallengeComponent, SleepStoriesComponent, SleepSoundsComponent } from '@/components/pages';
import { navigationItems } from '@/components/constants';
import { DashboardComponent } from '@/components/dashboard';
import { useAuthStore } from '@/store/useAuthStore';
import CouponComponent from './components/pages/CouponComponent';
import ReferralComponent from './components/pages/ReferralComponent';
import PricingPlanComponent from './components/pages/PricingPlanComponent';

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
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

// ── Auth guard ────────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
