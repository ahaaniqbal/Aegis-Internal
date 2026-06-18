'use client';

/**
 * Auth — sign in / sign up / forgot password.
 *
 * Layout pattern: split-screen, Linear / Resend / Vercel idiom.
 *   ┌─────────────────────┬───────────────────────────┐
 *   │  Brand showcase     │  Form                     │
 *   │  (warm gradient,    │  (centered, white panel,  │
 *   │  shield mark, copy, │  AlignUI Inputs/Buttons)  │
 *   │  feature bullets)   │                           │
 *   └─────────────────────┴───────────────────────────┘
 *
 * Below `lg`, the showcase panel collapses; the form fills the viewport
 * with a centered AegisLogo at the top so the page still reads as a
 * polished entry point on mobile.
 *
 * Visual notes:
 * - Showcase panel: same warm orange→white gradient family as the
 *   dashboard's Decision Overview hero. Inset 4px on all sides so it
 *   reads as a "panel within the page" instead of bleeding off the edge.
 * - Form uses the shared <Input> + <Button> primitives so type, focus
 *   rings, and hover states match the rest of the dashboard exactly.
 * - Motion: fade-up on mount via staggerContainer; mode switches use
 *   AnimatePresence with emphasized-decel easing.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MailCheck,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useUser, useEmail } from '@/lib/hooks';
import { User } from '@/lib/types';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { apiFetch } from '@/lib/api';

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

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// Feature bullets shown in the brand-showcase panel. Each pairs a concrete
// concept with a brand-colored Lucide glyph rendered inside a soft warm tint.
const FEATURE_BULLETS: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: 'Audit every agent action',
    description: 'An immutable record of every tool call, decision, and outcome.',
    icon: FileText,
  },
  {
    title: 'Policies gate the dangerous moves',
    description: 'Allow, rewrite, or require approval. Defined once, enforced everywhere.',
    icon: ShieldCheck,
  },
  {
    title: 'Approve sensitive actions in one click',
    description: 'A human stays in the loop for the moves that matter.',
    icon: BadgeCheck,
  },
];

export default function AuthPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;
  const router = useRouter();
  const reduce = useReducedMotion();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const validateEmail = (e: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

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
      window.location.href = `${BACKEND_URL}/auth/login/${provider}`;
    } catch {
      setOauthError({
        [provider]: `Could not connect to ${provider === 'google' ? 'Google' : 'GitHub'}`,
      });
      setOauthLoading(null);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(30);
    try {
      const res = await apiFetch(`${BACKEND_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: signupEmail }),
      });
      setResendMessage(res.ok ? 'Email resent' : 'Failed to resend');
    } catch {
      setResendMessage('Failed to resend');
    }
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    try {
      const res = await apiFetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.detail || data.message) {
          throw data.detail || {
            code: 'UNKNOWN_ERROR',
            message: 'Signup failed',
          };
        }
        throw new Error('Signup failed');
      }
      setSignupEmail(email);
      setSignupSuccess(true);
    } catch (err: any) {
        const detail = err?.detail || err;

        switch (detail.code) {
          case 'ACCOUNT_EXISTS':
            setErrors({ form: 'email_exists' });
            break;

          case 'SIGNUP_FAILED':
            setErrors({
              form: 'Could not create account. Please try again.',
            });
            break;

          default:
            setErrors({
              form: detail.message || 'Something went wrong.',
            });
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
    const res = await apiFetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
      credentials: 'include',
      redirect: 'manual',
    });

    /**
     * IMPORTANT:
     * Backend returns 307 RedirectResponse
     * fetch() with redirect: 'manual'
     * prevents CORS redirect failure
     */

    if (
      res.type === 'opaqueredirect' ||
      res.status === 307
    ) {
      const onboardingRes = await apiFetch(
        `${BACKEND_URL}/auth/onboarding-step`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!onboardingRes.ok) {
        throw new Error('Failed to fetch onboarding step');
      }

      const onboardingData = await onboardingRes.json();
      const onboardingStep = onboardingData.onboarding_step; 
      const userData: User = {
        email,
        github_user_id: 0,
        username: '',
        access_token: '',
      };

      setUser(userData);

      setLoggingIn(true);

      setTimeout(() => {
        if (
          onboardingStep >= 0 &&
          onboardingStep < 4
        ) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      }, 1000);

      return;
    }

    /**
     * Error response handling
     */

    let data: any = {};

    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw data;
    }

    /**
     * Optional success path
     * if backend sometimes returns 200 JSON
     */

    const userData: User = {
      email,
      github_user_id: data.github_user_id || 0,
      username: data.username || '',
      access_token: data.access_token || '',
    };

    setUser(userData);

    setLoggingIn(true);

    setTimeout(() => {
      router.push('/onboarding');
    }, 1000);

  } catch (err: any) {
    console.log('LOGIN ERROR:', err);

    const detail =
      err?.detail ||
      err;

    /**
     * Backend structured errors
     */

    switch (detail?.code) {
      case 'ACCOUNT_NOT_FOUND':
        setErrors({
          form: 'Account not found.',
        });
        break;

      case 'INVALID_PASSWORD':
        setErrors({
          form: 'Incorrect password.',
        });
        break;

      case 'EMAIL_NOT_VERIFIED':
        setErrors({
          form: 'Please verify your email first.',
        });
        break;

      default:
        setErrors({
          form:
            detail?.message ||
            detail?.detail ||
            err?.message ||
            'Something went wrong. Please try again.',
        });
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
      await apiFetch(`${BACKEND_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
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
    if (mode === 'signup') handleSignup();
    else if (mode === 'signin') handleLogin();
    else handleForgotPassword();
  };

  // ── Logging-in overlay ────────────────────────────────────────────────
  if (loggingIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="h-7 w-7 animate-spin"
            style={{ color: 'var(--primary-base)' }}
          />
          <p className="text-[13px] text-[var(--neutral-sub-600)]">Logging you in…</p>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--bg-app)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── LEFT: brand showcase (hidden below lg) ─────────────────── */}
      <ShowcasePanel reduce={!!reduce} />

      {/* ── RIGHT: form ────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:px-12">
        {/* Mobile-only top brand mark (left panel is hidden on small screens) */}
        <div className="flex items-center justify-between lg:hidden">
          <AegisLogo
            style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
        </div>

        {/* Top-right context switch — opposite of current mode */}
        <div className="hidden items-center justify-end gap-2 text-[12.5px] text-[var(--neutral-sub-600)] lg:flex">
          {mode === 'signin' ? (
            <>
              <span>New to Aegis?</span>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="inline-flex items-center gap-1 font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
              >
                Create an account
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </>
          ) : mode === 'signup' ? (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="inline-flex items-center gap-1 font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
              >
                Log in
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="inline-flex items-center gap-1 font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
            >
              Back to log in
            </button>
          )}
        </div>

        {/* Centered form column */}
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="w-full max-w-[420px] py-8"
            variants={staggerContainer(0.06, 0.04)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            <AnimatePresence mode="wait" initial={false}>
              {signupSuccess ? (
                <motion.div
                  key="signup-success"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: EASE_EMPH }}
                >
                  <SuccessPanel
                    tone="success"
                    icon={<MailCheck className="h-5 w-5" strokeWidth={2.25} />}
                    title="Check your inbox"
                    description={
                      <>
                        We&rsquo;ve sent a verification link to{' '}
                        <span className="font-semibold text-[var(--neutral-strong-950)]">
                          {signupEmail}
                        </span>
                        .
                      </>
                    }
                  >
                    <div className="text-[13px] text-[var(--neutral-sub-600)]">
                      Didn&rsquo;t get it?{' '}
                      {resendCooldown > 0 ? (
                        <span className="text-[var(--neutral-soft-400)]">
                          Resend in {resendCooldown}s
                        </span>
                      ) : resendMessage ? (
                        <span style={{ color: 'var(--success-dark)' }}>
                          {resendMessage}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendEmail}
                          className="font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
                        >
                          Resend email
                        </button>
                      )}
                    </div>
                  </SuccessPanel>
                </motion.div>
              ) : forgotSuccess ? (
                <motion.div
                  key="forgot-success"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: EASE_EMPH }}
                >
                  <SuccessPanel
                    tone="primary"
                    icon={<MailCheck className="h-5 w-5" strokeWidth={2.25} />}
                    title="Reset link sent"
                    description={
                      <>
                        If an account exists for{' '}
                        <span className="font-semibold text-[var(--neutral-strong-950)]">
                          {forgotEmail}
                        </span>
                        , you&rsquo;ll receive a reset link shortly.
                      </>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-[13px] font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
                    >
                      ← Back to log in
                    </button>
                  </SuccessPanel>
                </motion.div>
              ) : (
                // Mode-switch wrapper. Uses the same staggerContainer
                // variants so propagation to children (`variants={fadeUp}`)
                // continues to work. An inline-object `animate` here
                // would block variant propagation and leave the children
                // stuck at their `hidden` state — i.e., the form would
                // appear blank after a mode switch. We also avoid an
                // inline `transition` prop because that would override
                // the staggerChildren transition baked into the variant.
                <motion.div
                  key={`form-${mode}`}
                  variants={staggerContainer(0.04, 0.02)}
                  initial={reduce ? false : 'hidden'}
                  animate="show"
                  exit="hidden"
                >
                  {/* Eyebrow + page title */}
                  <motion.p
                    variants={fadeUp}
                    className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
                  >
                    {mode === 'signup'
                      ? 'Get started'
                      : mode === 'signin'
                        ? 'Welcome back'
                        : 'Reset access'}
                  </motion.p>
                  <motion.h1
                    variants={fadeUp}
                    className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
                  >
                    {mode === 'signup'
                      ? 'Create your Aegis account'
                      : mode === 'signin'
                        ? 'Log in to Aegis'
                        : 'Forgot your password?'}
                  </motion.h1>
                  <motion.p
                    variants={fadeUp}
                    className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
                  >
                    {mode === 'signup'
                      ? 'Start governing every agent action in under a minute.'
                      : mode === 'signin'
                        ? 'Sign in to see your runs, approvals, and policies.'
                        : "Enter your email and we'll send you a reset link."}
                  </motion.p>

                  {/* OAuth — only for signin/signup */}
                  {mode !== 'forgot' && (
                    <motion.div variants={fadeUp} className="mt-6 space-y-2.5">
                      <OAuthButton
                        provider="google"
                        loading={oauthLoading === 'google'}
                        disabled={oauthLoading !== null}
                        onClick={() => handleOAuth('google')}
                      />
                      {oauthError.google && (
                        <p className="text-[11.5px] text-[var(--error-dark)]">
                          {oauthError.google}
                        </p>
                      )}

                      <OAuthButton
                        provider="github"
                        loading={oauthLoading === 'github'}
                        disabled={oauthLoading !== null}
                        onClick={() => handleOAuth('github')}
                      />
                      {oauthError.github && (
                        <p className="text-[11.5px] text-[var(--error-dark)]">
                          {oauthError.github}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* Divider — only for signin/signup */}
                  {mode !== 'forgot' && (
                    <motion.div
                      variants={fadeUp}
                      className="my-6 flex items-center gap-3"
                    >
                      <div className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                        Or with email
                      </span>
                      <div className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                    </motion.div>
                  )}

                  {/* Form */}
                  <motion.form
                    variants={fadeUp}
                    onSubmit={handleSubmit}
                    className="mt-2 space-y-4"
                    noValidate
                  >
                    {mode === 'signup' && (
                      <Field label="Name" error={errors.name}>
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          invalid={!!errors.name}
                          autoComplete="name"
                        />
                      </Field>
                    )}

                    <Field label="Email" error={errors.email}>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        invalid={!!errors.email}
                        autoComplete="email"
                      />
                    </Field>

                    {mode !== 'forgot' && (
                      <Field
                        label="Password"
                        error={errors.password}
                        trailing={
                          mode === 'signin' && (
                            <button
                              type="button"
                              onClick={() => setMode('forgot')}
                              className="text-[12px] font-medium text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
                            >
                              Forgot password?
                            </button>
                          )
                        }
                      >
                        <PasswordInput
                          value={password}
                          onChange={setPassword}
                          show={showPassword}
                          toggleShow={() => setShowPassword((v) => !v)}
                          invalid={!!errors.password}
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        />
                      </Field>
                    )}

                    {mode === 'signup' && (
                      <Field label="Confirm password" error={errors.confirmPassword}>
                        <PasswordInput
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          show={showConfirmPassword}
                          toggleShow={() => setShowConfirmPassword((v) => !v)}
                          invalid={!!errors.confirmPassword}
                          autoComplete="new-password"
                        />
                      </Field>
                    )}

                    {/* Form-level error */}
                    {errors.form && (
                      <div
                        className="rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-[1.5]"
                        style={{
                          backgroundColor: 'var(--error-lighter)',
                          borderColor: 'rgba(251, 55, 72, 0.22)',
                          color: 'var(--error-dark)',
                        }}
                      >
                        {errors.form === 'email_exists' ? (
                          <>
                            An account with this email already exists.{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signin')}
                              className="font-semibold underline"
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
                              disabled={resendCooldown > 0}
                              className="font-semibold underline disabled:opacity-60"
                            >
                              {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : 'Resend verification email?'}
                            </button>
                          </>
                        ) : errors.form === 'not_found' ? (
                          <>
                            No account found with this email.{' '}
                            <button
                              type="button"
                              onClick={() => setMode('signup')}
                              className="font-semibold underline"
                            >
                              Sign up instead?
                            </button>
                          </>
                        ) : (
                          errors.form
                        )}
                      </div>
                    )}

                    {/* Submit */}
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      disabled={loading}
                      leadingIcon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
                      className="!h-10 !text-[13.5px]"
                    >
                      {mode === 'signup' &&
                        (loading ? 'Creating account…' : 'Create account')}
                      {mode === 'signin' && (loading ? 'Logging in…' : 'Log in')}
                      {mode === 'forgot' && (loading ? 'Sending…' : 'Send reset link')}
                    </Button>

                    {mode === 'forgot' && (
                      <button
                        type="button"
                        onClick={() => setMode('signin')}
                        className="w-full text-center text-[12.5px] font-medium text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
                      >
                        ← Back to log in
                      </button>
                    )}
                  </motion.form>

                  {/* Mobile-only mode-switch link (the top-right link is hidden on mobile) */}
                  <div className="mt-6 text-center text-[12.5px] text-[var(--neutral-sub-600)] lg:hidden">
                    {mode === 'signin' && (
                      <>
                        New to Aegis?{' '}
                        <button
                          type="button"
                          onClick={() => setMode('signup')}
                          className="font-semibold text-[var(--primary-base)]"
                        >
                          Create an account
                        </button>
                      </>
                    )}
                    {mode === 'signup' && (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setMode('signin')}
                          className="font-semibold text-[var(--primary-base)]"
                        >
                          Log in
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer fineprint — constrained to the same 420px column as the
            form above so its left edge optically lines up with the form
            instead of hugging the section padding. */}
        <div className="mx-auto mt-auto w-full max-w-[420px] pt-6">
          <p className="text-center text-[11.5px] text-[var(--neutral-soft-400)] lg:text-left">
            By continuing, you agree to our{' '}
            <a className="hover:text-[var(--neutral-sub-600)]" href="#">
              Terms
            </a>{' '}
            and{' '}
            <a className="hover:text-[var(--neutral-sub-600)]" href="#">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Showcase panel (left half on lg+) ──────────────────────────────────────

function ShowcasePanel({ reduce }: { reduce: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden lg:block">
      {/* Inset gradient panel — same warm orange→white wash family as the
          dashboard's Decision Overview hero. 16px inset on all sides so
          the gradient reads as a card within the viewport, not bleeding. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-4 rounded-[16px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.10) 0%, rgba(250, 115, 25, 0.04) 35%, rgba(255, 255, 255, 0) 75%)',
        }}
      />

      <motion.div
        className="relative flex h-full flex-col p-12"
        variants={staggerContainer(0.07, 0.05)}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Brand mark */}
        <motion.div variants={fadeUp}>
          <AegisLogo
            style={{ height: 24, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
        </motion.div>

        {/* Hero copy — sits a bit above vertical center */}
        <div className="mt-auto pb-4">
          <motion.p
            variants={fadeUp}
            className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            AI Agent Governance
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--neutral-strong-950)]"
          >
            Govern every action your agents take.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[440px] text-[14px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            Aegis sits between your AI agents and the things they touch like
            repos, APIs, and infrastructure. Every move stays intentional,
            auditable, and approved.
          </motion.p>

          {/* Feature bullets — brand-colored icons in soft warm tiles. */}
          <motion.ul variants={fadeUp} className="mt-6 space-y-3.5">
            {FEATURE_BULLETS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(250,115,25,0.18)]"
                    style={{
                      backgroundColor: 'rgba(250, 115, 25, 0.10)',
                      color: 'var(--primary-base)',
                    }}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                  </span>
                  <div className="pt-[3px]">
                    <p className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                      {b.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {b.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </motion.ul>
        </div>
      </motion.div>
    </aside>
  );
}

// ─── Reusable bits ──────────────────────────────────────────────────────────

function Field({
  label,
  error,
  trailing,
  children,
}: {
  label: string;
  error?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-[11.5px]" style={{ color: 'var(--error-dark)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  toggleShow,
  invalid,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
  invalid: boolean;
  autoComplete?: string;
}) {
  return (
    <Input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="••••••••"
      invalid={invalid}
      autoComplete={autoComplete}
      trailingIcon={
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

function OAuthButton({
  provider,
  loading,
  disabled,
  onClick,
}: {
  provider: 'google' | 'github';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with GitHub';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-4 text-[13px] font-medium text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-all hover:border-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          {provider === 'google' ? <GoogleGlyph /> : <GitHubGlyph />}
          {label}
        </>
      )}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC04"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg
      className="h-4 w-4 text-[var(--neutral-strong-950)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function SuccessPanel({
  tone,
  icon,
  title,
  description,
  children,
}: {
  tone: 'success' | 'primary';
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  // Tone determines the icon disc color — success = green, primary = brand orange.
  const halo =
    tone === 'success'
      ? 'rgba(31, 193, 107, 0.18)'
      : 'rgba(250, 115, 25, 0.18)';
  const disc =
    tone === 'success' ? 'var(--success)' : 'var(--primary-base)';

  return (
    <div className="text-center">
      {/* Icon — same halo + saturated disc + white knockout pattern as toasts */}
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center">
        <span className="relative inline-flex h-12 w-12 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: halo }}
            aria-hidden
          />
          <span
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: disc }}
          >
            {icon}
          </span>
        </span>
      </div>
      <h2 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[13.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
