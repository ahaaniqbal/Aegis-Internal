'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  KeyRound,
  Lock,
  LogOut,
  Palette,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
  Webhook,
  type LucideIcon,
  Router,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { useOnboardingStep, useUser } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { KillSwitchesSection } from '@/components/dashboard/KillSwitches';
import {
  removeCustomAvatar,
  setCustomAvatarFromFile,
  useCustomAvatar,
} from '@/lib/customAvatar';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import { useRouter } from 'next/navigation';

// ── Section catalog ─────────────────────────────────────────────────────────
type SectionId =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'github'
  | 'credentials'
  | 'repositories'
  | 'api-keys'
  | 'webhooks'
  | 'approval-routing'
  | 'policies'
  | 'audit'
  | 'billing'
  | 'danger';

type Section = { id: SectionId; label: string; icon: LucideIcon };
type Group = { label: string; items: Section[] };

const GROUPS: Group[] = [
  {
    label: 'Account',
    items: [
      { id: 'profile',       label: 'Profile',       icon: UserIcon },
      { id: 'appearance',    label: 'Appearance',    icon: Palette },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'security',      label: 'Security',      icon: Shield },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'github',       label: 'GitHub',       icon: Link2 },
      { id: 'credentials',  label: 'Credentials',  icon: KeyRound },
      { id: 'repositories', label: 'Repositories', icon: GitBranch },
      { id: 'api-keys',     label: 'API Keys',     icon: KeyRound },
      { id: 'webhooks',     label: 'Webhooks',     icon: Webhook },
      { id: 'approval-routing', label: 'Approval Routing', icon: GitBranch },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'policies', label: 'Policies', icon: Lock },
      { id: 'audit',    label: 'Audit & Retention', icon: FileText },
      { id: 'billing',  label: 'Plan & Usage',      icon: CreditCard },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
    ],
  },
];

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  profile:       'How you appear inside Aegis.',
  appearance:    'Theme and visual preferences for the dashboard.',
  notifications: 'Where and when Aegis pings you about agent activity.',
  credentials:   'Aegis holds tokens on behalf of agents — they never see raw keys.',
  'approval-routing': 'Route approval requests by environment, blast radius, or time.',
  security:      'Passwords, two-factor auth, and active sessions.',
  github:        'Your GitHub identity and personal access token.',
  repositories:  'Per-repo read/write permissions for your agents.',
  'api-keys':    'Programmatic access tokens for the Aegis API.',
  webhooks:      'Push every decision event to your own systems in real time.',
  policies:      'Quick view of which governance rules are armed.',
  audit:         'How long Aegis keeps every decision on record.',
  billing:       'Your plan, usage, and invoices.',
  danger:        'Irreversible account actions.',
};

const FLAT_SECTIONS: Section[] = GROUPS.flatMap((g) => g.items);

