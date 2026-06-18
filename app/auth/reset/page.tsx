'use client';

/**
 * Password reset — `?token=...` flow landed on from the email link.
 *
 * Same split-screen pattern as /auth: brand showcase on the left (lg+),
 * form on the right. The three lifecycle states (validating, invalid
 * token, success) each get a centered success-panel treatment matching
 * the auth signup-success / forgot-success panels.
 *
 * Backend wiring preserved exactly as the engineer wrote it:
 *   - `apiFetch` for both endpoints (sends HTTPonly cookies via
 *      credentials: 'include' inside the helper).
 *   - GET /auth/validate-reset-token on mount.
 *   - POST /auth/reset-password on submit, with structured error-code
 *      handling (INVALID_RESET_TOKEN / WEAK_PASSWORD / fallback).
 *   - router.push('/auth') for the post-success redirect.
 */

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MailCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';

const FEATURE_BULLETS = [
  'Audit every agent action',
  'Policies gate the dangerous moves',
  'Approve sensitive actions in one click',
];

function ResetPasswordPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // ─── Validate token on mount (engineer's logic, untouched) ─────────────
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid or missing reset link');
        setValidating(false);
        return;
      }
      try {
        const res = await apiFetch(
          `${BACKEND_URL}/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
        );
        if (res.ok) {
          setTokenValid(true);
          setError(null);
        } else {
          const data = await res.json();
          setError(data.detail || 'Reset link has expired or is invalid');
        }
      } catch {
        setError('Failed to validate reset link');
      } finally {
        setValidating(false);
      }
    };
    validateToken();
  }, [token, BACKEND_URL]);

  // ─── Password strength rules ───────────────────────────────────────────
  const hasValidLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const passwordsMatch =
    !!password && !!confirmPassword && password === confirmPassword;

  const validatePasswords = () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }
    if (!hasValidLength) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return false;
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setError('Password must contain uppercase, lowercase, and numbers');
      return false;
    }
    return true;
  };

  // ─── Submit (engineer's structured-error logic preserved) ──────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validatePasswords()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${BACKEND_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw data.detail || {
          code: 'RESET_FAILED',
          message: 'Failed to reset password',
        };
      }
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        router.push('/auth');
      }, 2000);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      const detail = e?.detail || e;
      switch (detail?.code) {
        case 'INVALID_RESET_TOKEN':
          setError('This reset link is invalid or has expired.');
          break;
        case 'WEAK_PASSWORD':
          setError('Password does not meet security requirements.');
          break;
        default:
          setError(detail?.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────────
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--bg-app)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <ShowcasePanel reduce={!!reduce} />

      <section className="relative flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between lg:hidden">
          <AegisLogo
            style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
        </div>

        <div className="hidden items-center justify-end lg:flex">
          <Link
            href="/auth"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Back to log in
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="w-full max-w-[420px] py-8"
            variants={staggerContainer(0.04, 0.02)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {validating && <ValidatingState />}
            {!validating && !tokenValid && <InvalidTokenState message={error} />}
            {!validating && tokenValid && success && <SuccessState />}
            {!validating && tokenValid && !success && (
              <ResetForm
                password={password}
                confirmPassword={confirmPassword}
                showPassword={showPassword}
                showConfirm={showConfirm}
                loading={loading}
                error={error}
                hasValidLength={hasValidLength}
                hasUpperCase={hasUpperCase}
                hasLowerCase={hasLowerCase}
                hasNumbers={hasNumbers}
                passwordsMatch={passwordsMatch}
                onPasswordChange={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                onConfirmChange={(v) => {
                  setConfirmPassword(v);
                  setError(null);
                }}
                onTogglePassword={() => setShowPassword((s) => !s)}
                onToggleConfirm={() => setShowConfirm((s) => !s)}
                onSubmit={handleSubmit}
              />
            )}
          </motion.div>
        </div>

        <div className="mx-auto mt-auto w-full max-w-[420px] pt-6">
          <p className="text-center text-[11.5px] text-[var(--neutral-soft-400)] lg:text-left">
            Remember your password?{' '}
            <Link
              href="/auth"
              className="font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
            >
              Back to log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Brand showcase (lg+ only) ──────────────────────────────────────────────

function ShowcasePanel({ reduce }: { reduce: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden lg:block">
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
        <motion.div variants={fadeUp}>
          <AegisLogo
            style={{ height: 24, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
        </motion.div>
        <div className="mt-auto pb-4">
          <motion.p
            variants={fadeUp}
            className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            AI Agent Governance
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--neutral-strong-950)]"
          >
            Govern every action your agents take.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[440px] text-balance text-[14px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            Aegis sits between your AI agents and the things they touch like
            repos, APIs, and infrastructure. Every move stays intentional,
            auditable, and approved.
          </motion.p>
          <motion.ul variants={fadeUp} className="mt-6 space-y-2.5">
            {FEATURE_BULLETS.map((title) => (
              <li key={title} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'var(--primary-base)' }}
                >
                  <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />
                </span>
                <span className="text-[13.5px] font-medium tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                  {title}
                </span>
              </li>
            ))}
          </motion.ul>
        </div>
      </motion.div>
    </aside>
  );
}

// ─── States ─────────────────────────────────────────────────────────────────

function ValidatingState() {
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <Loader2
        className="h-7 w-7 animate-spin"
        style={{ color: 'var(--primary-base)' }}
      />
      <p className="text-[13.5px] text-[var(--neutral-sub-600)]">
        Validating reset link…
      </p>
    </motion.div>
  );
}

function InvalidTokenState({ message }: { message: string | null }) {
  return (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center">
        <span className="relative inline-flex h-12 w-12 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: 'rgba(251, 55, 72, 0.18)' }}
            aria-hidden
          />
          <span
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--error)' }}
            aria-hidden
          >
            <AlertCircle className="h-5 w-5 text-white" strokeWidth={2.25} />
          </span>
        </span>
      </div>
      <h2 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        Invalid reset link
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-balance text-[13.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
        {message ||
          'This password reset link is invalid or has expired. Please request a new one.'}
      </p>
      <Link
        href="/auth"
        className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-all hover:bg-[var(--neutral-weak-50)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to log in
      </Link>
    </motion.div>
  );
}

function SuccessState() {
  return (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center">
        <span className="relative inline-flex h-12 w-12 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: 'rgba(31, 193, 107, 0.18)' }}
            aria-hidden
          />
          <span
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--success)' }}
            aria-hidden
          >
            <MailCheck className="h-5 w-5 text-white" strokeWidth={2.25} />
          </span>
        </span>
      </div>
      <h2 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        Password reset
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-balance text-[13.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
        You&rsquo;re all set. Redirecting you to log in…
      </p>
      <Link
        href="/auth"
        className="mt-6 inline-flex items-center justify-center rounded-[8px] border border-[var(--primary-dark)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_rgba(206,94,18,0.30)] [background:linear-gradient(180deg,#fb8939_0%,#fa7319_55%,#ed6a14_100%)] transition-all hover:[background:linear-gradient(180deg,#fa7d27_0%,#ed6a14_55%,#d75e10_100%)]"
      >
        Go to log in
      </Link>
    </motion.div>
  );
}

// ─── Reset form ─────────────────────────────────────────────────────────────

function ResetForm({
  password,
  confirmPassword,
  showPassword,
  showConfirm,
  loading,
  error,
  hasValidLength,
  hasUpperCase,
  hasLowerCase,
  hasNumbers,
  passwordsMatch,
  onPasswordChange,
  onConfirmChange,
  onTogglePassword,
  onToggleConfirm,
  onSubmit,
}: {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirm: boolean;
  loading: boolean;
  error: string | null;
  hasValidLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumbers: boolean;
  passwordsMatch: boolean;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onTogglePassword: () => void;
  onToggleConfirm: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <motion.p
        variants={fadeUp}
        className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
      >
        Reset password
      </motion.p>
      <motion.h1
        variants={fadeUp}
        className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
      >
        Choose a new password
      </motion.h1>
      <motion.p
        variants={fadeUp}
        className="mt-2 text-balance text-[13.5px] text-[var(--neutral-sub-600)]"
      >
        Create a strong password to keep your Aegis account secure.
      </motion.p>

      <motion.form
        variants={fadeUp}
        onSubmit={onSubmit}
        className="mt-6 space-y-4"
        noValidate
      >
        <Field label="New password">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            trailingIcon={
              <button
                type="button"
                onClick={onTogglePassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </Field>

        <Field label="Confirm password">
          <Input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            trailingIcon={
              <button
                type="button"
                onClick={onToggleConfirm}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </Field>

        <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-2.5">
            <span
              aria-hidden
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-[rgba(250,115,25,0.18)]"
              style={{
                backgroundColor: 'rgba(250, 115, 25, 0.10)',
                color: 'var(--primary-base)',
              }}
            >
              <LockKeyhole className="h-3 w-3" strokeWidth={2.25} />
            </span>
            <span className="text-[11.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              Password requirements
            </span>
          </div>
          <ul className="space-y-1.5 px-3.5 py-3">
            <Requirement met={hasValidLength}>At least 8 characters</Requirement>
            <Requirement met={hasUpperCase}>One uppercase letter</Requirement>
            <Requirement met={hasLowerCase}>One lowercase letter</Requirement>
            <Requirement met={hasNumbers}>One number</Requirement>
            <Requirement met={passwordsMatch}>Passwords match</Requirement>
          </ul>
        </div>

        {error && (
          <div
            className="rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-[1.5]"
            style={{
              backgroundColor: 'var(--error-lighter)',
              borderColor: 'rgba(251, 55, 72, 0.22)',
              color: 'var(--error-dark)',
            }}
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={loading}
          leadingIcon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
          className="!h-10 !text-[13.5px]"
        >
          {loading ? 'Resetting password…' : 'Reset password'}
        </Button>
      </motion.form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Requirement({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span
        aria-hidden
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
          met ? '' : 'border border-[var(--stroke-sub-300)]'
        }`}
        style={met ? { backgroundColor: 'var(--success)' } : undefined}
      >
        {met && <Check className="h-[8px] w-[8px] text-white" strokeWidth={3} />}
      </span>
      <span
        className={met ? 'text-[var(--neutral-strong-950)]' : 'text-[var(--neutral-soft-400)]'}
      >
        {children}
      </span>
    </li>
  );
}

// ─── Suspense wrapper ───────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
          <Loader2
            className="h-7 w-7 animate-spin"
            style={{ color: 'var(--primary-base)' }}
          />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
