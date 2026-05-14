'use client';

/**
 * Onboarding — five-step flow taking a new user from "just signed up" to
 * "agent connected and governed."
 *
 *  ① Connect    GitHub creds (username, user-id, PAT)
 *  ② Sync       discover repos with that PAT
 *  ③ Permissions  per-repo Allow / Approval / Deny
 *  ④ Agent      drop the MCP config into Claude / Cursor / Windsurf
 *  ⑤ Done       confirmation + first-action count, then →/dashboard
 *
 * Visual pattern (Linear / Vercel / Stripe Connect):
 *  - Sticky top bar with brand mark
 *  - Stepper rail directly underneath (filled/active/pending nodes + bars)
 *  - Centered content card per step, max 560px wide
 *  - Soft inset warm gradient on the page bg to tie into the dashboard
 *
 * Backend logic: 100% preserved — same `api.*` calls, same useEffect chains,
 * same handlers. Only the JSX + styling changed.
 */

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  Activity,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Key,
  Loader2,
  LogOut,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep, useEmail } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import { installPreviewApi } from '@/lib/preview-data';
import CopyButton from '@/components/ui/CopyButton';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CodeChip } from '@/components/ui/CodeChip';
import { JsonHighlight } from '@/components/ui/JsonHighlight';
import { fadeUp, staggerContainer } from '@/lib/motion';

// ─── DEV-ONLY preview escape hatch ──────────────────────────────────────────
// Activated via `?preview=1` query string or a one-time localStorage flag.
// When active, the onboarding flow uses mocked API responses so reviewers
// can click Continue through every step without entering real GitHub creds.
// HARD-GATED to development: returns false in production no matter what.
function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV === 'production') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === '1') {
    localStorage.setItem('aegis_preview', '1');
    return true;
  }
  return localStorage.getItem('aegis_preview') === '1';
}

// ─── Step metadata ──────────────────────────────────────────────────────────

interface StepDef {
  number: number;
  label: string;
  icon: LucideIcon;
}

