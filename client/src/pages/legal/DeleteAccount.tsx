import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import type { AxiosRequestConfig } from "axios";
import api from "@/lib/axios.ts";
import { useAuth } from "../../contexts/AuthContext";

const SUPPORT_EMAIL = "support@lifeline.com";

const DELETED_DATA = [
  "Your account, login credentials and profile details (name, email, profile photo)",
  "Onboarding answers, health goals and questionnaire responses",
  "All tracked activity — diet and meal logs, exercise and workout progress, water, sleep, fasting, meditation and medication reminders",
  "Challenge participation, referrals and saved favourites",
];

const RETAINED_DATA = [
  {
    what: "Billing and payment records",
    why: "Kept for up to 7 years where tax and accounting law requires it. These are stored against the transaction, not your profile.",
  },
  {
    what: "Anonymised, aggregated usage statistics",
    why: "Cannot be linked back to you and is retained indefinitely to improve the service.",
  },
];

const DeleteAccount: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both your email and password.");
      return;
    }
    if (!confirmed) {
      setError("Please tick the box to confirm you understand this is permanent.");
      return;
    }

    setLoading(true);
    try {
      // Authenticate with the supplied credentials. This works whether or not
      // the visitor already has a session, so the page is usable straight from
      // the Play Store listing without signing in first.
      const loginRes = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      const accessToken = loginRes.data?.data?.accessToken;

      if (!accessToken) {
        throw new Error("Could not verify your credentials. Please try again.");
      }

      const deleteConfig: AxiosRequestConfig & { _retry?: boolean } = {
        data: { email: email.trim(), password },
        headers: { Authorization: `Bearer ${accessToken}` },
        // Skip the refresh-and-retry interceptor: these credentials were just
        // verified, so a 401 here is a real error, not an expired session.
        _retry: true,
      };

      await api.delete("/user/account", deleteConfig);

      setDone(true);

      // Drop any local session belonging to the account we just removed.
      if (isAuthenticated) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "We couldn't delete your account. Please try again or contact support."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-gray-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Delete your Lifeline account
          </h1>
          <p className="text-gray-600 mt-2">
            This page lets you permanently delete your Lifeline account and the
            data associated with it. You can do this here on the web — you don't
            need the app installed.
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Your account has been deleted
            </h2>
            <p className="text-gray-600 mb-6">
              Your Lifeline account and its associated data have been removed.
              You can close this page — no further action is needed.
            </p>
            <Link to="/">
              <Button className="rounded-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold px-6">
                Back to home
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* What gets removed */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                What gets deleted
              </h2>
              <ul className="space-y-3">
                {DELETED_DATA.map((item) => (
                  <li key={item} className="flex gap-3 text-gray-600 text-sm">
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">
                What we keep, and for how long
              </h2>
              <ul className="space-y-3">
                {RETAINED_DATA.map((item) => (
                  <li key={item.what} className="flex gap-3 text-gray-600 text-sm">
                    <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium text-gray-900">
                        {item.what}
                      </span>{" "}
                      — {item.why}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-gray-500 mt-6">
                Deletion takes effect immediately and cannot be undone. If you
                have an active subscription, cancel it before deleting your
                account to avoid further charges. Need help? Contact us at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </div>

            {/* Confirmation form */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-red-100 p-6 sm:p-8">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Confirm it's you
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Enter the email address and password for the account you want
                    to delete.
                  </p>
                  {/* Google/Apple accounts have no password, so they delete from Profile. */}
                  <p className="text-gray-600 text-sm mt-2">
                    Signed up with Google or Apple?{" "}
                    {isAuthenticated ? (
                      <Link to="/profile" className="text-primary-600 hover:text-primary-700 font-medium">
                        Go to your Profile
                      </Link>
                    ) : (
                      <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                        Sign in with Google or Apple
                      </Link>
                    )}
                    {isAuthenticated ? "" : ", then open your Profile"} and choose{" "}
                    <span className="font-medium text-gray-900">Delete Account</span>; you
                    confirm by typing DELETE instead of a password.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="account-email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="account-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-password" className="text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span>
                    I understand that deleting my account is permanent and that
                    my data cannot be recovered.
                  </span>
                </label>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    className="rounded-full px-6 py-2.5 h-auto font-semibold shadow-md hover:shadow-lg transition-all duration-300"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                    {loading ? "Deleting..." : "Permanently delete my account"}
                  </Button>
                  {isAuthenticated && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full px-6 py-2.5 h-auto"
                      onClick={logout}
                      disabled={loading}
                    >
                      Sign out instead
                    </Button>
                  )}
                </div>
              </form>

              <p className="text-xs text-gray-500 mt-6">
                Signed up with Google? Google accounts have no password — email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary-600 hover:text-primary-700"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                from your registered address and we'll delete your account for
                you.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAccount;
