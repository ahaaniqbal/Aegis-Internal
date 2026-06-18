'use client';

/**
 * Onboarding — four-step flow taking a new user from "just signed up" to
 * "ready to create their first Room."
 *
 *  ① Connect    paste a GitHub PAT — we auto-fetch username + ID via the
 *               GitHub `/user` endpoint so the user doesn't have to dig
 *               through `api.github.com/users/*` JSON to find their numeric ID
 *  ② Sync       discover repos with that PAT
 *  ③ Permissions  per-repo Allow / Approval / Deny
 *  ④ Done       confirmation + first-repo count, then → /dashboard
 *
 * Agent connection used to live as a fifth step here, but that's now
 * per-Room (each Room's Connect tab auto-fills the room-specific MCP URL).
 * Keeping it here duplicated UI and shipped a non-working `/sse?user_id=…`
 * URL that didn't match the room-scoped backend pattern.
 *
 * Visual pattern (Linear / Vercel / Stripe Connect):
 *  - Sticky top bar with brand mark
 *  - Stepper rail directly underneath (filled/active/pending nodes + bars)
 *  - Centered content card per step
 *  - Soft inset warm gradient on the page bg to tie into the dashboard
 *
 * Backend wiring: untouched. The backend still tracks `onboarding_step` as
 * an integer. We map UI step N → backend step N (1..4). Anyone left on
 * legacy backend step 5 (old "Done") is routed straight to /dashboard by
 * the bootstrap below.
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Key,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep, useEmail } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CodeChip } from '@/components/ui/CodeChip';
import { fadeUp, staggerContainer } from '@/lib/motion';

// ─── Step metadata ──────────────────────────────────────────────────────────

interface StepDef {
  number: number;
  label: string;
  icon: LucideIcon;
}

// All four glyphs come from `lucide-react` — same icon family used
// everywhere else in the dashboard.
const STEPS: StepDef[] = [
  { number: 1, label: 'Connect', icon: GitBranch },
  { number: 2, label: 'Sync', icon: RefreshCw },
  { number: 3, label: 'Permissions', icon: ShieldCheck },
  { number: 4, label: 'Done', icon: Sparkles },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, setUser } = useUser();
  const { step, setStep } = useOnboardingStep();
  const { email } = useEmail();

  // ── Step 1 state ──
  // PAT is the only thing we ask for now. Username + numeric GitHub ID
  // come from `GET https://api.github.com/user` once the user submits
  // the token (see handleStep1).
  const [token, setToken] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // ── Step 2 state ──
  const [repos, setRepos] = useState<Repo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  // ── Cross-step feedback ──
  const [pageError, setPageError] = useState('');
  const [transitionLoading, setTransitionLoading] = useState(false);

  // ─── Step-transition helper ──────────────────────────────────────────────
  // Persists the new step server-side, updates local store, surfaces a
  // page-level error if the PATCH fails. Used by every Back/Continue button
  // so the server stays in sync with what the user sees.
  const moveToStep = async (nextStep: number) => {
    try {
      setTransitionLoading(true);
      setPageError('');
      await api.updateOnboardingStep(nextStep);
      setStep(nextStep);
      return true;
    } catch {
      setPageError('Failed to save onboarding progress. Please try again.');
      return false;
    } finally {
      setTransitionLoading(false);
    }
  };

  // ─── User-hydration recovery ─────────────────────────────────────────────
  // If we land on this page without a hydrated user (e.g. a hard refresh
  // mid-flow), pull the current user details from the server. Only the PAT
  // needs to be restored to local state — handleSync reads username + ID
  // off the hydrated `user` object.
  useEffect(() => {
    const recoverUser = async () => {
      if (user) return;
      try {
        const freshUser = await api.getUserDetails();
        setUser(freshUser);
        if (step > 1) {
          setToken(freshUser.access_token || '');
        }
      } catch {
        router.replace('/auth');
      }
    };
    recoverUser();
  }, [user, router, setUser, step]);

  // ─── Initial step bootstrap ──────────────────────────────────────────────
  // Source-of-truth for what step the user is actually on, fetched from the
  // server. If they've already completed onboarding, route them straight to
  // the dashboard. If they're somewhere mid-flow, restore their place AND
  // pre-load the repos list when applicable so the page renders correctly.
  //
  // Legacy-step note: this used to be a 5-step flow with `Agent` as step 4
  // and `Done` as step 5. Users left on backend step 5 are already complete
  // (they finished the old flow), so we route them to the dashboard. Users
  // left on backend step 4 (old "Agent") just see the new step 4 ("Done")
  // and click through — they already finished permissions, which was the
  // last step that mattered.
  useEffect(() => {
    const fetchInitialStep = async () => {
      try {
        const userDetails = await api.getUserDetails();
        setUser(userDetails);
        const response = await api.getOnboardingStep();
        const currentStep = response.onboarding_step;

        if (currentStep > 4) {
          router.replace('/dashboard');
          return;
        }

        if (currentStep >= 1 && currentStep <= 4) {
          setStep(currentStep);
          if (currentStep >= 3 && userDetails?.id) {
            const reposResponse = await api.getRepos(userDetails.id);
            if (reposResponse?.repos) {
              setRepos(reposResponse.repos);
              setSynced(true);
            }
          }
        }
      } catch {
        setPageError('Failed to load onboarding progress.');
      }
    };
    fetchInitialStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStep]);

  // ─── Step handlers (LOGIC UNCHANGED) ────────────────────────────────────

  const handleStep1 = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setStep1Error('Personal access token is required.');
      return;
    }
    setStep1Loading(true);
    setStep1Error('');
    try {
      // In demo/preview mode the mock layer doesn't intercept direct
      // `fetch()` calls to api.github.com — so a fake PAT would 401 here
      // and trap designers on step 1. Skip the real lookup and use canned
      // identity that matches the demo user the mocked api.saveUser
      // returns. Real users always run the real lookup.
      const isDemo =
        typeof document !== 'undefined' &&
        document.documentElement.dataset.demo === 'true';

      let ghLogin: string;
      let ghId: number;

      if (isDemo) {
        ghLogin = 'demo-user';
        ghId = 0;
      } else {
        // Resolve the user's GitHub identity (login + numeric id) from
        // the PAT itself instead of asking the user to dig through
        // GitHub's public user API for their numeric ID. The `/user`
        // endpoint returns both in a single CORS-enabled call.
        const ghRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${trimmed}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (ghRes.status === 401) {
          setStep1Error(
            "That token didn't work. Double-check it was copied in full and has the scopes listed below.",
          );
          return;
        }
        if (!ghRes.ok) {
          setStep1Error('Could not reach GitHub. Try again in a moment.');
          return;
        }
        const ghUser = (await ghRes.json()) as { login?: string; id?: number };
        if (!ghUser.login || typeof ghUser.id !== 'number') {
          setStep1Error('GitHub did not return a username or ID. Try a different token.');
          return;
        }
        ghLogin = ghUser.login;
        ghId = ghUser.id;
      }

      const response = await api.saveUser({
        github_user_id: ghId,
        username: ghLogin,
        github_pat: trimmed,
        email,
      });
      setUser(response);
      await moveToStep(2);
    } catch {
      setStep1Error('Could not verify the token. Check your network and try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // PAT lives in either local state (just-typed) or on the hydrated
      // user object (recovered after refresh). github_user_id comes off
      // user — we stamped it there at the end of step 1.
      //
      // Use a typeof check rather than `!githubUserId` because the demo
      // mock returns `0` as the canned ID — a valid number but falsy,
      // which would incorrectly trigger the "User not initialized" guard.
      const pat = token || user?.access_token || '';
      const githubUserId = user?.github_user_id;
      if (typeof githubUserId !== 'number' || !pat) {
        throw new Error('User not initialized');
      }
      const syncResponse = await api.syncRepos(githubUserId, pat);
      if (!syncResponse.success) {
        throw new Error(syncResponse.message || 'Sync failed');
      }
      const userId = user?.id;
      if (!userId) throw new Error('Missing user id');
      const reposResponse = await api.getRepos(userId);
      if (reposResponse?.repos && Array.isArray(reposResponse.repos)) {
        setRepos(reposResponse.repos);
      }
      setSynced(true);
    } catch {
      setPageError('Failed to sync repositories. Please check your GitHub token.');
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
      await moveToStep(4);
    } catch {
      setPageError('Failed to save repository permissions.');
    }
  };

  const handleLogout = async () => {
    // HTTPonly cookies — server clears via /auth/logout if needed.
    // For now, just route to /auth which will re-auth.
    await api.logOut();
    router.replace('/auth');
  };

  // ─── Permission tier shared between the bulk-apply chips and the
  //     legend strip at the top of the permissions step. ────────────
  const permOptions = [
    { value: 'allow', label: 'Allow', color: 'var(--success)', dark: 'var(--success-dark)' },
    {
      value: 'require_approval',
      label: 'Approval',
      color: 'var(--warning)',
      dark: 'var(--warning-dark)',
    },
    { value: 'deny', label: 'Deny', color: 'var(--error)', dark: 'var(--error-dark)' },
  ] as const;

  const currentStep = STEPS.find((s) => s.number === step) ?? STEPS[0];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-screen flex-col bg-[var(--bg-app)]">
      {/* Top bar — brand + sign-out. shrink-0 so header always spans full width;
          scrolling moves to the inner content div below. */}
      <header className="relative flex h-[56px] w-full shrink-0 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white/80 px-4 backdrop-blur-sm sm:px-6">
        <AegisLogo
          style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
        />
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      {/* Scrollable content area */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Soft warm gradient at top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(250, 115, 25, 0.08) 0%, rgba(250, 115, 25, 0.03) 40%, rgba(255, 255, 255, 0) 100%)',
          }}
        />

        <main className="relative mx-auto max-w-[640px] px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
          {/* Eyebrow + page title */}
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
              {step === 4 && 'Aegis is ready'}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-2 max-w-[460px] text-balance text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
            >
              {step === 1 &&
                'Paste a personal access token — we’ll pull your username and GitHub ID directly so you don’t have to look them up.'}
              {step === 2 &&
                'We use your token to fetch the repos you own or have access to.'}
              {step === 3 &&
                'Choose how Aegis should treat each repo. You can change these any time from Settings.'}
              {step === 4 &&
                'Your account is wired up. Create your first Room to connect an agent and start governing actions.'}
            </motion.p>
          </motion.div>

          {/* Stepper */}
          <StepIndicator current={step} reduce={!!reduce} />

          {/* Cross-step error */}
          {pageError && (
            <div className="mt-6">
              <ErrorCallout message={pageError} />
            </div>
          )}

          {/* Step content card */}
          <motion.section
            key={`step-${step}`}
            variants={staggerContainer(0.05, 0.04)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="mt-8 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
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
                <Field
                  label="Personal access token"
                  hint="We’ll call GitHub’s /user endpoint with this token to pull your username and ID — no extra fields needed."
                >
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_xxxxxxxx"
                    autoComplete="off"
                  />
                </Field>

                <TokenScopesCallout />

                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleStep1}
                  disabled={step1Loading || transitionLoading}
                  leadingIcon={
                    step1Loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined
                  }
                  trailingIcon={
                    !step1Loading && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  }
                  className="!h-10 !text-[13.5px] mt-1"
                >
                  {step1Loading ? 'Verifying token…' : 'Continue'}
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
                    {/* Bare discovery list — the right side intentionally
                        empty. Earlier iterations stamped a static "ALLOW"
                        chip next to each row to suggest a default, but
                        every reviewer read it as an interactive control
                        and got confused when clicking did nothing.
                        Permissioning belongs to step 3; this step is just
                        "your token worked, here's what we found." */}
                    <div className="max-h-72 overflow-y-auto rounded-[10px] border border-[var(--stroke-soft-200)] divide-y divide-[var(--stroke-soft-200)]">
                      {repos.map((repo) => (
                        <div
                          key={repo.name}
                          className="flex items-center gap-2 px-3.5 py-2.5"
                        >
                          <GitBranch
                            className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
                            strokeWidth={2}
                          />
                          <span className="truncate text-[13px] text-[var(--neutral-strong-950)]">
                            {repo.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11.5px] text-[var(--neutral-soft-400)]">
                      You&rsquo;ll set per-repo Allow / Approval / Deny in the next step.
                    </p>
                  </>
                )}

                {synced && (
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await moveToStep(1);
                      }}
                      disabled={transitionLoading}
                      leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
                      className="!h-10 !text-[13.5px] !px-5"
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        await moveToStep(3);
                      }}
                      disabled={transitionLoading}
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
                      await moveToStep(2);
                    }}
                    disabled={transitionLoading}
                    leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
                    className="!h-10 !text-[13.5px] !px-5"
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSavePermissions}
                    disabled={transitionLoading}
                    trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                    className="!h-10 !text-[13.5px] !px-5"
                  >
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4 — Done. Agent setup used to live as its own step
                here, but it now belongs inside each Room's Connect tab
                where we can auto-fill the room-specific MCP URL. Routing
                the user to /dashboard/rooms gets them to the next real
                action (create a Room → connect an agent) without making
                them re-paste a fake config in onboarding.

                Completing onboarding is an implicit "I want my real
                workspace" choice — record that by flipping aegis_demo
                to 'false' so:
                  • the demo welcome modal doesn't re-ask them on
                    /dashboard/rooms (they already chose real by doing
                    real onboarding)
                  • a user who arrived via "Sign up to use your
                    workspace" in the WorkspaceSwitcher doesn't bounce
                    back into the demo workspace they were exploring */}
            {step === 4 && (
              <DoneStep
                repoCount={repos.length}
                reduce={!!reduce}
                username={user?.username || ''}
                onContinue={() => {
                  try {
                    localStorage.setItem('aegis_demo', 'false');
                  } catch {
                    // ignore — localStorage may be unavailable in
                    // embedded contexts
                  }
                  router.replace('/dashboard/rooms');
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
      className="flex w-full items-start"
    >
      {STEPS.map((s, idx) => {
        const done = s.number < current;
        const active = s.number === current;
        const Icon = s.icon;

        return (
          <Fragment key={s.number}>
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

// ─── Unified icon component ────────────────────────────────────────────────
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
      <span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: t.halo }}
      />
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

// ─── Step 4 success screen ─────────────────────────────────────────────────
// Used to also show "first agent action" polling because the old step 4 had
// the user paste an MCP config inline. With agent setup moved to the per-Room
// Connect tab, that polling has nothing to wait on — so this step now just
// confirms account readiness and routes the user to /dashboard/rooms where
// the next real action (create a Room → connect an agent) happens.
function DoneStep({
  repoCount,
  reduce,
  onContinue,
  username,
}: {
  repoCount: number;
  reduce: boolean;
  onContinue: () => void;
  username?: string;
}) {
  // Confetti pop on mount
  const fired = useRef(false);
  useEffect(() => {
    if (reduce || fired.current) return;
    fired.current = true;
    const colors = ['#fa7319', '#fb8939', '#fbb138', '#1fc16b', '#335cff'];
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
      <motion.div
        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto mb-6 inline-flex"
      >
        <OnboardingIcon icon={ShieldCheck} size="xl" glow />
      </motion.div>

      <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        {username ? `Welcome, ${username}` : "You're set up"}
      </h2>
      <p className="mx-auto mt-2 max-w-[420px] text-balance text-[13.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
        Your GitHub account is connected and repos are permissioned. Next:
        create a Room to bind an agent and start governing tool calls.
      </p>

      <div className="mx-auto mt-7 grid max-w-[300px] grid-cols-2 gap-2.5">
        <MetricCard value={repoCount} label="Repos" reduce={reduce} delay={0} />
        <MetricCard value={0} label="Rooms" reduce={reduce} delay={0.08} />
      </div>

      <div className="mt-7">
        <Button
          variant="primary"
          onClick={onContinue}
          trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
          className="!h-10 !text-[13.5px] !px-5"
        >
          Create your first Room
        </Button>
      </div>
    </motion.div>
  );
}

function MetricCard({
  value,
  label,
  reduce,
  delay,
}: {
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

// ─── Error callout ──────────────────────────────────────────────────────────
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

// ─── Token-scopes callout ──────────────────────────────────────────────────
function TokenScopesCallout() {
  const SCOPES = [
    { name: 'repo', description: 'Full control of private repositories' },
    { name: 'read:org', description: 'Read org membership' },
    { name: 'workflow', description: 'Update workflows' },
  ];
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-2.5">
        <OnboardingIcon icon={Key} size="sm" />
        <span className="text-[11.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          Required token scopes
        </span>
      </div>
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

// ─── Permission segment ─────────────────────────────────────────────────────
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
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-semibold transition-colors ${
              i < options.length - 1 ? 'border-r border-[var(--stroke-sub-300)]' : ''
            }`}
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

// ─── Field helper ───────────────────────────────────────────────────────────
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