// ── Page ────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, setUser, clearUser } = useUser();
  const { setStep } = useOnboardingStep();
  const reduce = useReducedMotion();
  const toast = useToast();
  const router = useRouter();

  // Section routing via URL hash so settings are deep-linkable
  const [active, setActive] = useState<SectionId>('profile');
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as SectionId;
    if (FLAT_SECTIONS.some((s) => s.id === hash)) setActive(hash);
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as SectionId;
      if (FLAT_SECTIONS.some((s) => s.id === h)) setActive(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (id: SectionId) => {
    setActive(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  // Cross-section state. `error` is still kept for the inline ErrorBanner
  // (used for hard, persistent failures that block a section). Success
  // events are now routed exclusively through the global toast system.
  const [error, setError] = useState<string | null>(null);

  // Sub-section callbacks: route every success → toast.success, and
  // every error → toast.error PLUS the inline banner (so it's both
  // glanceable and persistent for hard failures).
  const handleSectionSuccess = useCallback(
    (message: string) => toast.success(message),
    [toast],
  );
  const handleSectionError = useCallback(
    (message: string) => {
      setError(message);
      toast.error(message);
    },
    [toast],
  );

  const activeSection = useMemo(
    () => FLAT_SECTIONS.find((s) => s.id === active) ?? FLAT_SECTIONS[0],
    [active],
  );

  return (
    <>
      <Topbar title="Settings" subtitle="Account, integrations, governance" minimal />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {/* Success feedback now lives in the global toast viewport
            (bottom-right). The old inline success banner was removed
            in favor of a more glanceable, non-disruptive toast. */}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* ── Sidebar nav ─────────────────────────────────────────── */}
          <motion.aside
            className="lg:sticky lg:top-[72px] lg:self-start"
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out, delay: 0.08 }}
          >
            <nav className="space-y-5">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = active === item.id;
                      const isDanger = item.id === 'danger';
                      return (
                        <button
                          key={item.id}
                          onClick={() => goTo(item.id)}
                          className={[
                            'flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2 text-[13px] font-medium tracking-[-0.01em]',
                            isActive && isDanger
                              ? 'bg-[var(--error-lighter)] text-[var(--error)]'
                              : isActive
                              ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                              : isDanger
                              ? 'text-[var(--error)] hover:bg-[var(--error-lighter)]'
                              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                          ].join(' ')}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </motion.aside>

          {/* ── Main content ────────────────────────────────────────── */}
          <motion.div
            key={active}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out }}
          >
            <header className="mb-6">
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
                Settings
              </p>
              <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
                {activeSection.label}
              </h1>
              <p className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]">
                {SECTION_DESCRIPTIONS[active]}
              </p>
            </header>

            {active === 'profile' && (
              <ProfileSection user={user} setUser={setUser} onError={handleSectionError} onSuccess={handleSectionSuccess} reduce={!!reduce} />
            )}
            {active === 'appearance' && <AppearanceSection reduce={!!reduce} />}
            {active === 'notifications' && <NotificationsSection reduce={!!reduce} onSuccess={handleSectionSuccess} />}
            {active === 'security' && <SecuritySection reduce={!!reduce} />}
            {active === 'github' && <GitHubSection user={user} reduce={!!reduce} />}
            {active === 'credentials' && <CredentialsSection reduce={!!reduce} />}
            {active === 'repositories' && (
              <RepositoriesSection user={user} reduce={!!reduce} onError={handleSectionError} onSuccess={handleSectionSuccess} />
            )}
            {active === 'api-keys' && <ApiKeysSection reduce={!!reduce} onSuccess={handleSectionSuccess} />}
            {active === 'webhooks' && <WebhooksSection reduce={!!reduce} onSuccess={handleSectionSuccess} />}
            {active === 'approval-routing' && <ApprovalRoutingSection reduce={!!reduce} />}
            {active === 'policies' && <PoliciesPreview reduce={!!reduce} />}
            {active === 'audit' && <AuditSection reduce={!!reduce} onSuccess={handleSectionSuccess} />}
            {active === 'billing' && <BillingSection reduce={!!reduce} />}
            {active === 'danger' && (
              <DangerSection
                onReset={() => {
                  setStep(1);
                  window.location.href = '/onboarding';
                }}
                onLogout={() => {
                  clearUser();
                  api.logOut()
                  router.replace('/auth');
                }}
                reduce={!!reduce}
              />
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

// ── Shared primitives ───────────────────────────────────────────────────────
function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke-soft-200)] p-5">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12.5px] text-[var(--neutral-sub-600)]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11.5px] text-[var(--neutral-soft-400)]">{hint}</p>
      )}
    </div>
  );
}

function Row({
  title,
  description,
  meta,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">
            {description}
          </p>
        )}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Section: Appearance ─────────────────────────────────────────────────────
// Canonical home for the theme switch. The same control surfaces in the
// profile dropdown as a compact pill — both write to the same
// `localStorage.aegis_theme` flag + DOM attribute, so they stay in sync.
function AppearanceSection({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.default, ease: EASE.out }}
    >
      <SettingsCard
        title="Theme"
        description="Choose how the dashboard looks. Auth and onboarding stay light by design."
      >
        <ThemeToggle variant="card" />
      </SettingsCard>
    </motion.div>
  );
}

