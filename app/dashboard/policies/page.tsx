'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Clock,
  Database,
  Eye,
  FileCode,
  GitBranch,
  Hash,
  Lock,
  Mail,
  MessageSquare,
  Server,
  Scale,
  Shield,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import DecisionBadge from '@/components/ui/DecisionBadge';
import { ConnectorIcon, type ConnectorId } from '@/components/ui/ConnectorMark';
import { IconMark } from '@/components/ui/IconMark';

type PolicyDef = {
  key: string;
  name: string;
  decision: string;
  description: string;
  icon: LucideIcon;
  /** Tonal category for the side chip. */
  category: 'governance' | 'safety' | 'compliance' | 'access';
  /** Which connector this policy targets. Drives the small brand mark
   *  on the row. When omitted, the policy is global (applies across
   *  every connector). */
  connector?: ConnectorId;
};

const policies: PolicyDef[] = [
  // ── GitHub-scoped (the original 10) ────────────────────────────────
  { key: 'protected_branch_denial', name: 'Protected Branch Denial', decision: 'REWRITE',          description: 'Direct writes to main, master, and release branches are redirected to a safe PR workflow.', icon: GitBranch,     category: 'governance', connector: 'github' },
  { key: 'freeze_window_enforcement', name: 'Freeze Window Enforcement', decision: 'DENY',          description: 'Write actions during release freeze windows are blocked.',                                  icon: Clock,         category: 'governance' },
  { key: 'aegis_branch_naming',      name: 'Aegis Branch Naming',       decision: 'DENY',          description: 'All agent-created branches must follow the aegis/{session_id}/{task} convention.',          icon: FileCode,      category: 'governance', connector: 'github' },
  { key: 'mandatory_pr_flow',        name: 'Mandatory PR Flow',         decision: 'REQUIRE_APPROVAL', description: 'Every agent write action must result in a pull request.',                                 icon: Eye,           category: 'governance', connector: 'github' },
  { key: 'no_autonomous_merge',      name: 'No Autonomous Merge',       decision: 'DENY',          description: 'Agents cannot merge pull requests without approval.',                                       icon: Lock,          category: 'safety',     connector: 'github' },
  { key: 'ci_required_before_merge', name: 'CI Required Before Merge',  decision: 'DENY',          description: 'Merge attempts are blocked if CI checks have not passed.',                                  icon: Zap,           category: 'safety',     connector: 'github' },
  { key: 'repo_allowlist',           name: 'Repo Allowlist',            decision: 'DENY',          description: 'Agents can only write to approved repositories.',                                            icon: Shield,        category: 'access',     connector: 'github' },
  { key: 'sensitive_path_approval',  name: 'Sensitive Path Approval',   decision: 'REQUIRE_APPROVAL', description: 'Changes to CI/CD, infrastructure, and auth paths require approval.',                     icon: AlertTriangle, category: 'safety',     connector: 'github' },
  { key: 'secret_detection',         name: 'Secret Detection',          decision: 'DENY',          description: 'Every diff is scanned for API keys, tokens, and credentials.',                               icon: Lock,          category: 'compliance', connector: 'github' },
  { key: 'blast_radius_gate',        name: 'Blast Radius Gate',         decision: 'REQUIRE_APPROVAL', description: 'Large source changes require approval.',                                                  icon: Scale,         category: 'safety' },

  // ── Slack-scoped ───────────────────────────────────────────────────
  { key: 'slack_no_external_dm',     name: 'No External DMs',           decision: 'DENY',             description: 'Agents cannot DM users outside the connected workspace.',                                  icon: MessageSquare, category: 'access',     connector: 'slack' },
  { key: 'slack_channel_allowlist',  name: 'Channel Allowlist',         decision: 'DENY',             description: 'Agents can only post in pre-approved channels (#engineering, #releases, #incident).',     icon: Hash,          category: 'access',     connector: 'slack' },
  { key: 'slack_no_destructive',     name: 'No Destructive Slack',      decision: 'DENY',             description: 'Delete-message, archive-channel, and kick-user actions are blocked.',                       icon: Lock,          category: 'safety',     connector: 'slack' },

  // ── Linear-scoped ──────────────────────────────────────────────────
  { key: 'linear_no_p0_autoclose',   name: 'No Auto-close P0',          decision: 'REQUIRE_APPROVAL', description: 'Closing or archiving P0/P1 issues requires human approval.',                                icon: AlertTriangle, category: 'governance', connector: 'linear' },
  { key: 'linear_no_mass_reassign',  name: 'No Mass Reassignment',      decision: 'REQUIRE_APPROVAL', description: 'Reassigning more than 5 issues in one session requires approval.',                          icon: Eye,           category: 'safety',     connector: 'linear' },

  // ── Postgres-scoped ────────────────────────────────────────────────
  { key: 'postgres_no_drop_prod',    name: 'No DROP on Production',     decision: 'DENY',             description: 'DROP TABLE, DROP INDEX, and DROP DATABASE on production are hard-denied.',                  icon: Database,      category: 'safety',     connector: 'postgres' },
  { key: 'postgres_delete_with_where', name: 'DELETE Requires WHERE',   decision: 'DENY',             description: 'DELETE statements without a WHERE clause are blocked outright.',                            icon: AlertTriangle, category: 'safety',     connector: 'postgres' },
  { key: 'postgres_migration_gate',  name: 'P12 Migration Gate',        decision: 'REQUIRE_APPROVAL', description: 'Migrations without an accompanying rollback script are routed to approval.',                 icon: FileCode,      category: 'compliance', connector: 'postgres' },

  // ── Terraform-scoped ───────────────────────────────────────────────
  { key: 'terraform_no_destroy_prod',name: 'No `destroy` in Production',decision: 'DENY',             description: 'terraform destroy and state-mutating ops on the production workspace are hard-denied.',     icon: Server,        category: 'safety',     connector: 'terraform' },
  { key: 'terraform_apply_approval', name: 'Apply Requires Approval',   decision: 'REQUIRE_APPROVAL', description: 'terraform apply on any workspace must be approved by an OWNER or ADMIN.',                  icon: Eye,           category: 'governance', connector: 'terraform' },

  // ── GitHub Actions ─────────────────────────────────────────────────
  { key: 'gha_no_prod_dispatch',     name: 'No Production Dispatch',    decision: 'REQUIRE_APPROVAL', description: 'Dispatching the deploy-prod workflow requires explicit human approval.',                    icon: Workflow,      category: 'governance', connector: 'github-actions' },
  { key: 'gha_secret_rotation_gate', name: 'Secret Rotation Gate',      decision: 'REQUIRE_APPROVAL', description: 'Creating, updating, or deleting workflow secrets routes to approval.',                       icon: Lock,          category: 'compliance', connector: 'github-actions' },
];

