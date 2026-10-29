import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import './App.css';
import Layout from './components/common/Layout';
import ScrollToTop from './components/common/ScrollToTop';
import Loading from "@/components/common/Loading.tsx";
import Verify from "@/pages/auth/Verify.tsx";
import ResetPassword from "@/pages/auth/ResetPassword.tsx";
import OAuthCallback from "@/pages/auth/OAuthCallback.tsx";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from '@/components/routes/ProtectedRoutes';


// Lazy-loaded page components
const Landing = lazy(() => import('./pages/marketing/Landing'));
const Business = lazy(() => import('./pages/marketing/Business'));
const Blog = lazy(() => import('./pages/content/Blog'));
const BlogReading = lazy(() => import('./pages/content/BlogReading'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const Analytics = lazy(() => import('./pages/fitness/Analytics'));
const Pricing = lazy(() => import('./pages/marketing/Pricing'));
const Affiliate = lazy(() => import('./pages/marketing/Affiliate'));
const Contact = lazy(() => import('./pages/marketing/Contact'));
const Checkout = lazy(() => import('@/pages/marketing/Checkout'));
// Lazy so Stripe.js loads only on the plan page, not on every page of the site.
const Plan = lazy(() => import('./pages/marketing/Plan'));
const Questions = lazy(() => import('@/pages/marketing/Questions'));
const Error = lazy(() => import('./pages/utility/Error'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/legal/TermsAndConditions'));
const CookiePolicy = lazy(() => import('./pages/legal/CookiePolicy'));
const CommingSoon = lazy(() => import('./pages/utility/CommingSoon'));
const Profile = lazy(() => import('./pages/auth/Profile'));
const DeleteAccount = lazy(() => import('./pages/legal/DeleteAccount'));
const Support = lazy(() => import('./pages/marketing/Support'));
const AppMarketing = lazy(() => import('./pages/marketing/AppMarketing'));

function App() {

  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* Public routes - accessible to everyone */}
              <Route path="/" element={<Landing />} />
              <Route path="/business" element={<Business />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogReading />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/affiliate" element={<Affiliate />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/error" element={<Error type="error4" />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/coming-soon" element={<CommingSoon />} />
              {/* Public account-deletion page — required by the Play Store listing */}
              <Route path="/delete-account" element={<DeleteAccount />} />
              {/* App Store listing pages — Support URL and Marketing URL */}
              <Route path="/support" element={<Support />} />
              <Route path="/app" element={<AppMarketing />} />

              {/* Authentication routes - only accessible when not logged in */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />

              {/* Fitness Band product page, linked from the public nav */}
              <Route path="/analytics" element={<Analytics />} />

              {/* Protected routes - only accessible when logged in */}
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path='/plan' element={<ProtectedRoute><Plan /></ProtectedRoute>} />
              <Route path="/profile" element={<Profile />} />

              {/* 404 route */}
              <Route path="*" element={<Error type="error3" />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