// All five glyphs come from `lucide-react` — same icon family used
// everywhere else in the dashboard (Sidebar, Topbar, Settings, Toast).
const STEPS: StepDef[] = [
  { number: 1, label: 'Connect', icon: GitBranch },
  { number: 2, label: 'Sync', icon: RefreshCw },
  { number: 3, label: 'Permissions', icon: ShieldCheck },
  { number: 4, label: 'Agent', icon: Plug },
  { number: 5, label: 'Done', icon: Sparkles },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, setUser } = useUser();
  const { step, setStep } = useOnboardingStep();
  const { email } = useEmail();

  // Preview-mode bootstrap. Runs synchronously during render so the very
  // first call to api.* already hits the mocked methods. Idempotent —
  // installPreviewApi guards itself.
  const preview = typeof window !== 'undefined' && isPreviewMode();
  if (preview) {
    installPreviewApi();
    // The shared preview shim returns onboarding_step=6 (already onboarded).
    // For walk-throughs we want to START at step 1, so override locally.
    api.getOnboardingStep = async () => ({ onboarding_step: 1 });
  }

  // ── Step 1 state ──
  // In preview mode, pre-fill the form with safe placeholder values so the
  // reviewer can click Continue without typing anything.
  const [username, setUsername] = useState(
    user?.username || (preview ? 'octocat' : ''),
  );
  const [githubId, setGithubId] = useState(
    String(user?.github_user_id || (preview ? '12345678' : '')),
  );
  const [token, setToken] = useState(
    user?.access_token || (preview ? 'ghp_previewtokenonly' : ''),
  );
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // ── Step 2 state ──
  const [repos, setRepos] = useState<Repo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  // ── Step 4 state ──
  const [activeTab, setActiveTab] = useState('claude');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  // ── Step 5 state ──
  const [actionCount, setActionCount] = useState(0);

  // PREVIEW MODE — pre-seed repos + synced state so the reviewer can jump to
  // any step from the stepper rail and see it render correctly without
  // having to walk the flow linearly. Only fires once, only in preview.
  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getRepos(user?.id || 'preview-user');
        if (cancelled) return;
        if (res?.repos && Array.isArray(res.repos)) {
          setRepos(res.repos);
          setSynced(true);
        }
      } catch {
        /* ignore — preview shim should never throw */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // Already finished onboarding? Skip to dashboard.
  useEffect(() => {
    if (step >= 6) router.push('/dashboard');
  }, [step, router]);

  const getAuthToken = useCallback(() => {
    return localStorage.getItem('access_token');
  }, []);

  // Bootstrap the user's current step from the server.
  useEffect(() => {
    const fetchInitialStep = async () => {
      const authToken = getAuthToken();
      if (!authToken) return;
      try {
        const response = await api.getOnboardingStep(authToken);
        const currentStep = response.onboarding_step;
        if (currentStep > 6) {
          router.push('/dashboard');
          return;
        }
        if (currentStep) setStep(currentStep);
      } catch (error) {
        console.error('Failed to fetch initial onboarding step:', error);
      }
    };
    fetchInitialStep();
  }, [getAuthToken, setStep, router]);

  // ─── Handlers (LOGIC UNCHANGED) ─────────────────────────────────────────

  const handleStep1 = async () => {
    const authToken = getAuthToken();
    if (!username || !githubId || !token) {
      setStep1Error('All fields are required.');
      return;
    }
    setStep1Loading(true);
    setStep1Error('');
    try {
      const githubUserIdNum = parseInt(githubId, 10);
      if (isNaN(githubUserIdNum)) {
        setStep1Error('GitHub User ID must be a number.');
        setStep1Loading(false);
        return;
      }
      const response = await api.saveUser({
        github_user_id: githubUserIdNum,
        username,
        github_pat: token,
        email,
      });
      setUser(response);
      await api.updateOnboardingStep(2, authToken || '');
      setStep(2);
    } catch {
      setStep1Error('Failed to save. Please try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (!user?.github_user_id || !user?.github_pat) {
        throw new Error('User not initialized');
      }
      const syncResponse = await api.syncRepos(user.github_user_id, user.github_pat);
      if (!syncResponse.success) {
        throw new Error(syncResponse.message || 'Sync failed');
      }
      const reposResponse = await api.getRepos(user.id || '');
      if (reposResponse?.repos && Array.isArray(reposResponse.repos)) {
        setRepos(reposResponse.repos);
      }
      setSynced(true);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPermission = (
    index: number,
    permission: 'allow' | 'deny' | 'require_approval',
  ) => {
    setRepos((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (permission === 'allow') return { ...r, can_read: true, can_write: true };
        if (permission === 'require_approval') {
          return { ...r, can_read: true, can_write: false };
        }
        return { ...r, can_read: false, can_write: false };
      }),
    );
  };

  const handleBulkPermission = (permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r) => {
        if (permission === 'allow') return { ...r, can_read: true, can_write: true };
        if (permission === 'require_approval') {
          return { ...r, can_read: true, can_write: false };
        }
        return { ...r, can_read: false, can_write: false };
      }),
    );
  };

  const getPermissionLabel = (
    repo: Repo,
  ): 'allow' | 'deny' | 'require_approval' => {
    if (repo.can_write) return 'allow';
    if (repo.can_read) return 'require_approval';
    return 'deny';
  };

  const handleSavePermissions = async () => {
    if (!user?.id) return;
    try {
      const permissions = repos.map(({ github_repo_id, can_read, can_write }) => ({
        github_repo_id,
        can_read: can_read || false,
        can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      const authToken = getAuthToken();
      if (authToken) await api.updateOnboardingStep(4, authToken);
      setStep(4);
    } catch {
      const authToken = getAuthToken();
      if (authToken) await api.updateOnboardingStep(4, authToken);
      setStep(4);
    }
  };

  // Poll for the first agent action after the MCP config is shown.
  useEffect(() => {
    if (step !== 4 || verified) return;
    const interval = setInterval(async () => {
      setChecking(true);
      try {
        const uname = user?.username || username;
        const uid = user?.id;
        if (!uname || !uid) return;
        const result = await api.getRecentActionCount(uid, uname);
        if (result[0] && Number(result[0].count) > 0) setVerified(true);
      } catch {
        /* ignore */
      } finally {
        setChecking(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, verified, user?.username, user?.id, username]);

  // Fetch total action count for the success screen.
  useEffect(() => {
    if (step !== 5) return;
    const fetchCount = async () => {
      try {
        const metrics = await api.getMetrics();
        setActionCount(Number(metrics.total) || 0);
      } catch {
        /* ignore */
      }
    };
    fetchCount();
  }, [step]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/auth';
  };

  // ─── MCP config + per-tab installation copy ──────────────────────────────

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        'aegis-github': {
          url: 'https://app.runaegis.co/sse',
          headers: {
            user_id: String(user?.github_user_id || githubId || '{USER_GITHUB_ID}'),
          },
        },
      },
    },
    null,
    2,
  );

  const permOptions = [
    { value: 'allow', label: 'Allow', color: 'var(--success)' },
    { value: 'require_approval', label: 'Approval', color: 'var(--warning)' },
    { value: 'deny', label: 'Deny', color: 'var(--error)' },
  ] as const;

  const tabs = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'custom', label: 'Other' },
  ];

  const currentStep = STEPS.find((s) => s.number === step) ?? STEPS[0];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    // h-screen + flex column so the header sits OUTSIDE the scroll context.
    // Scrolling happens on the inner content div, not <body>. This keeps the
    // top bar spanning the full window width (the scrollbar sits below it on
    // the inner div, not next to the nav).
    <div className="relative flex h-screen flex-col bg-[var(--bg-app)]">
      {/* Top bar — brand + sign-out (+ preview-mode pill when active).
          shrink-0 so it never compresses, w-full to span full viewport. */}
      <header className="relative flex h-[56px] w-full shrink-0 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <AegisLogo
            style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
          {preview && (
            <span
              className="inline-flex h-[22px] items-center gap-1.5 rounded-[6px] border px-2 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
              style={{
                backgroundColor: 'rgba(250, 115, 25, 0.10)',
                borderColor: 'rgba(250, 115, 25, 0.22)',
                color: 'var(--primary-dark)',
              }}
              title="Dev-only: API calls are mocked. Click Continue to walk through every step."
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--primary-base)' }}
              />
              Preview mode
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      {/* Scrollable content area — the only element that scrolls. This is
          what frees the header above to span the full window width. */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Soft inset warm gradient — same family as the auth showcase and
            the dashboard hero. Caps at 520px so it doesn't dominate.
            Now lives inside the scroll area so it sits beneath the header. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(250, 115, 25, 0.08) 0%, rgba(250, 115, 25, 0.03) 40%, rgba(255, 255, 255, 0) 100%)',
          }}
        />

      {/* Body */}
      <main className="relative mx-auto max-w-[640px] px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        {/* Eyebrow above the stepper — sets context for what this whole flow is */}
        <motion.div
          variants={staggerContainer(0.05, 0.02)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="mb-8 text-center"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            Setup · {step} of {STEPS.length}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            {step === 1 && 'Connect your GitHub'}
            {step === 2 && 'Discover your repositories'}
            {step === 3 && 'Set per-repo permissions'}
            {step === 4 && 'Connect your agent'}
            {step === 5 && 'Aegis is governing your agents'}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            // text-balance asks the browser to distribute line breaks evenly
            // across the wrapped lines — no more single-word orphans on the
            // last line.
            className="mx-auto mt-2 max-w-[460px] text-balance text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            {step === 1 &&
              'Aegis needs read-only access to your repos to govern what your agents can do.'}
            {step === 2 &&
              'We use your token to fetch the repos you own or have access to.'}
            {step === 3 &&
              'Choose how Aegis should treat each repo. You can change these any time from Settings.'}
            {step === 4 &&
              'Drop the MCP config into your coding agent of choice. Aegis will start governing as soon as it sees a request.'}
            {step === 5 &&
              "You're live. Every action your agents take from now on is logged, gated by policy, and reviewable."}
          </motion.p>
        </motion.div>

        {/* Stepper — read-only visual progress indicator. */}
        <StepIndicator current={step} reduce={!!reduce} />

        {/* Step content card */}
        <motion.section
          key={`step-${step}`}
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="mt-8 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          {/* Step card header — premium icon + step name. Keeps continuity
              with the stepper and the toast/success icon family. */}
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2.5 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-4"
          >
            <OnboardingIcon icon={currentStep.icon} size="sm" />
            <span className="text-[12px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              Step {step}: {currentStep.label}
            </span>
          </motion.div>

          {/* Step 1 — Connect GitHub */}
          {step === 1 && (
            <motion.div variants={fadeUp} className="space-y-4 p-4 sm:p-6">
              {step1Error && <ErrorCallout message={step1Error} />}
              <Field label="GitHub username">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="octocat"
                  autoComplete="username"
                />
              </Field>
              <Field
                label="GitHub user ID"
                hint={
                  <>
                    Find yours at{' '}
                    <code className="rounded-[4px] bg-[var(--neutral-weak-50)] px-1 py-0.5 text-[11px] [font-family:var(--font-geist-mono),ui-monospace,monospace] text-[var(--neutral-sub-600)]">
                      api.github.com/users/YOUR_USERNAME
                    </code>
                  </>
                }
              >
                <Input
                  type="text"
                  value={githubId}
                  onChange={(e) => setGithubId(e.target.value)}
                  placeholder="12345678"
                />
              </Field>
              <Field label="Personal access token">
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                />
              </Field>

              <TokenScopesCallout />

              <Button
                variant="primary"
                fullWidth
                onClick={handleStep1}
                disabled={step1Loading}
                leadingIcon={
                  step1Loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined
                }
                trailingIcon={
                  !step1Loading && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                }
                className="!h-10 !text-[13.5px] mt-1"
              >
                {step1Loading ? 'Saving…' : 'Continue'}
              </Button>
            </motion.div>
          )}

          {/* Step 2 — Sync */}
          {step === 2 && (
            <motion.div variants={fadeUp} className="p-4 sm:p-6">
              {!synced ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <OnboardingIcon icon={RefreshCw} size="lg" />
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      Ready to sync
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
                      We&rsquo;ll use your token to discover your repositories.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleSync}
                    disabled={syncing}
                    leadingIcon={
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                        strokeWidth={2}
                      />
                    }
                    className="!h-10 !text-[13.5px] !px-5 mt-2"
                  >
                    {syncing ? 'Syncing…' : 'Sync repositories'}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="relative inline-flex h-5 w-5 items-center justify-center"
                    >
                      <span
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: 'rgba(31, 193, 107, 0.18)' }}
                      />
                      <span
                        className="relative inline-flex h-[15px] w-[15px] items-center justify-center rounded-full"
                        style={{ backgroundColor: 'var(--success)' }}
                      >
                        <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />
                      </span>
                    </span>
                    <span className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                      {repos.length} {repos.length === 1 ? 'repository' : 'repositories'} found
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-[10px] border border-[var(--stroke-soft-200)] divide-y divide-[var(--stroke-soft-200)]">
                    {repos.map((repo) => (
                      <div
                        key={repo.name}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <GitBranch
                            className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
                            strokeWidth={2}
                          />
                          <span className="truncate text-[13px] text-[var(--neutral-strong-950)]">
                            {repo.name}
                          </span>
                        </div>
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[var(--success-dark)]">
                          Allow
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {synced && (
                <div className="mt-5 flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const authToken = getAuthToken();
                      if (authToken) await api.updateOnboardingStep(1, authToken);
                      setStep(1);
                    }}
                    leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
                    className="!h-10 !text-[13.5px] !px-5"
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      const authToken = getAuthToken();
                      if (authToken) await api.updateOnboardingStep(2, authToken);
                      setStep(3);
                    }}
                    trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                    className="!h-10 !text-[13.5px] !px-5"
                  >
                    Continue
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3 — Permissions */}
          {step === 3 && (
            <motion.div variants={fadeUp} className="p-4 sm:p-6">
              {/* Legend */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {permOptions.map((opt) => (
                  <div
                    key={opt.value}
                    className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                        {opt.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-[1.4] text-[var(--neutral-sub-600)]">
                      {opt.value === 'allow' && 'Auto-execute'}
                      {opt.value === 'require_approval' && 'Human review'}
                      {opt.value === 'deny' && 'Block all'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bulk apply */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                  Apply to all:
                </span>
                {permOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleBulkPermission(opt.value)}
                    className="inline-flex h-6 items-center rounded-[6px] border border-[var(--stroke-sub-300)] bg-white px-2 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Repo list with per-row permission picker. On mobile, the
                  permission segment sits below the repo name (stacked) so
                  the buttons don't fight for horizontal space; on sm+ they
                  go side by side. */}
              <div className="max-h-72 overflow-y-auto rounded-[10px] border border-[var(--stroke-soft-200)] divide-y divide-[var(--stroke-soft-200)]">
                {repos.map((repo, i) => (
                  <div
                    key={repo.name}
                    className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <GitBranch
                        className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
                        strokeWidth={2}
                      />
                      <span className="truncate text-[13px] text-[var(--neutral-strong-950)]">
                        {repo.name}
                      </span>
                    </div>
                    <PermissionSegment
                      value={getPermissionLabel(repo)}
                      onChange={(v) => handleSetPermission(i, v)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const authToken = getAuthToken();
                    if (authToken) await api.updateOnboardingStep(2, authToken);
                    setStep(2);
                  }}
                  leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  className="!h-10 !text-[13.5px] !px-5"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    const authToken = getAuthToken();
                    if (authToken) await api.updateOnboardingStep(2, authToken);
                    handleSavePermissions();
                  }}
                  trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  className="!h-10 !text-[13.5px] !px-5"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4 — Agent */}
          {step === 4 && (
            <motion.div variants={fadeUp} className="p-4 sm:p-6">
              {/* Tool tabs */}
              <div className="mb-4 inline-flex rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex h-7 items-center rounded-[7px] px-3 text-[12px] font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                        : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Config block — Integrations-page pattern: traffic lights +
                  filename chip + JSON tag in header, line-number gutter +
                  tokenized JSON via JsonHighlight in the body. */}
              <ConfigBlock code={mcpConfig} />

              {/* How to install — structured callout with header + numbered
                  step pills, matching the rest of the onboarding visual lang. */}
              <InstallCallout
                activeTab={activeTab}
                githubId={String(user?.github_user_id || githubId)}
              />

              {/* Connection status — live polling. Two-tier hierarchy
                  (headline + subtext) with the same halo+disc icon family
                  as the rest of the flow. */}
              <ConnectionStatus verified={verified} checking={checking} />

              <div className="mt-5 flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const authToken = getAuthToken();
                    if (authToken) await api.updateOnboardingStep(3, authToken);
                    setStep(3);
                  }}
                  leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  className="!h-10 !text-[13.5px] !px-5"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    const authToken = getAuthToken();
                    if (authToken) await api.updateOnboardingStep(5, authToken);
                    setStep(5);
                  }}
                  trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  className="!h-10 !text-[13.5px] !px-5"
                >
                  Continue
                </Button>
              </div>

              {!verified && (
                <button
                  type="button"
                  onClick={async () => {
                    const authToken = getAuthToken();
                    if (authToken) await api.updateOnboardingStep(5, authToken);
                    setStep(5);
                  }}
                  className="mt-3 w-full text-center text-[12px] font-medium text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
                >
                  Skip for now
                </button>
              )}
            </motion.div>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <DoneStep
              actionCount={actionCount}
              repoCount={repos.length}
              reduce={!!reduce}
              onContinue={async () => {
                const authToken = getAuthToken();
                if (authToken) await api.updateOnboardingStep(6, authToken);
                setStep(6);
                router.push('/dashboard');
              }}
            />
          )}
        </motion.section>

        {/* Fineprint */}
        <p className="mt-6 text-center text-[11.5px] text-[var(--neutral-soft-400)]">
          Need help?{' '}
          <a className="hover:text-[var(--neutral-sub-600)]" href="#">
            Contact support
          </a>
          .
        </p>
      </main>
      </div>
    </div>
  );
}