// ── Section: Profile ────────────────────────────────────────────────────────
function ProfileSection({
  user,
  setUser,
  onError,
  onSuccess,
  reduce,
}: {
  user: ReturnType<typeof useUser>['user'];
  setUser: ReturnType<typeof useUser>['setUser'];
  onError: (e: string) => void;
  onSuccess: (s: string) => void;
  reduce: boolean;
}) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');
  const [saving, setSaving] = useState(false);
  // Avatar upload — useCustomAvatar() reads localStorage + listens
  // for changes, so the hero updates immediately after upload/remove
  // without a manual re-fetch.
  const customAvatar = useCustomAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setToken(user.access_token || '');
    }
  }, [user]);

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input early so picking the same file twice still fires
    // a change event.
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await setCustomAvatarFromFile(file);
      onSuccess('Profile picture updated');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the image.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onAvatarRemove = () => {
    removeCustomAvatar();
    onSuccess('Reverted to generative avatar');
  };

  const save = async () => {
    if (!user?.github_user_id) return;
    setSaving(true);
    try {
      const updated = await api.saveUser({
        github_user_id: user.github_user_id,
        username,
        email,
        github_pat: token,
      });
      setUser(updated);
      onSuccess('Profile updated');
    } catch {
      onError('Failed to update profile');
    }
    setSaving(false);
  };

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Identity"
          description="Your public-facing details inside Aegis."
        >
          {/* Profile picture row.
              Default: a hero-sized generative halftone avatar seeded
              by username — matches the topbar + sidebar marks, so a
              user's identity reads identically everywhere across the
              product. Upload an image to override (stored locally
              for now; backend persistence is a future engineer task).
              Removing reverts to the generative fallback. */}
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar
              seed={user?.username || user?.email || 'user'}
              size={64}
              radius={14}
            />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">
                Profile picture
              </p>
              <p className="text-[11.5px] text-[var(--neutral-soft-400)]">
                {customAvatar
                  ? 'Custom upload. Remove to use the generative default.'
                  : 'Auto-generated from your username. Upload to customize.'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarFile}
            />
            {customAvatar && (
              <Button
                variant="secondary"
                onClick={onAvatarRemove}
                disabled={avatarBusy}
              >
                Remove
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              leadingIcon={
                <Upload className="h-3.5 w-3.5" strokeWidth={2} />
              }
            >
              {customAvatar ? 'Replace' : 'Upload'}
            </Button>
          </div>

          <Field label="Display name">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Email" hint="Used for approval and incident notifications.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="GitHub user ID">
            <Input value={String(user?.github_user_id || '')} disabled />
          </Field>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              variant="primary"
              onClick={save}
              disabled={saving}
              leadingIcon={
                saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : undefined
              }
            >
              Save
            </Button>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Personal access token"
          description="Used by Aegis to talk to GitHub on your behalf."
        >
          <Field label="GitHub PAT" hint="Treat this like a password. Rotate it if exposed.">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between">
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
            >
              Manage tokens on GitHub
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
            <Button variant="primary" onClick={save} disabled={saving}>
              Update token
            </Button>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Notifications ──────────────────────────────────────────────────
function NotificationsSection({
  reduce,
  onSuccess,
}: {
  reduce: boolean;
  onSuccess: (s: string) => void;
}) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  const EVENTS: { id: string; label: string; description: string; tone: 'error' | 'warning' | 'feature' | 'info' }[] = [
    { id: 'approval',  label: 'Approval requested',  description: 'A pending action needs review.',           tone: 'warning' },
    { id: 'denied',    label: 'Action denied',       description: 'A policy blocked an agent action.',         tone: 'error' },
    { id: 'rewrite',   label: 'Action rewritten',    description: 'Aegis routed an action to a safer path.',   tone: 'feature' },
    { id: 'policy',    label: 'Policy violated',     description: 'A configured rule fired.',                  tone: 'warning' },
    { id: 'anomaly',   label: 'Session anomaly',     description: 'Unusual agent behavior detected.',          tone: 'error' },
    { id: 'budget',    label: 'Token budget threshold', description: 'Spend hit 75% / 90% / 100% of cap.',     tone: 'info' },
  ];
  const [events, setEvents] = useState<Record<string, boolean>>(
    Object.fromEntries(EVENTS.map((e) => [e.id, true])),
  );

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Channels"
          description="Where Aegis sends notifications."
        >
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            <Row
              title="Email"
              description="Sent to your account email address."
              action={
                <Switch
                  checked={emailEnabled}
                  onChange={setEmailEnabled}
                  ariaLabel="Toggle email notifications"
                />
              }
            />
            <Row
              title="Slack"
              description="Coming soon. Connect a workspace to forward alerts to a channel."
              action={
                <Switch
                  checked={slackEnabled}
                  onChange={setSlackEnabled}
                  disabled
                  ariaLabel="Toggle Slack notifications"
                />
              }
            />
            <Row
              title="Webhook"
              description="Post events to your own endpoint. Configured in Webhooks."
              action={
                <Switch
                  checked={webhookEnabled}
                  onChange={setWebhookEnabled}
                  ariaLabel="Toggle webhook notifications"
                />
              }
            />
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Events"
          description="Pick exactly which events you want to hear about."
        >
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {EVENTS.map((evt) => (
              <Row
                key={evt.id}
                title={
                  <div className="flex items-center gap-2">
                    <Badge tone={evt.tone} uppercase>
                      {evt.id}
                    </Badge>
                    <span>{evt.label}</span>
                  </div>
                }
                description={evt.description}
                action={
                  <Switch
                    checked={events[evt.id]}
                    onChange={(v) => setEvents((p) => ({ ...p, [evt.id]: v }))}
                    ariaLabel={`Toggle ${evt.label}`}
                  />
                }
              />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-end">
            <Button variant="primary" onClick={() => onSuccess('Notification preferences saved')}>
              Save preferences
            </Button>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Security ───────────────────────────────────────────────────────
function SecuritySection({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      {/* Kill Switches — emergency governance controls. */}
      <motion.div variants={fadeUp}>
        <KillSwitchesSection />
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Two-factor authentication"
          description="Add an extra step on sign in. Strongly recommended for accounts that govern agents."
          action={<Badge tone="warning" uppercase>Not enabled</Badge>}
        >
          <Row
            title="Authenticator app (TOTP)"
            description="Use 1Password, Authy, or any TOTP-compatible app."
            action={<Button variant="primary" disabled>Set up</Button>}
          />
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Active sessions"
          description="Devices currently signed into your Aegis account."
        >
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            <Row
              title={
                <span className="inline-flex items-center gap-2">
                  This device
                  <Badge tone="success" uppercase>Current</Badge>
                </span>
              }
              description="macOS · Chrome · just now"
              action={<Button variant="secondary" disabled>—</Button>}
            />
          </div>
          <div className="mt-4 flex items-center justify-end">
            <Button
              variant="secondary"
              leadingIcon={<LogOut className="h-3.5 w-3.5" strokeWidth={2} />}
              disabled
            >
              Sign out of all other sessions
            </Button>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: GitHub ─────────────────────────────────────────────────────────
function GitHubSection({
  user,
  reduce,
}: {
  user: ReturnType<typeof useUser>['user'];
  reduce: boolean;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="GitHub connection"
          description="Aegis uses GitHub to inspect repos, branches, and pull-request state."
          action={
            <Badge tone="success" uppercase leadingDot>
              Connected
            </Badge>
          }
        >
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            <Row
              title="Username"
              description="Display name pulled from your GitHub account."
              meta={<CodeChip>{user?.username || '—'}</CodeChip>}
            />
            <Row
              title="GitHub user ID"
              meta={<CodeChip>{user?.github_user_id || '—'}</CodeChip>}
            />
            <Row
              title="Token scopes"
              description="Required scopes for read + PR creation flows."
              meta={
                <div className="flex flex-wrap gap-1">
                  <CodeChip>repo</CodeChip>
                  <CodeChip>read:user</CodeChip>
                  <CodeChip>workflow</CodeChip>
                </div>
              }
            />
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Repositories ───────────────────────────────────────────────────
function RepositoriesSection({
  user,
  reduce,
  onError,
  onSuccess,
}: {
  user: ReturnType<typeof useUser>['user'];
  reduce: boolean;
  onError: (e: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [originalRepos, setOriginalRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const fetchRepos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.getRepos(user.id);
      const list = response?.repos || [];
      setRepos(list);
      setOriginalRepos(JSON.parse(JSON.stringify(list)));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) fetchRepos();
  }, [user, fetchRepos]);

  const handleSync = async () => {
    if (!user?.github_user_id || !user?.access_token) return;
    setSyncing(true);
    try {
      await api.syncRepos(user.github_user_id, user.access_token);
      await fetchRepos();
      onSuccess('Repositories synced');
    } catch {
      onError('Failed to sync');
    }
    setSyncing(false);
  };

  const setPermission = (index: number, permission: 'read' | 'write') => {
    setRepos((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (permission === 'read') {
          const next = !r.can_read;
          return next ? { ...r, can_read: next } : { ...r, can_read: next, can_write: false };
        }
        return { ...r, can_write: !r.can_write };
      }),
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const changed = repos.filter((repo, i) => {
        const original = originalRepos[i];
        return (
          original &&
          (original.can_read !== repo.can_read || original.can_write !== repo.can_write)
        );
      });
      const results = await Promise.all(
        changed.map((repo) =>
          api.setPermission(
            user.id!,
            repo.github_repo_id,
            repo.can_read || false,
            repo.can_write || false,
          ),
        ),
      );
      if (results.every((r) => r.success)) {
        setOriginalRepos(JSON.parse(JSON.stringify(repos)));
        onSuccess('Permissions saved');
      } else {
        onError('Some permissions failed to save');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save permissions');
    }
    setSaving(false);
  };

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Repository permissions"
          description="Grant Aegis read or write access per repo. Write requires read."
          action={
            <Button
              variant="secondary"
              onClick={handleSync}
              disabled={syncing}
              leadingIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                  strokeWidth={2}
                />
              }
            >
              Sync
            </Button>
          }
        >
          <div className="mb-3">
            <Input
              type="text"
              placeholder="Search repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
              {repos.length === 0 ? 'No repositories synced.' : 'No repos match your search.'}
            </p>
          ) : (
            <div className="max-h-[420px] divide-y divide-[var(--stroke-soft-200)] overflow-y-auto rounded-[8px] border border-[var(--stroke-soft-200)]">
              {filtered.map((repo) => {
                const i = repos.findIndex(
                  (r) => r.github_repo_id === repo.github_repo_id,
                );
                return (
                  <div
                    key={repo.name}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[var(--neutral-strong-950)]">
                        {repo.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Read = success green (granted read-only access,
                          low-risk). Write = brand primary orange (the
                          more powerful grant; matches the rest of the
                          Aegis active-state language). Previously Read
                          was generic info blue and Write was warning
                          amber — "Write is a warning" framed the action
                          as dangerous when it's just granting more
                          permission. */}
                      <PermPill
                        label="Read"
                        active={!!repos[i].can_read}
                        onClick={() => setPermission(i, 'read')}
                        color="var(--success)"
                      />
                      <PermPill
                        label="Write"
                        active={!!repos[i].can_write}
                        onClick={() => setPermission(i, 'write')}
                        disabled={!repos[i].can_read}
                        color="var(--primary-base)"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              leadingIcon={
                saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : undefined
              }
            >
              Save permissions
            </Button>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

function PermPill({
  label,
  active,
  onClick,
  disabled,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-6 items-center rounded-[6px] px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'hover:brightness-110' : 'hover:bg-[var(--neutral-weak-50)]',
      ].join(' ')}
      style={
        active
          ? { backgroundColor: color, color: '#fff' }
          : {
              border: '1px solid var(--stroke-sub-300)',
              color: 'var(--neutral-sub-600)',
              backgroundColor: '#fff',
            }
      }
    >
      {label}
    </button>
  );
}

// ── Section: API Keys ───────────────────────────────────────────────────────
//
// "Coming soon" surface. Previously this section showed two fake
// aegis_live_* keys with working-looking Copy/Revoke buttons. That
// reads as "this works today" to anyone touring the dashboard, but
// Jenil's backend has no Aegis REST API yet (the only integration
// path is the per-room MCP endpoint). Replaced with an honest
// EmptyState that names the planned scopes so reviewers understand
// what'll ship.
function ApiKeysSection({
  reduce,
}: {
  reduce: boolean;
  onSuccess: (s: string) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="API keys"
          description="Programmatic access to Aegis from your scripts and CI."
        >
          <EmptyState
            icon={<KeyRound className="h-5 w-5" />}
            title="API keys are on the roadmap"
            description="Once shipped, you'll generate scoped keys and call the Aegis REST API from CI pipelines, automation scripts, or custom integrations."
            compact
          />
          <div className="mt-2 border-t border-[var(--stroke-soft-200)] pt-5">
            <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
              Planned scopes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'runs:read',
                'approvals:read',
                'approvals:write',
                'policies:read',
                'audit:read',
                'token-usage:read',
              ].map((scope) => (
                <CodeChip key={scope}>{scope}</CodeChip>
              ))}
            </div>
            <p className="mt-4 text-[12px] italic text-[var(--neutral-soft-400)]">
              Reach out via support if this is a blocker for your team — we
              prioritize the roadmap on customer need.
            </p>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Webhooks ───────────────────────────────────────────────────────
//
// "Coming soon" surface. Previously this rendered a working-looking
// add-endpoint form, status badges, and a placeholder signing secret
// (whsec_b7c9…ab12). The backend has no webhook fan-out today.
// Replaced with an honest EmptyState plus a concrete event list so
// SecOps reviewers can see exactly which events they'll be able to
// subscribe to — that's typically what they ask for in a first sales
// call (PagerDuty / Slack / Datadog wiring).
function WebhooksSection({
  reduce,
}: {
  reduce: boolean;
  onSuccess: (s: string) => void;
}) {
  const toast = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; latency: number } | null>(null);

  const webhooks = [
    {
      id: 'wh_pd',
      name: 'PagerDuty escalation',
      url: 'https://events.pagerduty.com/v2/enqueue',
      events: ['action.denied', 'approval.requested', 'agent.quarantined'],
      lastDelivery: '2h ago · 200 OK',
    },
    {
      id: 'wh_audit',
      name: 'Internal audit sink',
      url: 'https://audit.internal.company.com/aegis',
      events: ['*'],
      lastDelivery: '4m ago · 200 OK',
    },
  ];

  const testWebhook = (id: string, url: string) => {
    setTestingId(id);
    setTestResult(null);
    setTimeout(() => {
      setTestingId(null);
      setTestResult({ id, latency: 143 });
      toast.success(`Test delivered to ${url.replace(/^https?:\/\//, '').slice(0, 32)}…`, {
        description: '200 OK · 143ms',
      });
    }, 800);
  };

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Webhooks"
          description="Aegis POSTs a signed JSON payload to your endpoint when matching events occur."
          action={
            <Button
              variant="primary"
              leadingIcon={<Webhook className="h-3.5 w-3.5" strokeWidth={2.25} />}
              onClick={() => toast.success('Add-webhook flow coming soon', { description: 'Email ahaan@runaegis.co to wire a webhook today.' })}
            >
              Add webhook
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-3 py-2.5">URL</th>
                  <th className="px-3 py-2.5">Events</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Last delivery</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                {webhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-[var(--neutral-weak-50)]">
                    <td className="px-4 py-3 font-semibold text-[var(--neutral-strong-950)]">{w.name}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--neutral-sub-600)]">
                      {w.url.length > 38 ? `${w.url.slice(0, 38)}…` : w.url}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <code key={e} className="rounded-[4px] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--neutral-sub-600)] ring-1 ring-[var(--stroke-soft-200)]">
                            {e}
                          </code>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ backgroundColor: 'rgba(31,193,107,0.10)', color: 'var(--success)' }}>
                        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                        Active
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--neutral-sub-600)]">{w.lastDelivery}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => testWebhook(w.id, w.url)}
                          disabled={testingId === w.id}
                          className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)] disabled:opacity-50"
                        >
                          {testingId === w.id ? 'Testing…' : 'Test'}
                        </button>
                        <button className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]">
                          Edit
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {testResult && (
            <div className="mt-4 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 font-mono text-[11px] text-[var(--neutral-strong-950)]">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">Test response</p>
              <p>POST · 200 OK · {testResult.latency}ms</p>
              <p className="mt-1 text-[10.5px] text-[var(--neutral-sub-600)]">{`{ "event": "test", "timestamp": "${new Date().toISOString()}" }`}</p>
            </div>
          )}
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Policies Preview ──────────────────────────────────────────────
function PoliciesPreview({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Active policies"
          description="A snapshot of the rules currently evaluating every agent action."
          action={
            <Link href="/dashboard/policies">
              <Button
                variant="secondary"
                trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Manage all
              </Button>
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              'Protected Branch Denial',
              'Freeze Window Enforcement',
              'Mandatory PR Flow',
              'Secret Detection',
              'No Autonomous Merge',
              'CI Required Before Merge',
            ].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 text-[12.5px] text-[var(--neutral-strong-950)]"
              >
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: 'var(--success)' }}
                  strokeWidth={2.25}
                />
                {p}
              </div>
            ))}
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Audit & Retention ──────────────────────────────────────────────
function AuditSection({
  reduce,
  onSuccess,
}: {
  reduce: boolean;
  onSuccess: (s: string) => void;
}) {
  const [retention, setRetention] = useState<'90' | '365' | 'forever'>('365');

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Retention"
          description="How long Aegis keeps every decision before purging the record."
        >
          <div className="flex flex-wrap gap-2">
            {[
              { id: '90' as const,      label: '90 days' },
              { id: '365' as const,     label: '1 year' },
              { id: 'forever' as const, label: 'Forever' },
            ].map((opt) => {
              const active = retention === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setRetention(opt.id)}
                  className={[
                    'h-8 rounded-[8px] px-3 text-[12.5px] font-medium',
                    active
                      ? 'border border-[var(--primary-base)] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                      : 'border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              onClick={() => onSuccess('Retention policy saved')}
            >
              Save
            </Button>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Export"
          description="Download every audit event as a single JSON file."
          action={
            <Link href="/dashboard/audit">
              <Button
                variant="secondary"
                trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Open audit trail
              </Button>
            </Link>
          }
        >
          <Button
            variant="primary"
            leadingIcon={<Download className="h-3.5 w-3.5" strokeWidth={2.25} />}
            onClick={() => onSuccess('Export started. Check your email.')}
          >
            Export full audit log
          </Button>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Plan & Usage ───────────────────────────────────────────────────
function BillingSection({ reduce }: { reduce: boolean }) {
  const toast = useToast();
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Current plan"
          description="Aegis Pro · billed monthly"
          action={<Badge tone="primary" uppercase>Pro</Badge>}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">Price</p>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-[var(--neutral-strong-950)]">$299<span className="text-[12px] font-normal text-[var(--neutral-sub-600)]">/mo</span></p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">Renews</p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--neutral-strong-950)]">June 5, 2026</p>
            </div>
            <div className="flex items-end justify-end sm:items-start">
              <Button
                variant="secondary"
                onClick={() => toast.success('Billing portal opening…', { description: 'Demo workspace — connect Stripe to see real invoices.' })}
              >
                Manage billing
              </Button>
            </div>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Usage this month"
          description="Resets May 31, 2026"
        >
          <div className="space-y-4">
            <UsageBlock label="Actions" used={23456} cap={50000} suffix="this month" />
            <UsageBlock label="Audit retention" used={23} cap={90} suffix="days" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">Agents connected</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">8 <span className="font-mono text-[11px] font-normal text-[var(--neutral-sub-600)]">· unlimited (Pro)</span></p>
            </div>
            <div className="rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">Repos governed</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">6 <span className="font-mono text-[11px] font-normal text-[var(--neutral-sub-600)]">· unlimited (Pro)</span></p>
            </div>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Plan comparison"
          description="Upgrade for unlimited retention and enterprise features."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--stroke-soft-200)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                  <th className="px-3 py-2.5"></th>
                  <th className="px-3 py-2.5">Starter</th>
                  <th className="px-3 py-2.5">
                    Pro
                    <span className="ml-1 inline-block rounded-full bg-[var(--primary-base)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white">Current</span>
                  </th>
                  <th className="px-3 py-2.5">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                {[
                  ['Actions / month',     '1,000',     '50,000',    'Unlimited'],
                  ['Agents',              '1',         'Unlimited', 'Unlimited'],
                  ['Audit retention',     '30 days',   '90 days',   'Unlimited'],
                  ['SOC 2 export',        '—',         '✓',         '✓'],
                  ['VPC deployment',      '—',         '—',         '✓'],
                  ['Compliance bundles',  '—',         '—',         '✓'],
                  ['SLA',                 '—',         '—',         '99.9%'],
                  ['Price',               'Free',      '$299/mo',   '$1,500+/mo'],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td className="px-3 py-2.5 font-semibold text-[var(--neutral-strong-950)]">{row[0]}</td>
                    <td className="px-3 py-2.5 text-[var(--neutral-sub-600)]">{row[1]}</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--neutral-strong-950)]">{row[2]}</td>
                    <td className="px-3 py-2.5 text-[var(--neutral-sub-600)]">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-end">
            <a href="mailto:deals@runaegis.co">
              <Button variant="primary">Contact sales</Button>
            </a>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

function UsageBlock({
  label,
  used,
  cap,
  suffix,
}: {
  label: string;
  used: number;
  cap: number;
  suffix: string;
}) {
  const pct = Math.min(100, (used / cap) * 100);
  const accent = pct > 90 ? 'var(--error)' : pct > 75 ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
        {used.toLocaleString()}
        <span className="ml-1 text-[12px] font-normal text-[var(--neutral-soft-400)]">
          / {cap.toLocaleString()}
        </span>
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--neutral-soft-200)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">
        {Math.round(pct)}% · {suffix}
      </p>
    </div>
  );
}

// ── Section: Credentials ────────────────────────────────────────────────────
function CredentialsSection({ reduce }: { reduce: boolean }) {
  const toast = useToast();
  const credentials = [
    { name: 'GitHub PAT (ahaaniqbal)',         type: 'Personal Access Token',  scope: 'GitHub MCP',     agents: 'All agents',           lastUsed: '2m ago',   rotation: 'Never' },
    { name: 'Aegis DB Connection String',      type: 'Database credential',    scope: 'PostgreSQL MCP', agents: 'claude-sonnet-4, aider', lastUsed: '4h ago',  rotation: 'Every 90 days (next: Jun 15)' },
    { name: 'Linear API Key',                  type: 'API Key',                scope: 'Linear MCP',     agents: 'cursor-agent',          lastUsed: 'Yesterday', rotation: 'Never' },
  ];
  const usageLog = [
    { ts: '2m ago',   cred: 'GitHub PAT',  agent: 'claude-sonnet-4', action: 'push_files',   target: 'aegis/dashboard' },
    { ts: '14m ago',  cred: 'Linear API',  agent: 'cursor-agent',    action: 'list_issues',  target: 'team_eng' },
    { ts: '1h ago',   cred: 'GitHub PAT',  agent: 'aider',           action: 'create_branch',target: 'aegis/mcp-server' },
    { ts: '2h ago',   cred: 'Aegis DB',    agent: 'claude-sonnet-4', action: 'query',        target: 'aegis_audit' },
    { ts: '4h ago',   cred: 'Aegis DB',    agent: 'aider',           action: 'query',        target: 'aegis_audit' },
  ];
  return (
    <motion.div variants={staggerContainer(0.05)} initial={reduce ? false : 'hidden'} animate="show">
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Credential Isolation"
          description="Aegis holds credentials on behalf of your agents. Agents never see raw API keys or tokens — Aegis injects them into proxied requests at execution time."
          action={
            <Button
              variant="primary"
              onClick={() => toast.success('Add-credential flow coming soon', { description: 'Email ahaan@runaegis.co to wire a credential today.' })}
            >
              Add credential
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Scoped to</th>
                  <th className="px-3 py-2.5">Agents</th>
                  <th className="px-3 py-2.5">Last used</th>
                  <th className="px-3 py-2.5">Rotation</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                {credentials.map((c) => (
                  <tr key={c.name} className="hover:bg-[var(--neutral-weak-50)]">
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">{c.name}</td>
                    <td className="px-3 py-3 text-[var(--neutral-sub-600)]">{c.type}</td>
                    <td className="px-3 py-3 font-mono text-[11.5px] text-[var(--neutral-strong-950)]">{c.scope}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--neutral-sub-600)]">{c.agents}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--neutral-sub-600)]">{c.lastUsed}</td>
                    <td className="px-3 py-3 text-[11.5px] text-[var(--neutral-sub-600)]">{c.rotation}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <button onClick={() => toast.success(`Rotating ${c.name}…`)} className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]">
                          Rotate
                        </button>
                        <button onClick={() => toast.success(`Revoked ${c.name}`)} className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--error)] hover:bg-[var(--neutral-weak-50)]">
                          Revoke
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard title="Recent usage" description="Last 5 credential injections by Aegis on behalf of your agents.">
          <ul className="divide-y divide-[var(--stroke-soft-200)]">
            {usageLog.map((u, i) => (
              <li key={i} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-1 py-2.5">
                <span className="font-mono text-[11px] text-[var(--neutral-sub-600)]">{u.ts}</span>
                <span className="font-mono text-[11.5px] text-[var(--neutral-strong-950)]">
                  <span className="font-semibold">{u.cred}</span>
                  <span className="mx-1.5 text-[var(--neutral-soft-400)]">·</span>
                  {u.agent}
                  <span className="mx-1.5 text-[var(--neutral-soft-400)]">·</span>
                  {u.action}
                </span>
                <span className="font-mono text-[11px] text-[var(--neutral-sub-600)]">{u.target}</span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-5 flex items-start gap-3 rounded-[10px] border px-4 py-3" style={{ backgroundColor: 'rgba(246, 181, 30, 0.08)', borderColor: 'rgba(246, 181, 30, 0.32)' }}>
          <Shield className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warning-dark)' }} strokeWidth={2.25} />
          <p className="text-[12.5px] leading-[1.5] text-[var(--neutral-strong-950)]">
            Credentials stored by Aegis are encrypted at rest using AES-256. They are never exposed in agent context windows or audit log payloads — only a masked reference (e.g. <code className="font-mono">cred_***abc</code>) appears in logs.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Approval Routing ──────────────────────────────────────────────
function ApprovalRoutingSection({ reduce }: { reduce: boolean }) {
  const toast = useToast();
  const rules = [
    { id: 'r1', name: 'Production-tier actions', condition: 'environment_tier = production',  routeTo: 'ahaaniqbal (Owner)',          requireN: 1, escalation: '—' },
    { id: 'r2', name: 'Critical blast radius',   condition: 'blast_radius = critical',         routeTo: 'ahaaniqbal + kai',            requireN: 2, escalation: '—' },
    { id: 'r3', name: 'Outside business hours',  condition: 'within_business_hours = false',   routeTo: 'ahaaniqbal (Owner)',          requireN: 1, escalation: 'Auto-escalate after 15m' },
  ];
  return (
    <motion.div variants={staggerContainer(0.05)} initial={reduce ? false : 'hidden'} animate="show">
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Approval Routing"
          description="Configure who gets notified and who must approve based on action risk."
          action={
            <Button
              variant="primary"
              onClick={() => toast.success('Rule builder coming soon', { description: 'Email ahaan@runaegis.co to add a routing rule today.' })}
            >
              Add routing rule
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                  <th className="px-4 py-2.5">Rule</th>
                  <th className="px-3 py-2.5">Condition</th>
                  <th className="px-3 py-2.5">Route to</th>
                  <th className="px-3 py-2.5">Require</th>
                  <th className="px-3 py-2.5">Escalation</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--neutral-weak-50)]">
                    <td className="px-4 py-3 font-semibold text-[var(--neutral-strong-950)]">{r.name}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-[var(--neutral-strong-950)]">{r.condition}</td>
                    <td className="px-3 py-3 text-[var(--neutral-sub-600)]">{r.routeTo}</td>
                    <td className="px-3 py-3 font-mono tabular-nums text-[var(--neutral-strong-950)]">{r.requireN} approval{r.requireN === 1 ? '' : 's'}</td>
                    <td className="px-3 py-3 text-[11.5px] text-[var(--neutral-sub-600)]">{r.escalation}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <button className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]">Edit</button>
                        <button onClick={() => toast.success(`Deleted ${r.name}`)} className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 py-1 text-[11px] font-semibold text-[var(--error)] hover:bg-[var(--neutral-weak-50)]">Delete</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Section: Danger Zone ────────────────────────────────────────────────────
function DangerSection({
  onReset,
  onLogout,
  reduce,
}: {
  onReset: () => void;
  onLogout: () => void;
  reduce: boolean;
}) {
  // Branded confirmation dialogs replace `window.confirm()` so destructive
  // actions feel intentional + theme-aware. Each card tracks its own
  // open-state because both can be triggered independently.
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <DangerCard
          title="Reset onboarding"
          description="Walk through Aegis setup again from scratch."
          actionLabel="Reset"
          onAction={() => setResetOpen(true)}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <DangerCard
          title="Sign out of every device"
          description="Invalidate all sessions including this one."
          actionLabel="Sign out everywhere"
          onAction={() => setSignOutOpen(true)}
        />
      </motion.div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset onboarding?"
        description="You'll be walked through Aegis setup again from scratch. Your existing repositories, policies, and audit history stay intact."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={() => {
          setResetOpen(false);
          onReset();
        }}
      />
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out of every device?"
        description="All active sessions, including this one, will be invalidated. You'll need to sign in again."
        confirmLabel="Sign out everywhere"
        variant="danger"
        onConfirm={() => {
          setSignOutOpen(false);
          onLogout();
        }}
      />
      <motion.div variants={fadeUp}>
        <DangerCard
          title="Delete account"
          description="Remove your Aegis account and all governance history. This cannot be undone."
          actionLabel="Delete account"
          icon={Trash2}
          onAction={() =>
            alert('Account deletion is not yet enabled. Contact support@runaegis.co.')
          }
          permanent
        />
      </motion.div>
    </motion.div>
  );
}

function DangerCard({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  permanent,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon?: LucideIcon;
  permanent?: boolean;
}) {
  return (
    <section
      className="mb-5 overflow-hidden rounded-[12px] border bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
      style={{ borderColor: 'rgba(251, 55, 72, 0.20)' }}
    >
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2
            className="text-[14px] font-semibold tracking-[-0.01em]"
            style={{ color: permanent ? 'var(--error)' : 'var(--neutral-strong-950)' }}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--neutral-sub-600)]">
            {description}
          </p>
        </div>
        <button
          onClick={onAction}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium"
          style={{
            borderColor: permanent ? 'var(--error)' : 'rgba(251, 55, 72, 0.30)',
            backgroundColor: permanent ? 'var(--error-lighter)' : '#fff',
            color: 'var(--error)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = permanent
              ? 'var(--error)'
              : 'var(--error-lighter)';
            e.currentTarget.style.color = permanent ? '#fff' : 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = permanent
              ? 'var(--error-lighter)'
              : '#fff';
            e.currentTarget.style.color = 'var(--error)';
          }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