const decodePolicyString = (s: string): Record<string, boolean> => {
  const bits = s.replace(/[^01]/g, '');
  return Object.fromEntries(
    policies.map((p, i) => [p.key, bits[i] === '1']),
  ) as Record<string, boolean>;
};

const encodePolicyString = (active: Record<string, boolean>): string =>
  policies.map((p) => (active[p.key] ? '1' : '0')).join('');

const categoryTone: Record<PolicyDef['category'], 'feature' | 'info' | 'warning' | 'success'> = {
  governance: 'info',
  safety:     'warning',
  compliance: 'feature',
  access:     'success',
};

export default function PoliciesPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();

  const defaultPolicyState = useMemo(
    () =>
      Object.fromEntries(policies.map((p) => [p.key, true])) as Record<
        string,
        boolean
      >,
    [],
  );

  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(
    defaultPolicyState,
  );
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Load + save error state — surfaced via ErrorBanner (load) and
  // toast (save). Previously both error paths silently console.error'd
  // and the user had no idea anything failed.
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const togglePolicy = (key: string) =>
    setActiveStates((prev) => ({ ...prev, [key]: !prev[key] }));

  const activeCount = Object.values(activeStates).filter(Boolean).length;

  useEffect(() => {
    const userId = user?.id;
    if (!userId || userLoading) return;
    let isMounted = true;

    const loadPolicies = async () => {
      try {
        const stored = await api.getUserPolicy(userId);
        if (!isMounted) return;
        setActiveStates({
          ...defaultPolicyState,
          ...(stored ? decodePolicyString(stored) : {}),
        });
        setError(null);
      } catch (err) {
        console.error('Failed to load user policies', err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load your policy configuration.',
          );
        }
      }
    };

    loadPolicies();
    return () => {
      isMounted = false;
    };
  }, [user?.id, userLoading, defaultPolicyState]);

  const handleSave = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await api.upsertUserPolicy(user.id, encodePolicyString(activeStates));
      setSaveSuccess(true);
      toast.success('Policies updated', {
        description: 'Your changes apply to every new agent action.',
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed', err);
      toast.error('Save failed', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not save policy changes. Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Policies" subtitle="Rules that evaluate every agent action" />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        <motion.header
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <div>
            <motion.p
              variants={fadeUp}
              className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
            >
              Governance
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
            >
              Policies that evaluate every action
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
            >
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {activeCount}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {policies.length}
              </span>{' '}
              policies active.
            </motion.p>
          </div>
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            {saveSuccess && (
              <span
                className="inline-flex items-center gap-1 text-[12.5px] font-medium"
                style={{ color: 'var(--success)' }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                Saved
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={loading || userLoading || !user?.id}
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </motion.div>
        </motion.header>

        {/* ─── Policy packs ─────────────────────────────────────────────
            Curated bundles that activate a set of policies in one click.
            Each pack is a compliance / industry recipe: HIPAA enables
            healthcare-relevant rules, SOC 2 enables the change-management
            + access controls auditors expect, Fintech bundles the
            money-mover rules. Pack toggles set the same `activeStates`
            map the individual switches drive, so the rest of the
            page stays the source of truth. */}
        <PolicyPacksSection
          activeStates={activeStates}
          onApplyPack={(packKeys) => {
            setActiveStates((prev) => {
              const next = { ...prev };
              for (const k of packKeys) next[k] = true;
              return next;
            });
            toast.push('Policy pack applied', {
              description: `${packKeys.length} policies activated.`,
              variant: 'success',
            });
          }}
          reduce={!!reduce}
        />

        <motion.div
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
        >
          {/* Horizontal scroll below lg so the 5-column policy grid stays
              usable on mobile/tablet without forcing the page to scroll. */}
          <div className="overflow-x-auto lg:overflow-x-visible">
          <div className="min-w-[680px] lg:min-w-0">
          <div className="grid grid-cols-[44px_1fr_140px_120px_64px] items-center gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-6 py-3 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
            <span />
            <span>Policy</span>
            <span>Category</span>
            <span>Effect</span>
            <span className="text-right">Active</span>
          </div>

          <motion.ul
            className="divide-y divide-[var(--stroke-soft-200)]"
            variants={staggerContainer(0.025, 0.22)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {policies.map((policy) => {
              const Icon = policy.icon;
              const isActive = activeStates[policy.key];
              return (
                <motion.li
                  key={policy.key}
                  variants={fadeUpSm}
                  /* hover bg uses primary-lighter (warm orange tint),
                     matching the shared <Table> TR hover. Previously
                     was --neutral-weak-50, which is nearly identical
                     to the page bg in light mode — hover read as
                     "almost nothing happening." */
                  className={`grid grid-cols-[44px_1fr_140px_120px_64px] items-center gap-3 px-6 py-4 transition-colors hover:bg-[var(--primary-lighter)]/50 ${
                    isActive ? '' : 'opacity-60'
                  }`}
                >
                  {/* Concentric-ring icon — scaled-down echo of the
                      EmptyState illustration pattern the user called
                      out. Outer ring sits at 44px (matches the grid
                      column), inner white circle at 32px carries the
                      orange outline icon. Single ring instead of
                      EmptyState's three so the row stays dense
                      enough for a 10-item list. */}
                  <div
                    className="relative flex h-11 w-11 items-center justify-center"
                    aria-hidden
                  >
                    <div className="absolute h-11 w-11 rounded-full border border-[var(--stroke-soft-200)]" />
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--primary-base)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                      {/* Connector mark in front of name when the
                          policy is scoped to a specific tool. Reads
                          as "this rule governs the Slack surface"
                          before you parse the policy name. */}
                      {policy.connector && (
                        <ConnectorIcon id={policy.connector} size={14} />
                      )}
                      {policy.name}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {policy.description}
                    </p>
                  </div>
                  <div>
                    <Badge tone={categoryTone[policy.category]} uppercase>
                      {policy.category}
                    </Badge>
                  </div>
                  <div>
                    <DecisionBadge decision={policy.decision} />
                  </div>
                  <div className="flex justify-end">
                    <Switch
                      checked={isActive}
                      onChange={() => togglePolicy(policy.key)}
                      ariaLabel={`Toggle ${policy.name}`}
                    />
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
          </div>
          </div>
        </motion.div>

        {/* Custom policy footer */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.4 }}
        >
          <div className="flex items-center gap-3">
            {/* Canonical IconMark — brand-orange Mail inside the
                concentric ring sticker. Matches PolicyPack cards so
                the whole Policies page reads as one icon family. */}
            <IconMark icon={Mail} />
            <div>
              <h3 className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                Need a custom policy?
              </h3>
              <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                Contact us to tailor policies to your organization.
              </p>
            </div>
          </div>
          <a href="mailto:deals@runaegis.co">
            <Button variant="primary">Contact Sales</Button>
          </a>
        </motion.div>
      </div>
    </>
  );
}

// ─── Policy packs ─────────────────────────────────────────────────────────
//
// A "pack" is a named bundle of policy keys that, when applied, activates
// all of those policies at once. We ship three reference packs out of
// the box:
//
//   • HIPAA — healthcare-grade rules: secret detection, sensitive path
//     approval, freeze enforcement, no-autonomous-merge, DB destructive
//     denies, audit-grade approvals.
//   • SOC 2 — change-management + access controls auditors expect:
//     mandatory PR flow, CI required, repo allowlist, blast-radius gate,
//     protected branches.
//   • Fintech — money-mover bundle: every write requires approval,
//     hard deny on prod DB destructive ops, scoped Slack channel access,
//     no production Terraform destroy.
//
// Each pack lists policy KEYS (matching the `policies` array's keys).
// Applying a pack flips those keys true in `activeStates`. Future:
// customers will be able to publish their own packs.

interface PolicyPack {
  key: string;
  name: string;
  description: string;
  badge: string;
  tone: 'feature' | 'info' | 'warning' | 'success';
  policyKeys: string[];
  icon: LucideIcon;
}

const POLICY_PACKS: PolicyPack[] = [
  {
    key: 'hipaa',
    name: 'HIPAA',
    description:
      'Healthcare-grade bundle. Secret scanning, sensitive-path approval, P12 migration gate, freeze enforcement, all destructive DB + infra ops hard-denied.',
    badge: 'Healthcare',
    tone: 'feature',
    icon: Shield,
    policyKeys: [
      'secret_detection',
      'sensitive_path_approval',
      'freeze_window_enforcement',
      'no_autonomous_merge',
      'mandatory_pr_flow',
      'postgres_no_drop_prod',
      'postgres_delete_with_where',
      'postgres_migration_gate',
      'terraform_no_destroy_prod',
      'slack_no_destructive',
      'gha_secret_rotation_gate',
    ],
  },
  {
    key: 'soc2',
    name: 'SOC 2',
    description:
      'Type 1 / Type 2 ready bundle. Change-management + access controls auditors expect. Mandatory PR flow, CI required, repo allowlist, blast-radius gate, protected branches.',
    badge: 'Compliance',
    tone: 'info',
    icon: FileCode,
    policyKeys: [
      'mandatory_pr_flow',
      'ci_required_before_merge',
      'protected_branch_denial',
      'no_autonomous_merge',
      'aegis_branch_naming',
      'sensitive_path_approval',
      'repo_allowlist',
      'blast_radius_gate',
      'gha_no_prod_dispatch',
      'gha_secret_rotation_gate',
      'linear_no_p0_autoclose',
    ],
  },
  {
    key: 'fintech',
    name: 'Fintech',
    description:
      'Money-mover bundle. Every write needs human approval, prod-DB destructive ops hard-denied, Terraform destroy locked, Slack channel allowlist enforced.',
    badge: 'Financial services',
    tone: 'warning',
    icon: Lock,
    policyKeys: [
      'mandatory_pr_flow',
      'no_autonomous_merge',
      'sensitive_path_approval',
      'protected_branch_denial',
      'secret_detection',
      'postgres_no_drop_prod',
      'postgres_delete_with_where',
      'terraform_no_destroy_prod',
      'terraform_apply_approval',
      'gha_no_prod_dispatch',
      'slack_channel_allowlist',
      'slack_no_destructive',
      'freeze_window_enforcement',
    ],
  },
];

function PolicyPacksSection({
  activeStates,
  onApplyPack,
  reduce,
}: {
  activeStates: Record<string, boolean>;
  onApplyPack: (policyKeys: string[]) => void;
  reduce: boolean;
}) {
  return (
    <motion.section
      className="mb-6"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.14 }}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
            Policy packs
          </p>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            Pre-built compliance bundles
          </h2>
        </div>
        <p className="hidden text-[11.5px] text-[var(--neutral-soft-400)] sm:block">
          Each pack activates a curated set of policies in one click. Tune individual rules below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {POLICY_PACKS.map((pack) => {
          const Icon = pack.icon;
          const allActive = pack.policyKeys.every((k) => activeStates[k]);
          const activeCount = pack.policyKeys.filter((k) => activeStates[k]).length;
          const pct = pack.policyKeys.length === 0
            ? 0
            : Math.round((activeCount / pack.policyKeys.length) * 100);
          return (
            <motion.div
              key={pack.key}
              // Lift via Framer Motion (GPU-composited translate3d) so
              // the hover doesn't subpixel-jank against the inset
              // orange→white gradient + radial corner glow. Same
              // pattern as the Agents and Connectors cards. "Applied"
              // state skips the lift so it reads as locked-in rather
              // than interactive. Press feedback dips back to -1px
              // for tactile click confirmation.
              whileHover={
                allActive
                  ? undefined
                  : {
                      y: -3,
                      transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] },
                    }
              }
              whileTap={
                allActive
                  ? undefined
                  : {
                      y: -1,
                      transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
                    }
              }
              className={[
                'relative flex flex-col overflow-hidden rounded-[12px] border bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
                allActive
                  ? 'border-[var(--primary-base)]/35 ring-1 ring-[var(--primary-base)]/15'
                  : 'border-[var(--stroke-soft-200)] transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_12px_28px_rgba(23,23,23,0.07),0_2px_8px_rgba(250,115,25,0.06)]',
              ].join(' ')}
            >
              {/* Inset orange→white wash — same treatment as the
                  Decision Overview hero and the CIL callout, so every
                  hero-style card on the dashboard reads as one surface
                  family. Faded radial corner glow stacks on top when
                  the pack is fully applied so "this is active" still
                  reads at a glance. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-1 rounded-[8px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
                }}
              />
              {allActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, var(--primary-base) 0%, transparent 70%)',
                    opacity: 0.10,
                  }}
                />
              )}
              <div className="relative mb-3 flex items-center gap-2.5">
                {/* Canonical IconMark — brand-orange pack icon inside
                    the concentric ring sticker. */}
                <IconMark icon={Icon} />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                    {pack.name}
                  </h3>
                  <Badge tone={pack.tone} uppercase>
                    {pack.badge}
                  </Badge>
                </div>
              </div>
              <p className="relative flex-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                {pack.description}
              </p>
              {/* Progress + apply CTA pinned to the bottom. The thin
                  bar reads "this pack is N% configured" at a glance —
                  more glanceable than the plain numeric ratio. */}
              <div className="relative mt-4 pt-3 border-t border-[var(--stroke-soft-200)]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    {activeCount} of {pack.policyKeys.length} policies active
                  </span>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{
                      color: allActive
                        ? 'var(--primary-base)'
                        : 'var(--neutral-sub-600)',
                    }}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  aria-hidden
                  className="mb-3 h-[3px] w-full overflow-hidden rounded-full bg-[var(--neutral-weak-50)]"
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: allActive
                        ? 'var(--primary-base)'
                        : 'var(--neutral-soft-400)',
                    }}
                  />
                </div>
                <Button
                  variant={allActive ? 'secondary' : 'primary'}
                  onClick={() => onApplyPack(pack.policyKeys)}
                  disabled={allActive}
                  fullWidth
                >
                  {/* Button copy shows exactly what'll change. "Apply
                      pack" without context made a reviewer click before
                      knowing whether 1 or 12 policies would flip. Now
                      they read "Apply 8 more" and decide before
                      committing. */}
                  {allActive
                    ? 'Applied'
                    : activeCount === 0
                      ? `Apply ${pack.policyKeys.length} ${pack.policyKeys.length === 1 ? 'policy' : 'policies'}`
                      : `Apply ${pack.policyKeys.length - activeCount} more`}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
