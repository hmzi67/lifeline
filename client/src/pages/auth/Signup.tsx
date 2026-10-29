import React, { useState } from "react";
import { User } from "lucide-react";
import image1 from "@/assets/images/landing/hero-1.webp";
import AppleOAuthButton from "@/components/auth/AppleOAuthButton";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import AuthForm from "@/components/auth/AuthForm";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Signup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (data: Record<string, string | boolean>) => {
    setFieldErrors({});
    const { name, email, password } = data as {
      name: string;
      email: string;
      password: string;
    };

    setLoading(true);

    try {
      await signup(name, email, password);
      // Verify pre-fills the address from ?email= so it need not be typed again.
      navigate(`/verify?email=${encodeURIComponent(email)}`);
    } catch (error: any) {
      setLoading(false);
      if (Array.isArray(error)) {
        const formattedErrors: Record<string, string> = {};
        error.forEach((err: { field: string; message: string }) => {
          formattedErrors[err.field] = err.message;
        });
        setFieldErrors(formattedErrors);
      } else {
        setFieldErrors({ general: error.message || 'Signup failed' });
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden ">
      {/* Background Image with Overlay */}
      <img
        src={image1}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover brightness-50"
      />
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="w-12 h-12 mx-auto bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Sign up to create an account
            </h1>
            <p className="text-gray-300 text-sm">
              Start your wellness journey today.
            </p>
          </div>

          {/* Form Container */}
          <div className="p-6">
            <AuthForm
              mode="signup"
              onSubmit={handleSignup}
              loading={loading}
              errors={fieldErrors}
            />

            {/* Divider */}
            <div className="my-6 flex items-center">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="px-4 text-gray-300 text-sm">Or continue with</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div>

            {/* Social Auth Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <GoogleOAuthButton text="Google" className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/10 transition-all duration-200 group" />
              <AppleOAuthButton text="Apple" className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/10 transition-all duration-200 group" />
            </div>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-300 text-sm">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
