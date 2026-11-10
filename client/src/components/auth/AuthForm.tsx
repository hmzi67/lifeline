import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import {Link} from "react-router-dom";

export interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (data: Record<string, string | boolean>) => void;
  loading?: boolean;
  errors?: Record<string, string>;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, onSubmit, loading, errors = {} }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup') {
      onSubmit({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
    } else {
      onSubmit({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Name field */}
      {mode === "signup" && (
        <>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Name"
            className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${errors.name ? "border-red-400" : ""}`}
            required
          />
        </div>
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name} NAME ERROR</p>
          )}
        </>
      )}

      {/* Email field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Mail className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Email"
          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${errors.email ? "border-red-400" : ""}`}
          required
        />
      </div>
      {errors.email && (
        <p className="text-sm text-red-600 mt-1">{errors.email}</p>
      )}

      {/* Password field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          placeholder="Password"
          // New passwords need 12+ characters; sign-in must still accept older, shorter ones.
          minLength={mode === 'signup' ? 12 : undefined}
          className={`w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${errors.password ? "border-red-400" : ""}`}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute inset-y-0 right-0 pr-3 flex items-center`}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          ) : (
            <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          )}
        </button>
      </div>
      {errors.password && (
        <p className="text-sm text-red-600">{errors.password}</p>
      )}

      {/* Remember me */}
      {mode === "login" && (
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
            />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>
          <Link to={"/reset-password"}>
            <button
                type="button"
                className="text-sm text-gray-600 hover:text-primary-600"
            >
              Forgot password?
            </button>
          </Link>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        className="flex items-center justify-center w-full bg-primary-500 text-white py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors transform hover:scale-[1.02] active:scale-[0.98]"
        disabled={loading}
      >
        {/*{loading ? "Loading..." : mode === "signup" ? "Sign Up" : "Sign In"}*/}
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Please Wait ...
          </>
        ) : (
          mode === "signup" ? "Sign Up" : "Sign In"
        )}
      </button>
      {errors.general && (
        <div className="text-red-600 text-sm w-full text-center font-medium">
          {errors.general}
        </div>
      )}
    </form>
  );
};

export default AuthForm;
