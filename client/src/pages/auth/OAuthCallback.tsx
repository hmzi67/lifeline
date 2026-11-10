import api from '@/lib/axios';
import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getPostLoginRedirectPath } from '@/lib/onboarding';

const OAuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setToken, setUser } = useAuth();
    // The sign-in code works once, so the exchange must not run twice (for
    // example when StrictMode re-runs effects in development).
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;

        const code = searchParams.get('code');
        const error = searchParams.get('error');

        // Drop the code from the address bar and history straight away.
        window.history.replaceState(window.history.state, '', window.location.pathname);

        const completeSignIn = async (signInCode: string) => {
            try {
                const exchange = await api.post('/auth/oauth/exchange', { code: signInCode });
                const accessToken = exchange.data?.data?.accessToken;
                if (!accessToken) throw new Error('No access token in exchange response');

                // Sync the access token into AuthContext (also persists to localStorage)
                setToken(accessToken);
            } catch (err) {
                console.error(err);
                navigate(`/login?error=${encodeURIComponent('Sign-in could not be completed. Please try again.')}`, { replace: true });
                return;
            }

            try {
                const res = await api.get('/auth/me');
                const user = res.data?.data?.user;

                // Sync user into AuthContext (also persists to localStorage)
                setUser(user);

                const redirectPath = await getPostLoginRedirectPath(user?.id);
                navigate(redirectPath);
            } catch (err) {
                console.error(err);
                navigate(`/login?error=${encodeURIComponent('Signed in, but your account could not be loaded. Please try again.')}`);
            }
        };

        if (error) {
            // Handle OAuth errors
            console.error('OAuth error:', error);
            let errorMessage = 'Authentication failed. Please try again.';

            switch (error) {
                case 'oauth_failed':
                    errorMessage = 'Google authentication failed. Please try again.';
                    break;
                case 'oauth_error':
                    errorMessage = 'An error occurred during authentication.';
                    break;
                case 'oauth_denied':
                    errorMessage = 'Google authentication was denied.';
                    break;
                case 'token_generation_failed':
                    errorMessage = 'Failed to generate authentication tokens.';
                    break;
                case 'apple_cancelled':
                    navigate('/login');
                    return;
                case 'apple_failed':
                    errorMessage = 'Apple authentication failed. Please try again.';
                    break;
                case 'apple_account_conflict':
                    errorMessage = 'This email is already linked to a different Apple account.';
                    break;
                case 'apple_not_configured':
                    errorMessage = 'Sign in with Apple is not available right now.';
                    break;
            }

            // Redirect to login with error message
            navigate(`/login?error=${encodeURIComponent(errorMessage)}`);
            return;
        }

        if (code) {
            completeSignIn(code);
            return;
        }

        // If no token or error, redirect to login
        navigate('/login');
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-600">Completing authentication...</p>
                </div>
            </div>
        </div>
    );
};

export default OAuthCallback;
