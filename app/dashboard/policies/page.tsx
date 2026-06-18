'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  FileCode,
  GitBranch,
  Lock,
  Mail,
  Scale,
  Shield,
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

type PolicyDef = {
  key: string;
  name: string;
  decision: string;
  description: string;
  icon: LucideIcon;
  /** Tonal category for the side chip. */
  category: 'governance' | 'safety' | 'compliance' | 'access';
};

const policies: PolicyDef[] = [
  { key: 'protected_branch_denial', name: 'Protected Branch Denial', decision: 'REWRITE',          description: 'Direct writes to main, master, and release branches are redirected to a safe PR workflow.', icon: GitBranch,     category: 'governance' },
  { key: 'freeze_window_enforcement', name: 'Freeze Window Enforcement', decision: 'DENY',          description: 'Write actions during release freeze windows are blocked.',                                  icon: Clock,         category: 'governance' },
  { key: 'aegis_branch_naming',      name: 'Aegis Branch Naming',       decision: 'DENY',          description: 'All agent-created branches must follow the aegis/{session_id}/{task} convention.',          icon: FileCode,      category: 'governance' },
  { key: 'mandatory_pr_flow',        name: 'Mandatory PR Flow',         decision: 'REQUIRE_APPROVAL', description: 'Every agent write action must result in a pull request.',                                 icon: Eye,           category: 'governance' },
  { key: 'no_autonomous_merge',      name: 'No Autonomous Merge',       decision: 'DENY',          description: 'Agents cannot merge pull requests without approval.',                                       icon: Lock,          category: 'safety' },
  { key: 'ci_required_before_merge', name: 'CI Required Before Merge',  decision: 'DENY',          description: 'Merge attempts are blocked if CI checks have not passed.',                                  icon: Zap,           category: 'safety' },
  { key: 'repo_allowlist',           name: 'Repo Allowlist',            decision: 'DENY',          description: 'Agents can only write to approved repositories.',                                            icon: Shield,        category: 'access' },
  { key: 'sensitive_path_approval',  name: 'Sensitive Path Approval',   decision: 'REQUIRE_APPROVAL', description: 'Changes to CI/CD, infrastructure, and auth paths require approval.',                     icon: AlertTriangle, category: 'safety' },
  { key: 'secret_detection',         name: 'Secret Detection',          decision: 'DENY',          description: 'Every diff is scanned for API keys, tokens, and credentials.',                               icon: Lock,          category: 'compliance' },
  { key: 'blast_radius_gate',        name: 'Blast Radius Gate',         decision: 'REQUIRE_APPROVAL', description: 'Large source changes require approval.',                                                  icon: Scale,         category: 'safety' },
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

        <motion.div
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
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
                    <p className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
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
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: 'var(--primary-lighter)' }}
            >
              <Mail className="h-4 w-4" style={{ color: 'var(--primary-base)' }} strokeWidth={2} />
            </div>
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
