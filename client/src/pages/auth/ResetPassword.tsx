import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Mail,
  Shield,
  Key,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import api from "@/lib/axios.ts";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();

  // Step tracking
  const [step, setStep] = useState<"request" | "verifyOtp" | "resetSuccess">("request");

  // Request reset
  const [email, setEmail] = useState("");

  // OTP & password reset
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/request-password-reset", { email });
      console.log(response.data);
      setStep("verifyOtp");
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length < 4) {
      setError("Please enter the OTP sent to your email.");
      return;
    }
    if (!password || password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/reset-password", {
        email,
        otp,
        newPassword: password,
      });
      console.log(response.data);

      setStep("resetSuccess");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToRequest = () => {
    setStep("request");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const getPasswordStrength = (password: string) => {
    const criteria = [
      password.length >= 12,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password)
    ];
    const strength = criteria.filter(Boolean).length;
    return { strength, criteria };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${step === "request" ? "bg-primary-500" : "bg-primary-300"
              }`} />
            <div className={`w-3 h-3 rounded-full ${step === "verifyOtp" ? "bg-primary-500" :
              step === "resetSuccess" ? "bg-primary-300" : "bg-gray-200"
              }`} />
            <div className={`w-3 h-3 rounded-full ${step === "resetSuccess" ? "bg-primary-500" : "bg-gray-200"
              }`} />
          </div>
          <p className="text-center text-sm text-gray-500">
            {step === "request" && "Step 1 of 3: Enter Email"}
            {step === "verifyOtp" && "Step 2 of 3: Verify & Reset"}
            {step === "resetSuccess" && "Step 3 of 3: Complete"}
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-6 text-center pb-8">
            {step === "request" && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <Mail className="w-10 h-10 text-primary-600" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Reset Your Password
                  </h1>
                  <p className="text-gray-500 text-sm">
                    Enter your email address and we'll send you a verification code.
                  </p>
                </div>
              </div>
            )}

            {step === "verifyOtp" && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <Shield className="w-10 h-10 text-primary-600" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Verify & Create New Password
                  </h1>
                  <p className="text-gray-500 text-sm">
                    Enter the verification code sent to <span className="font-medium">{email}</span>
                  </p>
                </div>
              </div>
            )}

            {step === "resetSuccess" && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Password Reset Successful!
                  </h1>
                  <p className="text-gray-500 text-sm">
                    Your password has been updated. Redirecting to login...
                  </p>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {step === "request" && (
              <form onSubmit={handleRequestOtp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary-500" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="h-12 rounded-xl border-gray-200 focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-600 text-center">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === "verifyOtp" && (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-6">
                {/* Back Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToRequest}
                  className="mb-4 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to email entry
                </Button>

                {/* OTP Input */}
                <div className="space-y-4">
                  <Label htmlFor="otp" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary-500" />
                    Verification Code
                  </Label>
                  <div className="flex flex-col items-center space-y-4">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => setOtp(value)}
                      className="gap-3"
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot
                          index={0}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                        <InputOTPSlot
                          index={1}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                        <InputOTPSlot
                          index={2}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                      </InputOTPGroup>
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot
                          index={3}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                        <InputOTPSlot
                          index={4}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                        <InputOTPSlot
                          index={5}
                          className="w-12 h-12 text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200"
                        />
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="text-xs text-gray-500 text-center">
                      Enter the 6-digit code sent to your email
                    </p>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary-500" />
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your new password"
                      required
                      className="h-12 rounded-xl border-gray-200 focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="space-y-2">
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full ${i < passwordStrength.strength
                              ? passwordStrength.strength <= 2
                                ? "bg-red-400"
                                : passwordStrength.strength <= 3
                                  ? "bg-yellow-400"
                                  : "bg-green-400"
                              : "bg-gray-200"
                              }`}
                          />
                        ))}
                      </div>
                      <div className="text-xs space-y-1">
                        <div className={`${passwordStrength.criteria[0] ? "text-green-600" : "text-gray-400"}`}>
                          ✓ At least 12 characters
                        </div>
                        <div className={`${passwordStrength.criteria[1] ? "text-green-600" : "text-gray-400"}`}>
                          ✓ One uppercase letter
                        </div>
                        <div className={`${passwordStrength.criteria[2] ? "text-green-600" : "text-gray-400"}`}>
                          ✓ One lowercase letter
                        </div>
                        <div className={`${passwordStrength.criteria[3] ? "text-green-600" : "text-gray-400"}`}>
                          ✓ One number
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary-500" />
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      required
                      className="h-12 rounded-xl border-gray-200 focus:border-primary-400 focus:ring-primary-400/20 transition-all duration-200 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-green-600">Passwords match!</p>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-600 text-center">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || otp.length < 4 || password.length < 12 || password !== confirmPassword}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Key className="w-5 h-5 mr-2" />
                      Reset Password
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === "resetSuccess" && (
              <div className="space-y-6 text-center">
                <div className="w-full h-2 bg-green-100 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <p className="text-sm text-gray-600">
                  You will be automatically redirected to the login page in a few seconds.
                </p>
                <Link to="/login">
                  <Button
                    size="lg"
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Continue to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Remember your password? <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;