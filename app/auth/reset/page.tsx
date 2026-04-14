"use client";

import { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Invalid or missing reset link");
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(
          `http://localhost:8000/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          setTokenValid(true);
          setError(null);
        } else {
          const data = await res.json();
          setError(data.detail || "Reset link has expired or is invalid");
        }
      } catch (err) {
        setError("Failed to validate reset link");
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const validatePasswords = () => {
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setError("Password must contain uppercase, lowercase, and numbers");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePasswords()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`http://localhost:8000/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to reset password");
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/auth";
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex justify-center mb-6">
              <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Validating reset link...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-2 text-foreground">
              Invalid Reset Link
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              {error ||
                "This password reset link is invalid or has expired. Please request a new one."}
            </p>
            <Link
              href="/auth"
              className="w-full inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-2 text-foreground">
              Password Reset Successful
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Your password has been successfully reset. You'll be redirected to
              login shortly.
            </p>
            <Link
              href="/auth"
              className="w-full inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const passwordsMatch =
    password && confirmPassword && password === confirmPassword;
  const hasValidLength = password && password.length >= 8;
  const hasUpperCase = password && /[A-Z]/.test(password);
  const hasLowerCase = password && /[a-z]/.test(password);
  const hasNumbers = password && /\d/.test(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="rounded-md border border-border bg-card p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Reset Your Password
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a new password for your Aegis account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter new password"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirm"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Confirm new password"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Password requirements:
              </p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasValidLength ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasValidLength
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    At least 8 characters
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasUpperCase ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasUpperCase ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One uppercase letter
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasLowerCase ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasLowerCase ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One lowercase letter
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasNumbers ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasNumbers ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One number
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      passwordsMatch
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    Passwords match
                  </span>
                </li>
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !tokenValid}
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/auth"
                className="text-foreground hover:underline font-medium"
              >
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-full max-w-md">
            <div className="rounded-md border border-border bg-card p-6 sm:p-8">
              <div className="flex justify-center mb-6">
                <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Loading...
              </p>
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
