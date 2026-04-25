//auth
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useUser, useEmail } from '@/lib/hooks';
import { User } from '@/lib/types';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

interface OAuthError {
  google?: string;
  github?: string;
}

export default function AuthPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;
  // console.log('Using backend URL:', BACKEND_URL);
  const router = useRouter();
  const { setUser } = useUser();
  const { email, setEmail } = useEmail();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [oauthError, setOauthError] = useState<OAuthError>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Form fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Success states
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Clear form on mode change
  useEffect(() => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setOauthError({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignupSuccess(false);
    setForgotSuccess(false);
  }, [mode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Clear resend message after 5 seconds
  useEffect(() => {
    if (resendMessage) {
      const timer = setTimeout(() => setResendMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [resendMessage]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (mode === 'signup' && !name.trim()) {
      newErrors.name = 'This field is required';
    }

    if (!email.trim()) {
      newErrors.email = 'This field is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (mode !== 'forgot') {
      if (!password) {
        newErrors.password = 'This field is required';
      } else if (mode === 'signup' && password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (mode === 'signup') {
        if (!confirmPassword) {
          newErrors.confirmPassword = 'This field is required';
        } else if (password !== confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [mode, name, email, password, confirmPassword]);

  const handleOAuth = (provider: 'google' | 'github') => {
  setOauthLoading(provider);
  setOauthError({});

  try {
    if (provider === 'google') {
      // Redirect to backend Google login
      console.log(`Redirecting to ${BACKEND_URL}/auth/login/google`);
      window.location.href = `${BACKEND_URL}/auth/login/google`;
    }

    if (provider === 'github') {
      window.location.href = `${BACKEND_URL}/auth/login/github`;
    }
  } catch {
    setOauthError({
      [provider]: `Could not connect to ${provider === 'google' ? 'Google' : 'GitHub'}`
    });
    setOauthLoading(null);
  }
};

const handleResendEmail = async () => {
  if (resendCooldown > 0) return;

  setResendCooldown(30);

  try {
    const res = await fetch(`${BACKEND_URL}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: signupEmail }),
    });

    if (res.ok) {
      setResendMessage("Email resent");
    } else {
      setResendMessage("Failed to resend");
    }

  } catch {
    setResendMessage("Failed to resend");
  }
};

  const handleSignup = async () => {
  if (!validateForm()) return;

  setLoading(true);
  setErrors({});

  try {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    if (!res.ok) {
      const data = await res.json();

      if (data.detail || data.message) {
        throw new Error(data.detail || data.message);
      }

      throw new Error("Signup failed");
    }

    const data = await res.json();

    setSignupEmail(email);
    setSignupSuccess(true);

  } catch (err: any) {
    if (err.message.includes("already exists")) {
      setErrors({ form: "email_exists" });
    } else {
      setErrors({ form: err.message || "Something went wrong" });
    }
  } finally {
    setLoading(false);
  }
};

  const handleLogin = async () => {
  if (!validateForm()) return;

  setLoading(true);
  setErrors({});

  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Login failed");
    }

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);

    // Store user data with email
    const userData: User = {
      email: email,
      github_user_id: data.github_user_id || 0,
      username: data.username || '',
      access_token: data.access_token || '',
    };
    setUser(userData);

    setLoggingIn(true);

    setTimeout(() => {
      router.push("/onboarding");
    }, 1000);

  } catch (err: any) {
    const message = err.message;

    if (message.includes("Invalid credentials")) {
      setErrors({ form: "Incorrect email or password." });
    } else {
      setErrors({ form: "Something went wrong. Please try again." });
    }
  } finally {
    setLoading(false);
  }
};

const handleForgotPassword = async () => {
  const newErrors: FormErrors = {};
  
  if (!email.trim()) {
    newErrors.email = 'This field is required';
  } else if (!validateEmail(email)) {
    newErrors.email = 'Please enter a valid email address';
  }
  
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  setLoading(true);
  setErrors({});

  try {
    await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    setForgotEmail(email);
    setForgotSuccess(true);

  } catch {
    setErrors({ form: 'Something went wrong. Please try again.' });
  } finally {
    setLoading(false);
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'signup') {
      handleSignup();
    } else if (mode === 'signin') {
      handleLogin();
    } else {
      handleForgotPassword();
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-md border ${hasError ? 'border-destructive' : 'border-border'} bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none`;

  const labelClass = (hasError: boolean) =>
    `mb-1.5 block text-xs font-medium ${hasError ? 'text-destructive' : 'text-muted-foreground'}`;

  // Logging in overlay
  if (loggingIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-foreground" />
          <p className="text-sm text-muted-foreground">Logging you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Aegis</h1>
        </div>

        {/* Sign Up Success */}
        {signupSuccess ? (
          <div className="rounded-md border border-border bg-card p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="mb-2 text-base font-semibold text-foreground">Check your inbox</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {"We've sent a verification link to "}
                <span className="font-medium text-foreground">{signupEmail}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {"Didn't get it? "}
                {resendCooldown > 0 ? (
                  <span className="text-muted-foreground">Resend in {resendCooldown}s</span>
                ) : resendMessage ? (
                  <span className="text-success">{resendMessage}</span>
                ) : (
                  <button
                    onClick={handleResendEmail}
                    className="font-medium text-foreground hover:underline"
                  >
                    Resend email
                  </button>
                )}
              </p>
            </div>
          </div>
        ) : forgotSuccess ? (
          /* Forgot Password Success */
          <div className="rounded-md border border-border bg-card p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10">
                <svg className="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{forgotEmail}</span>, {"you'll receive a reset link shortly."}
              </p>
              <button
                onClick={() => setMode('signin')}
                className="text-sm font-medium text-foreground hover:underline"
              >
                Back to Log In
              </button>
            </div>
          </div>
        ) : (
          /* Auth Card */
          <div className="rounded-md border border-border bg-card">
            {/* Tabs - only show for signin/signup */}
            {mode !== 'forgot' && (
              <div className="flex border-b border-border">
                <button
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === 'signup'
                      ? 'border-b-2 border-foreground text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => setMode('signin')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === 'signin'
                      ? 'border-b-2 border-foreground text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Log In
                </button>
              </div>
            )}

            <div className="p-6">
              {/* Forgot Password Header */}
              {mode === 'forgot' && (
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-foreground">Reset password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {"Enter your email and we'll send you a reset link."}
                  </p>
                </div>
              )}

              {/* OAuth Buttons - only show for signin/signup */}
              {mode !== 'forgot' && (
                <>
                  <div className="space-y-3">
                    {/* Google OAuth */}
                    <button
                      onClick={() => handleOAuth('google')}
                      disabled={oauthLoading !== null}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                    >
                      {oauthLoading === 'google' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="currentColor"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="currentColor"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </button>
                    {oauthError.google && (
                      <p className="text-xs text-destructive">{oauthError.google}</p>
                    )}

                    {/* GitHub OAuth */}
                    <button
                      onClick={() => handleOAuth('github')}
                      disabled={oauthLoading !== null}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                    >
                      {oauthLoading === 'github' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                          Continue with GitHub
                        </>
                      )}
                    </button>
                    {oauthError.github && (
                      <p className="text-xs text-destructive">{oauthError.github}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name field - signup only */}
                {mode === 'signup' && (
                  <div>
                    <label className={labelClass(!!errors.name)}>Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass(!!errors.name)}
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>
                )}

                {/* Email field */}
                <div>
                  <label className={labelClass(!!errors.email)}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass(!!errors.email)}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Password field - not for forgot mode */}
                {mode !== 'forgot' && (
                  <div>
                    <label className={labelClass(!!errors.password)}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass(!!errors.password)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-destructive">{errors.password}</p>
                    )}
                    {/* Forgot password link - signin only */}
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                )}

                {/* Confirm Password - signup only */}
                {mode === 'signup' && (
                  <div>
                    <label className={labelClass(!!errors.confirmPassword)}>Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass(!!errors.confirmPassword)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}

                {/* Form errors */}
                {errors.form && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errors.form === 'email_exists' ? (
                      <>
                        An account with this email already exists.{' '}
                        <button
                          type="button"
                          onClick={() => setMode('signin')}
                          className="font-medium underline"
                        >
                          Log in instead?
                        </button>
                      </>
                    ) : errors.form === 'unverified' ? (
                      <>
                        Please verify your email before logging in.{' '}
                        <button
                          type="button"
                          onClick={handleResendEmail}
                          className="font-medium underline"
                          disabled={resendCooldown > 0}
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email?'}
                        </button>
                      </>
                    ) : errors.form === 'not_found' ? (
                      <>
                        No account found with this email.{' '}
                        <button
                          type="button"
                          onClick={() => setMode('signup')}
                          className="font-medium underline"
                        >
                          Sign up instead?
                        </button>
                      </>
                    ) : (
                      errors.form
                    )}
                  </div>
                )}

                {/* CAPTCHA placeholder */}
                {/* TODO: Add CAPTCHA here */}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === 'signup' && (loading ? 'Creating account...' : 'Create Account')}
                  {mode === 'signin' && (loading ? 'Logging in...' : 'Log In')}
                  {mode === 'forgot' && (loading ? 'Sending...' : 'Send reset link')}
                </button>

                {/* Back to login - forgot mode only */}
                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to Log In
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