// ─── Stepper rail ──────────────────────────────────────────────────────────

function StepIndicator({
  current,
  reduce,
}: {
  current: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1], delay: 0.18 }}
      // Alternating nodes + connectors as siblings, not nested. Each node
      // is shrink-0 (fixed-ish width to fit its label below), connectors
      // are flex-1 to fill all remaining space evenly. This guarantees
      // the rail spans the full container width AND the spacing between
      // every adjacent pair of nodes is identical.
      className="flex w-full items-start"
    >
      {STEPS.map((s, idx) => {
        const done = s.number < current;
        const active = s.number === current;
        const Icon = s.icon;

        return (
          <Fragment key={s.number}>
            {/* Node — full label-width slot on sm+ so labels never wrap,
                compact 36px slot below sm so the rail fits on phones. */}
            <div className="flex w-9 shrink-0 flex-col items-center gap-2 sm:w-[78px]">
              <div
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300 ${
                  active
                    ? 'border-transparent'
                    : done
                      ? 'border-[var(--primary-base)] bg-white'
                      : 'border-[var(--stroke-sub-300)] bg-white'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--primary-base)',
                        boxShadow:
                          '0 0 0 4px rgba(250, 115, 25, 0.16), 0 1px 2px rgba(206, 94, 18, 0.30)',
                      }
                    : undefined
                }
              >
                {done ? (
                  <Check
                    className="h-[14px] w-[14px]"
                    style={{ color: 'var(--primary-base)' }}
                    strokeWidth={2.75}
                  />
                ) : (
                  <Icon
                    className={`h-[14px] w-[14px] ${
                      active ? 'text-white' : 'text-[var(--neutral-soft-400)]'
                    }`}
                    strokeWidth={2.25}
                  />
                )}
              </div>
              {/* Label hidden below sm to keep the rail compact on phones —
                  the active step's name still appears above the stepper in
                  the page title block, so context isn't lost. */}
              <span
                className={`hidden text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] sm:inline-block ${
                  active
                    ? 'text-[var(--neutral-strong-950)]'
                    : done
                      ? 'text-[var(--primary-base)]'
                      : 'text-[var(--neutral-soft-400)]'
                }`}
              >
                {s.label}
              </span>
            </div>

            {/* Connector — flex-1 so it stretches to fill all remaining
                horizontal space, distributing connectors evenly between
                every pair of nodes. */}
            {idx < STEPS.length - 1 && (
              <div
                className="relative mx-1 mt-[17px] h-px flex-1 min-w-[12px] overflow-hidden rounded-full bg-[var(--stroke-sub-300)]"
                aria-hidden
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: 'var(--primary-base)' }}
                  initial={false}
                  animate={{ width: s.number < current ? '100%' : '0%' }}
                  transition={{ duration: reduce ? 0 : 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </motion.div>
  );
}

// ─── Field + permission segment helpers ─────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[var(--neutral-soft-400)]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── MCP config code block ─────────────────────────────────────────────────
// Matches the visual treatment of the dashboard's Integrations page:
//   - Header strip with macOS traffic-light dots + filename chip + JSON tag + copy
//   - Body with a select-none line-number gutter and tokenized JSON
// Gives the snippet the same "code you can actually paste" feeling.
function ConfigBlock({ code }: { code: string }) {
  const lines = code.split('\n');
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#fb3748' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f6b51e' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1fc16b' }} />
          </span>
          <CodeChip>mcp_config.json</CodeChip>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
            JSON
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto bg-white">
        <div className="flex">
          {/* Line number gutter */}
          <div
            className="select-none border-r border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] py-4 pl-4 pr-3 text-right text-[11.5px] leading-[1.7] text-[var(--neutral-soft-400)] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
            aria-hidden
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Source — tokenized via JsonHighlight (keys / strings / numbers
              / punctuation each get distinct colors) */}
          <pre className="flex-1 overflow-x-auto px-4 py-4 text-[12px] leading-[1.7] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            <code>
              <JsonHighlight code={code} />
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── How-to-install callout ─────────────────────────────────────────────────
// Card with a labeled header (Plug icon + "How to install") and structured
// numbered steps. Each step is a row with a tiny brand-tinted number disc
// + the instruction text. Cohesive with the rest of the onboarding chrome.

type InstallStep = React.ReactNode;
const INSTALL_STEPS: Record<string, InstallStep[]> = {
  claude: [
    'Open Claude Code settings',
    'Navigate to MCP Servers',
    'Add the config above',
    'Restart Claude Code',
  ],
  cursor: [
    <>Open Settings → Features → MCP</>,
    <>Click <strong>Add MCP Server</strong></>,
    'Paste the config above',
  ],
  windsurf: [
    <>
      Open{' '}
      <code className="rounded-[4px] bg-[var(--neutral-weak-50)] px-1 py-0.5 text-[11px] [font-family:var(--font-geist-mono),ui-monospace,monospace] text-[var(--neutral-strong-950)]">
        ~/.codeium/windsurf/mcp_config.json
      </code>
    </>,
    <>
      Add the <CodeChip>aegis-github</CodeChip> server
    </>,
  ],
};

function InstallCallout({
  activeTab,
  githubId,
}: {
  activeTab: string;
  githubId: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-4">
        <OnboardingIcon icon={Plug} size="sm" />
        <span className="text-[12px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          How to install
        </span>
      </div>
      <div className="p-5">
        {activeTab === 'custom' ? (
          <p className="text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
            Point your MCP server URL to{' '}
            <CodeChip>https://app.runaegis.co/sse</CodeChip> with header{' '}
            <CodeChip>user_id: {githubId}</CodeChip>.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {(INSTALL_STEPS[activeTab] ?? []).map((node, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(250,115,25,0.22)] text-[11px] font-bold tabular-nums"
                  style={{
                    backgroundColor: 'rgba(250, 115, 25, 0.10)',
                    color: 'var(--primary-base)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                  {node}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─── Connection status ──────────────────────────────────────────────────────
// Live-polled status row. Two-tier hierarchy (label + subtext) inside a
// card-style container, with a halo+disc icon when verified or a soft
// pulsing dot while waiting. Replaces the previous flat one-liner.

function ConnectionStatus({
  verified,
  checking,
}: {
  verified: boolean;
  checking: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-center gap-3 p-4">
        {verified ? (
          <>
            <OnboardingIcon icon={Check} size="sm" tone="success" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                Agent connected
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.4] text-[var(--neutral-sub-600)]">
                Aegis is seeing requests from your agent.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Pulsing dot inside a soft halo — same family as the
                "preview mode" pill in the top bar. */}
            <span
              aria-hidden
              className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
            >
              <span
                className={`absolute inset-0 rounded-full ${checking ? 'animate-ping' : ''}`}
                style={{
                  backgroundColor: 'var(--primary-base)',
                  opacity: checking ? 0.45 : 0,
                }}
              />
              <span
                className="relative inline-flex h-[15px] w-[15px] items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(250, 115, 25, 0.18)' }}
              >
                <span
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ backgroundColor: 'var(--primary-base)' }}
                />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                Waiting for first agent action
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.4] text-[var(--neutral-sub-600)]">
                Once your agent hits an MCP tool, this will turn green.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Unified icon component ────────────────────────────────────────────────
// One visual language for every icon-in-a-box across the onboarding flow.
// Pattern: soft halo wrapping a saturated brand-gradient disc with a white
// knockout glyph. Same family as the toast/success icons, scales premium
// from 22px (header chips) to 72px (hero step 5).
//
// Tones beyond `primary` (success / info) are exposed so the step-5 metric
// cards can use this same component with their own color story while
// staying visually cohesive.

type IconTone = 'primary' | 'success' | 'info';
type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const TONE_PRESETS: Record<
  IconTone,
  { halo: string; gradient: string; ring: string; shadow: string }
> = {
  primary: {
    halo: 'rgba(250, 115, 25, 0.18)',
    gradient: 'linear-gradient(180deg, #fb8939 0%, #fa7319 55%, #ed6a14 100%)',
    ring: '#ed6a14',
    shadow: 'rgba(206, 94, 18, 0.30)',
  },
  success: {
    halo: 'rgba(31, 193, 107, 0.18)',
    gradient: 'linear-gradient(180deg, #2ed480 0%, #1fc16b 55%, #19a45a 100%)',
    ring: '#19a45a',
    shadow: 'rgba(11, 70, 39, 0.28)',
  },
  info: {
    halo: 'rgba(51, 92, 255, 0.16)',
    gradient: 'linear-gradient(180deg, #5a82ff 0%, #335cff 55%, #2547d6 100%)',
    ring: '#2547d6',
    shadow: 'rgba(22, 40, 113, 0.28)',
  },
};

const SIZE_PRESETS: Record<
  IconSize,
  { outer: number; disc: number; icon: number; stroke: number }
> = {
  sm: { outer: 22, disc: 16, icon: 9, stroke: 2.75 },
  md: { outer: 32, disc: 22, icon: 12, stroke: 2.5 },
  lg: { outer: 56, disc: 40, icon: 20, stroke: 2.25 },
  xl: { outer: 72, disc: 52, icon: 26, stroke: 2.25 },
};

function OnboardingIcon({
  icon: Icon,
  size = 'md',
  tone = 'primary',
  glow = false,
}: {
  icon: LucideIcon;
  size?: IconSize;
  tone?: IconTone;
  glow?: boolean;
}) {
  const d = SIZE_PRESETS[size];
  const t = TONE_PRESETS[tone];
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ height: d.outer, width: d.outer }}
    >
      {/* Soft outer halo — matches the full footprint */}
      <span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: t.halo }}
      />
      {/* Saturated gradient disc with brand "lit-from-above" inset shadow */}
      <span
        className="relative inline-flex items-center justify-center rounded-full"
        style={{
          height: d.disc,
          width: d.disc,
          background: t.gradient,
          border: `1px solid ${t.ring}`,
          boxShadow: glow
            ? `inset 0 1px 0 0 rgba(255,255,255,0.22), 0 1px 2px ${t.shadow}, 0 0 0 6px ${t.halo}, 0 12px 28px ${t.shadow}`
            : `inset 0 1px 0 0 rgba(255,255,255,0.22), 0 1px 2px ${t.shadow}`,
        }}
      >
        <Icon
          className="text-white"
          style={{ height: d.icon, width: d.icon }}
          strokeWidth={d.stroke}
        />
      </span>
    </span>
  );
}

// ─── Step 5 success screen ─────────────────────────────────────────────────
// Extracted to its own component so the confetti effect + animated metric
// count-ups can live in dedicated useEffect hooks.

function DoneStep({
  actionCount,
  repoCount,
  reduce,
  onContinue,
}: {
  actionCount: number;
  repoCount: number;
  reduce: boolean;
  onContinue: () => void;
}) {
  // Confetti pop on mount — a celebratory burst from the bottom-center
  // with brand colors. Bails out for reduced-motion users.
  const fired = useRef(false);
  useEffect(() => {
    if (reduce || fired.current) return;
    fired.current = true;
    const colors = ['#fa7319', '#fb8939', '#fbb138', '#1fc16b', '#335cff'];
    // Two short bursts from the lower-left and lower-right corners — gives
    // the "confetti pop" feel without ever obscuring the success card.
    const opts = (origin: { x: number; y: number }) => ({
      particleCount: 60,
      spread: 65,
      startVelocity: 45,
      gravity: 0.9,
      ticks: 200,
      origin,
      colors,
      scalar: 0.9,
      disableForReducedMotion: true,
    });
    confetti({ ...opts({ x: 0.15, y: 0.85 }), angle: 65 });
    confetti({ ...opts({ x: 0.85, y: 0.85 }), angle: 115 });
    // Soft middle burst slightly later — feels like an echo.
    const t = window.setTimeout(() => {
      confetti({
        ...opts({ x: 0.5, y: 0.7 }),
        particleCount: 40,
        spread: 90,
        startVelocity: 35,
      });
    }, 180);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <motion.div
      variants={fadeUp}
      className="px-4 pb-8 pt-10 text-center sm:px-6"
    >
      {/* XL hero icon with brand glow ring — the moment is celebratory */}
      <motion.div
        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto mb-6 inline-flex"
      >
        <OnboardingIcon icon={ShieldCheck} size="xl" glow />
      </motion.div>

      <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        Aegis is active
      </h2>
      <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
        Your agents are now governed. Every action is logged, every dangerous
        move is gated by policy, every approval stays with you.
      </p>

      {/* Metric tiles — single brand-tone across all three so the card
          doesn't read as a rainbow. Hierarchy comes from the icon glyph
          + the animated number, not from competing color tones. */}
      <div className="mx-auto mt-7 grid max-w-[420px] grid-cols-3 gap-2.5">
        <MetricCard
          icon={Activity}
          tone="primary"
          value={actionCount}
          label="Actions"
          reduce={reduce}
          delay={0}
        />
        <MetricCard
          icon={GitBranch}
          tone="primary"
          value={repoCount}
          label="Repos"
          reduce={reduce}
          delay={0.08}
        />
        <MetricCard
          icon={ShieldCheck}
          tone="primary"
          value={0}
          label="Incidents"
          reduce={reduce}
          delay={0.16}
        />
      </div>

      <div className="mt-7">
        <Button
          variant="primary"
          onClick={onContinue}
          trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
          className="!h-10 !text-[13.5px] !px-5"
        >
          Open dashboard
        </Button>
      </div>
    </motion.div>
  );
}

// Tone-coded metric tile with a top-left icon disc, big tabular number,
// label, and a subtle tone-tinted top accent. The number animates from 0
// to its final value (count-up) on mount for that "data settling in" feel.
function MetricCard({
  value,
  label,
  reduce,
  delay,
}: {
  // Icon + tone left in the signature for the prop API but no longer
  // rendered — kept as a no-op so call sites don't need to change.
  icon?: LucideIcon;
  tone?: IconTone;
  value: number;
  label: string;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay }}
      className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-3.5 py-4 text-center shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        <AnimatedNumber to={value} reduce={reduce} delay={delay + 0.15} />
      </p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
    </motion.div>
  );
}

// Animated integer count-up using motion's spring. Lands on the target
// exactly (no floating-point rounding artifacts) and stays accessible by
// falling back to the static number when reduced motion is preferred.
function AnimatedNumber({
  to,
  reduce,
  delay = 0,
}: {
  to: number;
  reduce: boolean;
  delay?: number;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22, mass: 0.6 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString());
  const [display, setDisplay] = useState(reduce ? to.toLocaleString() : '0');

  useEffect(() => {
    if (reduce) {
      setDisplay(to.toLocaleString());
      return;
    }
    const t = window.setTimeout(() => mv.set(to), delay * 1000);
    return () => window.clearTimeout(t);
  }, [to, reduce, delay, mv]);

  useEffect(() => {
    if (reduce) return;
    return rounded.on('change', (v) => setDisplay(v));
  }, [rounded, reduce]);

  return <>{display}</>;
}

// Inline error callout with a tinted icon disc, structured layout, and
// proper hierarchy. Same halo+disc pattern we use in toasts/success panels.
function ErrorCallout({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[10px] border px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(251, 55, 72, 0.06)',
        borderColor: 'rgba(251, 55, 72, 0.22)',
      }}
    >
      <span
        aria-hidden
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'rgba(251, 55, 72, 0.16)' }}
        />
        <span
          className="relative inline-flex h-[15px] w-[15px] items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--error)' }}
        >
          <AlertCircle className="h-[10px] w-[10px] text-white" strokeWidth={3} />
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-[1px]">
        <p
          className="text-[12.5px] font-semibold leading-[1.4]"
          style={{ color: 'var(--error-dark)' }}
        >
          We couldn&rsquo;t continue
        </p>
        <p
          className="mt-0.5 text-[12.5px] leading-[1.5]"
          style={{ color: 'var(--error-dark)', opacity: 0.85 }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

// Polished "Required token scopes" panel. White surface for contrast against
// the white parent card, key icon header, structured rows where each scope
// chip pairs with a one-line description, and a primary-color CTA footer
// to the GitHub token-creation page.
function TokenScopesCallout() {
  const SCOPES = [
    { name: 'repo', description: 'Full control of private repositories' },
    { name: 'read:org', description: 'Read org membership' },
    { name: 'workflow', description: 'Update workflows' },
  ];
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      {/* Header strip */}
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-2.5">
        <OnboardingIcon icon={Key} size="sm" />
        <span className="text-[11.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          Required token scopes
        </span>
      </div>

      {/* Scope rows */}
      <ul className="divide-y divide-[var(--stroke-soft-200)]">
        {SCOPES.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5"
          >
            <CodeChip>{s.name}</CodeChip>
            <span className="text-right text-[12px] leading-[1.4] text-[var(--neutral-sub-600)]">
              {s.description}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer CTA */}
      <a
        href="https://github.com/settings/tokens/new"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-2.5 text-[12px] font-semibold transition-colors hover:bg-[var(--primary-lighter)]/40"
      >
        <span className="text-[var(--primary-base)] transition-colors group-hover:text-[var(--primary-dark)]">
          Create token on GitHub
        </span>
        <ExternalLink
          className="h-3.5 w-3.5 text-[var(--primary-base)] transition-transform group-hover:-translate-y-[1px] group-hover:translate-x-[1px]"
          strokeWidth={2.25}
        />
      </a>
    </div>
  );
}

function PermissionSegment({
  value,
  onChange,
}: {
  value: 'allow' | 'deny' | 'require_approval';
  onChange: (v: 'allow' | 'deny' | 'require_approval') => void;
}) {
  const options = [
    { value: 'allow' as const, label: 'Allow', color: 'var(--success)', dark: 'var(--success-dark)' },
    {
      value: 'require_approval' as const,
      label: 'Approval',
      color: 'var(--warning)',
      dark: 'var(--warning-dark)',
    },
    { value: 'deny' as const, label: 'Deny', color: 'var(--error)', dark: 'var(--error-dark)' },
  ];
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-[7px] border border-[var(--stroke-sub-300)] bg-white">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="inline-flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-semibold transition-colors not-last:border-r not-last:border-[var(--stroke-sub-300)]"
            style={
              selected
                ? {
                    backgroundColor: `color-mix(in srgb, ${opt.color} 14%, white)`,
                    color: opt.dark,
                  }
                : {
                    color: 'var(--neutral-soft-400)',
                  }
            }
          >
            {selected && (
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
