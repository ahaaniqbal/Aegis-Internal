'use client';

/**
 * Tools tab — per-role tool policy matrix, redesigned.
 *
 * The old version dumped 20+ tools across 4 groups into one giant
 * matrix with allow/deny button pairs and ambiguous save semantics.
 * Hard to scan, even harder to start from scratch.
 *
 * The redesign anchors on three ideas:
 *
 *   1. Templates first. Most teams want one of three things:
 *      Read-only / Safe write / Full access. We expose them as
 *      cards at the top — one click prefills the policy for the
 *      active role and the user can tweak from there.
 *
 *   2. One toggle per tool. Switches (not button pairs) match the
 *      AlignUI vocabulary we use for every other boolean control.
 *
 *   3. Explicit Save. Security config should never auto-save —
 *      reviewers need a deliberate commit moment. A "N unsaved
 *      changes · Save" counter floats at the bottom of the page
 *      until the user commits.
 *
 * Backend contract is unchanged: `api.getRoomTools(roomId, role)`
 * fetches a `Record<string, boolean>`, `api.updateRoomTools(...)`
 * writes a `Record<string, boolean>`. Templates are pure frontend
 * — they just pre-fill the in-memory state, the eventual save call
 * is identical to manually toggling each tool.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Lock, RotateCcw, Save, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { markSetupStepDone } from '@/components/ui/SetupChecklist';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoom } from '@/lib/roomContext';
import { cn } from '@/lib/utils';
import { fadeUp, staggerContainer } from '@/lib/motion';

// Tool registry — same shape as the old page; lifted into a const
// so we don't redeclare on every render. Order within groups matters
// for UI scan rhythm: most-common first.
const TOOL_GROUPS: Record<string, string[]> = {
  Repository: [
    'get_file_contents',
    'create_or_update_file',
    'create_repository',
    'fork_repository',
    'push_files',
    'search_repositories',
  ],

  'Issues & PR': [
    'get_issue',
    'list_issues',
    'create_issue',
    'update_issue',
    'add_issue_comment',

    'get_pull_request',
    'list_pull_requests',
    'create_pull_request',
    'create_pull_request_review',
    'merge_pull_request',

    'get_pull_request_comments',
    'get_pull_request_reviews',
    'get_pull_request_files',
    'get_pull_request_status',

    'update_pull_request_branch',
  ],

  Search: [
    'search_code',
    'search_issues',
    'search_users',
  ],

  Git: [
    'create_branch',
    'list_commits',
  ],
};

const READ_ONLY_TOOLS = new Set([
  'get_file_contents',
  'get_issue',
  'get_pull_request',
  'get_pull_request_comments',
  'get_pull_request_files',
  'get_pull_request_reviews',
  'get_pull_request_status',
  'list_commits',
  'list_issues',
  'list_pull_requests',
  'search_code',
  'search_issues',
  'search_repositories',
  'search_users',
]);
const ALL_TOOLS = Object.values(TOOL_GROUPS).flat();

const ROLE_LEVELS: Record<string, number> = {
  DEVELOPER: 1,
  ADMIN: 2,
  OWNER: 3,
};

// Templates — sensible starting points for the most common policy
// shapes. Each maps tool → boolean; missing tools default to false.
const TEMPLATES: Record<
  'read-only' | 'safe-write' | 'full',
  {
    title: string;
    description: string;
    tools: Record<string, boolean>;
  }
> = {
  'read-only': {
    title: 'Read-only',
    description: 'Agents can list, fetch, and search. No writes.',
    tools: Object.fromEntries(
      ALL_TOOLS.map((t) => [
        t,
        READ_ONLY_TOOLS.has(t),
      ]),
    ),
  },
  'safe-write': {
    title: 'Safe write',
    description: 'Adds branches, issues, and PRs. No direct pushes to main.',
    tools: Object.fromEntries(
      ALL_TOOLS.map((t) => [t, t !== 'push_files']),
    ),
  },
  full: {
    title: 'Full access',
    description: 'Every tool enabled. Use for trusted internal agents.',
    tools: Object.fromEntries(ALL_TOOLS.map((t) => [t, true])),
  },
};

export default function RoomToolsPage() {
  const { roomId, role: myRole, loading: roomLoading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  // Roles the current user can VIEW. OWNER sees everything; ADMIN
  // can see ADMIN + DEVELOPER; DEVELOPER only their own role.
  const visibleRoles = useMemo(() => {
    if (myRole === 'OWNER') return ['OWNER', 'ADMIN', 'DEVELOPER'];
    if (myRole === 'ADMIN') return ['ADMIN', 'DEVELOPER'];
    return ['DEVELOPER'];
  }, [myRole]);

  const [viewingRole, setViewingRole] = useState<string>('DEVELOPER');
  const [serverTools, setServerTools] = useState<Record<string, boolean>>({});
  const [draftTools, setDraftTools] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Pending role-switch — when the user clicks a different role tab
  // while there are unsaved changes, we stash the destination here
  // and surface a confirm dialog. Null when nothing pending.
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  // Track which group accordions are expanded. Default: only first
  // group expanded so the page doesn't open as a wall of switches.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const groups = Object.keys(TOOL_GROUPS);
    groups.forEach((g, i) => {
      initial[g] = i === 0;
    });
    return initial;
  });

  // Permission to edit the viewed role — must outrank or equal.
  const canEdit = useMemo(
    () => ROLE_LEVELS[myRole] >= ROLE_LEVELS[viewingRole],
    [myRole, viewingRole],
  );

  // Fetch tools whenever the viewing role changes.
  const loadTools = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const fetched = await api.getRoomTools(roomId, viewingRole);
      setServerTools(fetched);
      setDraftTools(fetched);
    } catch (err) {
      toast.error("Couldn't load tool policies", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, viewingRole, toast]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  // Diff between draft and server — drives the "N unsaved changes"
  // counter + the Save button's enabled state.
  const dirtyKeys = useMemo(() => {
    return ALL_TOOLS.filter((t) => !!draftTools[t] !== !!serverTools[t]);
  }, [draftTools, serverTools]);
  const dirty = dirtyKeys.length > 0;

  // beforeunload guard — security config that disappears silently is
  // an incident the user blames on us. Browsers ignore custom strings
  // now (chrome 119+), but setting returnValue still triggers the
  // generic "leave site?" prompt.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Role-switch entry point — call this from the role pill buttons.
  // If dirty, show confirm dialog. Otherwise switch immediately.
  const requestRoleSwitch = (nextRole: string) => {
    if (nextRole === viewingRole) return;
    if (dirty) {
      setPendingRole(nextRole);
      return;
    }
    setViewingRole(nextRole);
  };

  const discardAndSwitch = () => {
    if (!pendingRole) return;
    setDraftTools(serverTools);
    setViewingRole(pendingRole);
    setPendingRole(null);
  };

  const enabledCount = ALL_TOOLS.filter((t) => !!draftTools[t]).length;

  const toggleTool = (tool: string, next: boolean) => {
    setDraftTools((prev) => ({ ...prev, [tool]: next }));
  };

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    // Merge the template values over a fresh-allows-false baseline
    // so previously-allowed tools that aren't in the template are
    // explicitly turned off (rather than left in their current state).
    const base: Record<string, boolean> = {};
    ALL_TOOLS.forEach((t) => {
      base[t] = false;
    });
    setDraftTools({ ...base, ...TEMPLATES[key].tools });
  };

  const resetDraft = () => setDraftTools(serverTools);

  const save = async () => {
    if (!canEdit || !dirty) return;
    setSaving(true);
    try {
      await api.updateRoomTools(roomId, viewingRole, draftTools);
      setServerTools(draftTools);
      // Mark the setup-checklist Tools step as done. Has no effect
      // for users whose checklist is already dismissed — purely
      // additive signal for new-room onboarding.
      markSetupStepDone(roomId, 'tools');
      toast.success('Tool policies updated', {
        description: `${dirtyKeys.length} change${
          dirtyKeys.length === 1 ? '' : 's'
        } saved for ${viewingRole}.`,
      });
    } catch (err) {
      toast.error('Save failed', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (roomLoading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[120px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        {/* Section header + role switcher */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
              Tool policies
            </h2>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              Pick which agent tools each role can use in this room.
              {' '}
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {enabledCount}
              </span>
              {' '}of {ALL_TOOLS.length} tools enabled for {viewingRole}.
            </p>
          </div>
          {/* Role switcher — segmented pill. Only renders visible
              roles based on the current user's permission level. */}
          <div className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5 shadow-[var(--shadow-regular-xs)]">
            {visibleRoles.map((r) => {
              const active = r === viewingRole;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => requestRoleSwitch(r)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-[6px] px-2.5 text-[11.5px] font-semibold tracking-[-0.005em]',
                    'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    active
                      ? 'bg-white text-[var(--neutral-strong-950)] shadow-[var(--shadow-regular-xs)]'
                      : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Read-only state — viewer outranked by the role they're viewing */}
        {!canEdit && (
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2 text-[12px] text-[var(--neutral-sub-600)]"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            <span>
              You&apos;re viewing the {viewingRole} policy in read-only mode.
              Only ADMIN and OWNER roles can edit it.
            </span>
          </motion.div>
        )}

        {/* Template cards */}
        <motion.div variants={fadeUp}>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            Start from a template
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <TemplateCard
              icon={<Shield className="h-4 w-4" strokeWidth={2} />}
              title={TEMPLATES['read-only'].title}
              description={TEMPLATES['read-only'].description}
              count={Object.values(TEMPLATES['read-only'].tools).filter(Boolean).length}
              total={ALL_TOOLS.length}
              disabled={!canEdit}
              onClick={() => applyTemplate('read-only')}
            />
            <TemplateCard
              icon={<Shield className="h-4 w-4" strokeWidth={2} />}
              title={TEMPLATES['safe-write'].title}
              description={TEMPLATES['safe-write'].description}
              count={Object.values(TEMPLATES['safe-write'].tools).filter(Boolean).length}
              total={ALL_TOOLS.length}
              disabled={!canEdit}
              onClick={() => applyTemplate('safe-write')}
              recommended
            />
            <TemplateCard
              icon={<Shield className="h-4 w-4" strokeWidth={2} />}
              title={TEMPLATES['full'].title}
              description={TEMPLATES['full'].description}
              count={Object.values(TEMPLATES['full'].tools).filter(Boolean).length}
              total={ALL_TOOLS.length}
              disabled={!canEdit}
              onClick={() => applyTemplate('full')}
            />
          </div>
        </motion.div>

        {/* Tool groups — each is collapsible. Per-tool switches. */}
        <motion.div variants={fadeUp} className="space-y-3">
          {Object.entries(TOOL_GROUPS).map(([group, toolList]) => {
            const open = !!openGroups[group];
            const enabled = toolList.filter((t) => !!draftTools[t]).length;
            return (
              <div
                key={group}
                className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group]: !open }))
                  }
                  className="flex w-full items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3.5 text-left transition-colors hover:bg-[var(--neutral-weak-50)]"
                  style={open ? undefined : { borderBottomWidth: 0 }}
                >
                  <div className="flex items-center gap-2.5">
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)] transition-transform',
                        open ? 'rotate-0' : '-rotate-90',
                      )}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                      {group}
                    </h3>
                  </div>
                  <Badge tone={enabled > 0 ? 'primary' : 'neutral'} className="text-[10.5px]">
                    {enabled} / {toolList.length}
                  </Badge>
                </button>
                {open && (
                  <ul className="divide-y divide-[var(--stroke-soft-200)]">
                    {toolList.map((tool) => {
                      const allowed = !!draftTools[tool];
                      const wasAllowed = !!serverTools[tool];
                      const isChanged = allowed !== wasAllowed;
                      return (
                        <li
                          key={tool}
                          className="flex items-center justify-between gap-3 px-5 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <code className="truncate text-[12px] text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                              {tool}
                            </code>
                            {isChanged && (
                              <span
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary-base)]"
                                aria-label="Unsaved change"
                                title="Unsaved change"
                              />
                            )}
                          </div>
                          <Switch
                            checked={allowed}
                            onChange={(v) => toggleTool(tool, v)}
                            disabled={!canEdit || saving || loading}
                            aria-label={`${
                              allowed ? 'Disable' : 'Enable'
                            } ${tool}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Unsaved-changes guard — fires when the user clicks a
          different role pill while there are local edits. Prior
          behavior was a silent reset on role switch, which is
          exactly the kind of data-loss our audience (security teams)
          will never forgive us for. Two paths: "Discard" rolls
          back, "Stay" cancels. */}
      <ConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
        title="Discard unsaved changes?"
        description={
          <>
            You have{' '}
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              {dirtyKeys.length}
            </span>{' '}
            unsaved policy{' '}
            {dirtyKeys.length === 1 ? 'change' : 'changes'} for{' '}
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              {viewingRole}
            </span>
            . Switching to{' '}
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              {pendingRole}
            </span>{' '}
            will discard them.
          </>
        }
        confirmLabel="Discard & switch"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={discardAndSwitch}
      />

      {/* Floating save bar — pinned to bottom-center, appears when
          there are unsaved changes. Same shape as BulkActionBar so
          the visual language stays consistent. */}
      {dirty && canEdit && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2 shadow-[0_12px_32px_rgba(23,23,23,0.12),0_2px_8px_rgba(23,23,23,0.04)]">
            <span className="inline-flex h-6 items-center rounded-[6px] bg-[var(--primary-alpha-10)] px-2 text-[11.5px] font-semibold text-[var(--primary-base)]">
              {dirtyKeys.length} unsaved
            </span>
            <span className="h-5 w-px shrink-0 bg-[var(--stroke-soft-200)]" aria-hidden />
            <Button
              size="sm"
              variant="secondary"
              onClick={resetDraft}
              disabled={saving}
              leadingIcon={<RotateCcw className="h-3 w-3" strokeWidth={2} />}
            >
              Reset
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              disabled={saving}
              leadingIcon={
                saving ? null : <Save className="h-3 w-3" strokeWidth={2.25} />
              }
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Template card ──────────────────────────────────────────────────
function TemplateCard({
  icon,
  title,
  description,
  count,
  total,
  recommended,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  total: number;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex flex-col items-start gap-2 rounded-[12px] border bg-white p-4 text-left',
        'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        recommended
          ? 'border-[var(--primary-base)]/30 hover:border-[var(--primary-base)]/60 hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]'
          : 'border-[var(--stroke-soft-200)] hover:border-[var(--stroke-sub-300)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]',
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[7px]',
            recommended
              ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
              : 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]',
          )}
        >
          {icon}
        </span>
        {recommended && (
          <span className="rounded-[4px] bg-[var(--primary-base)]/12 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--primary-base)]">
            Recommended
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {description}
        </p>
        <p className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
          {count} of {total} tools
        </p>
      </div>
    </button>
  );
}
