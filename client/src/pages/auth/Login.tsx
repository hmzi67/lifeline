import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthForm from '../../components/auth/AuthForm';
import AuthLayout from '../../components/auth/AuthLayout';
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';
import { useAuth } from '../../contexts/AuthContext';
import { getPostLoginRedirectPath } from '@/lib/onboarding';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  // Social sign-in failures return here as ?error=<message> (see OAuthCallback).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>((): Record<string, string> => {
    const oauthError = searchParams.get('error');
    return oauthError ? { general: oauthError } : {};
  });
  const { login } = useAuth();

  const handleLogin = async (data: Record<string, string | boolean>) => {
    setFieldErrors({})
    const {
      email,
      password,
    } = data as {
      email: string;
      password: string;
    };

    setLoading(true);

    try {
      await login(email, password);

      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const redirectPath = await getPostLoginRedirectPath(storedUser?.id);
      navigate(redirectPath);

    } catch (error: any) {
      setLoading(false);
      if (Array.isArray(error)) {
        const formattedErrors: Record<string, string> = {};
        error.forEach((err: { field: string; message: string }) => {
          formattedErrors[err.field] = err.message;
        });
        setFieldErrors(formattedErrors);
      } else {
        setFieldErrors({ general: error.message || 'Login failed' });
      }
    }

  };

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Welcome back! Let's continue your wellness journey."
      bottomText={
        <p className="text-gray-600">
          Don't have an account?{' '}
          <Link className="text-primary-600 hover:text-primary-700 font-medium" to={'/signup'}>
            Sign up
          </Link>
        </p>
      }
      social={<SocialAuthButtons />}
    >
      <AuthForm
        mode="login"
        onSubmit={handleLogin}
        loading={loading}
        errors={fieldErrors}
      />
    </AuthLayout>
  );
};

export default Login;