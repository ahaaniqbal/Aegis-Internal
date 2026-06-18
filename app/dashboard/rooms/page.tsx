'use client';

/**
 * Rooms index — the rooms list page.
 *
 * Re-architected from the prior 878-line single-page god-component
 * into a focused index page. Each row in the list links to the
 * room's dedicated sub-page tree (Overview / Tools / Members /
 * Connect / Settings), where the heavy lifting happens.
 *
 * The page does three things:
 *   1. Lists every room the user is a member of, with quick-scan
 *      metadata (repo, role, last activity).
 *   2. Surfaces a primary "Create room" CTA pointed at the most
 *      common new-user path.
 *   3. Offers a secondary "Join with code" affordance for users
 *      arriving via an invite.
 *
 * Empty state teaches the mental model — what a room IS, what to
 * do next — rather than just saying "no rooms yet."
 *
 * Create + Join still live inline on this page (collapsed forms
 * that expand on click). The previous design surfaced both forms
 * at full size on every visit, which read as overwhelming. Here
 * the page leads with a clear primary CTA and reveals the form on
 * demand.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  DoorOpen,
  Lock,
  Plus,
  Search,
  Shield,
  Unlock,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import type { Repo, RoomSummary } from '@/lib/types';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { RoomsSkeleton } from '@/components/ui/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn, getRoomRoleBadgeTone } from '@/lib/utils';
import { fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

const getRoomId = (room: RoomSummary): string =>
  String(room.id || room.room_id || '');

export default function RoomsIndexPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline-expanding forms — collapsed by default so the page reads
  // calm. The Create form expands on the primary CTA click; the
  // Join form on the secondary "join with code" link.
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Repo picker state — populated the first time the Create form
  // opens. Free-text input was a footgun (typos → broken rooms);
  // a real picker constrained to the user's GitHub repos eliminates
  // the class of error.
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  const fetchRooms = useCallback(async () => {
    if (userLoading) return;
    if (!user) {
      setRooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getMyRooms();
      setRooms(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  const { lastUpdated } = useAutoRefresh(fetchRooms, 30000);

  // Fetch repos lazily — only when the user actually opens the
  // Create form. Avoids a needless GitHub API hit for every Rooms
  // page visit.
  const fetchRepos = useCallback(async () => {
    if (!user?.id) return;
    setReposLoading(true);
    setReposError(null);
    try {
      const response = await api.getRepos(user.id);
      setRepos(response?.repos || []);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : 'Could not load repos.');
    } finally {
      setReposLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (showCreate && repos.length === 0 && !reposLoading && !reposError) {
      void fetchRepos();
    }
  }, [showCreate, repos.length, reposLoading, reposError, fetchRepos]);

  // Filter repos: exclude ones already used by existing rooms (a
  // single repo can only back one room), apply the search query.
  const usedRepoNames = useMemo(
    () => new Set(rooms.map((r) => r.repo_name).filter(Boolean)),
    [rooms],
  );
  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase();
    return repos
      .filter((r) => !usedRepoNames.has(r.name))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [repos, repoQuery, usedRepoNames]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo.trim()) return;
    setSubmittingCreate(true);
    try {
      const created = await api.createRoom(selectedRepo.trim());
      const id = getRoomId(created);
      toast.success('Room created', {
        description: 'Configure tools and connect an agent to get started.',
      });
      setSelectedRepo('');
      setRepoQuery('');
      setShowCreate(false);
      // Land on Overview, not Connect. Two paths arrive here:
      //   • Individual IC (bottoms-up) — wants to wire up their own
      //     agent. They'll see the setup checklist and click Connect.
      //   • Tech Lead (top-down) — wants to set policy + invite team
      //     BEFORE letting anyone connect. They need the checklist
      //     to remember Tools and Members exist.
      // Overview + a 3-step "Set up this room" checklist serves both.
      if (id) router.push(`/dashboard/rooms/${id}`);
      else await fetchRooms();
    } catch (err) {
      toast.error('Could not create room', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmittingJoin(true);
    try {
      await api.joinRoom(joinCode.trim());
      toast.success('Joined room', {
        description: 'You can now collaborate in this room.',
      });
      setJoinCode('');
      setShowJoin(false);
      await fetchRooms();
    } catch (err) {
      toast.error('Could not join room', {
        description: err instanceof Error ? err.message : 'Check the invite code.',
      });
    } finally {
      setSubmittingJoin(false);
    }
  };

  // Loading shell.
  if (userLoading || (loading && rooms.length === 0)) {
    return (
      <>
        <Topbar title="Rooms" subtitle="Per-repo agent permissions" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <RoomsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Rooms"
        subtitle="Per-repo agent permissions"
        lastUpdated={lastUpdated}
        onRefresh={fetchRooms}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchRooms} />
          </div>
        )}

        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* Page header — sets the mental model in one line. */}
          <motion.header variants={fadeUp}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
              Governance
            </p>
            <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
              Rooms
            </h1>
            <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
              Scope what AI agents can do per repository. Pick a repo, set
              tool policies for your team, connect an agent. Branch
              protection for the AI era.
            </p>
          </motion.header>

          {/* Primary + secondary CTAs. Only show when there are
              rooms (the empty state has its own CTA stack). */}
          {rooms.length > 0 && (
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setShowCreate((v) => !v);
                  setShowJoin(false);
                }}
                leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                New room
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowJoin((v) => !v);
                  setShowCreate(false);
                }}
              >
                Join with code
              </Button>
              <span className="ml-1 text-[11.5px] text-[var(--neutral-soft-400)]">
                {rooms.length.toLocaleString()}{' '}
                {rooms.length === 1 ? 'room' : 'rooms'}
              </span>
            </motion.div>
          )}

          {/* Inline Create form — repo-picker, not free-text. The
              prior free-text input was a footgun: a typo produced a
              broken room with no path to fix. A picker constrained
              to repos the user has actually connected eliminates
              the class of error AND teaches the user that rooms are
              1:1 with repos. */}
          {showCreate && (
            <motion.form
              onSubmit={handleCreate}
              variants={fadeUp}
              className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="border-b border-[var(--stroke-soft-200)] px-4 py-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Create a room
                </p>
                <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
                  Pick a repository. Aegis will scope agents to its
                  branch and members.
                </p>
              </div>

              {/* Search input — the picker is searchable because the
                  median user will have dozens of repos. */}
              <div className="border-b border-[var(--stroke-soft-200)] px-4 py-3">
                <Input
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  placeholder="Search your repositories…"
                  leadingIcon={
                    <Search
                      className="h-3.5 w-3.5 text-[var(--neutral-soft-400)]"
                      strokeWidth={2}
                    />
                  }
                  autoFocus
                />
              </div>

              {/* Repo list — fixed height, scrollable. Each row
                  shows the repo name + visibility + a generative
                  avatar so the user can tell repos apart at a
                  glance. */}
              <div className="max-h-[280px] overflow-y-auto">
                {reposLoading ? (
                  <div className="space-y-1 p-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-[8px]" />
                    ))}
                  </div>
                ) : reposError ? (
                  <div className="px-4 py-6">
                    <ErrorBanner
                      message={reposError}
                      onDismiss={() => setReposError(null)}
                      onRetry={fetchRepos}
                    />
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                      {repoQuery
                        ? 'No repositories match that search.'
                        : repos.length === 0
                          ? 'No repositories connected yet.'
                          : 'Every repository already has a room.'}
                    </p>
                    {!repoQuery && repos.length === 0 && (
                      <Link
                        href="/dashboard/settings"
                        className="mt-2 inline-block text-[12px] font-semibold text-[var(--primary-base)] hover:underline"
                      >
                        Connect GitHub repos →
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul role="radiogroup" aria-label="Choose a repository">
                    {filteredRepos.map((repo) => {
                      const isSelected = selectedRepo === repo.name;
                      return (
                        <li key={repo.repo_id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setSelectedRepo(repo.name)}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              isSelected
                                ? 'bg-[var(--primary-alpha-10)]'
                                : 'hover:bg-[var(--neutral-weak-50)]',
                            )}
                          >
                            <GenerativeAvatar
                              seed={repo.name}
                              variant="user"
                              size={32}
                              radius={8}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'truncate font-mono text-[12.5px]',
                                  isSelected
                                    ? 'text-[var(--primary-base)]'
                                    : 'text-[var(--neutral-strong-950)]',
                                )}
                              >
                                {repo.name}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
                                {repo.is_private ? (
                                  <>
                                    <Lock className="h-3 w-3" strokeWidth={2} />
                                    Private
                                  </>
                                ) : (
                                  <>
                                    <Unlock
                                      className="h-3 w-3"
                                      strokeWidth={2}
                                    />
                                    Public
                                  </>
                                )}
                              </p>
                            </div>
                            <div
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                isSelected
                                  ? 'border-[var(--primary-base)] bg-[var(--primary-base)]'
                                  : 'border-[var(--stroke-sub-300)]',
                              )}
                              aria-hidden
                            >
                              {isSelected && (
                                <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Footer — actions live here so the user always sees
                  them without scrolling. Selected repo echoed on the
                  left so the user confirms before pressing Create. */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] px-4 py-3">
                <p className="min-w-0 truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                  {selectedRepo ? (
                    <>
                      Selected{' '}
                      <span className="font-mono text-[var(--neutral-strong-950)]">
                        {selectedRepo}
                      </span>
                    </>
                  ) : (
                    'Select a repository to continue.'
                  )}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreate(false);
                      setSelectedRepo('');
                      setRepoQuery('');
                    }}
                    disabled={submittingCreate}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submittingCreate || !selectedRepo}
                  >
                    {submittingCreate ? 'Creating…' : 'Create room'}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}

          {/* Inline Join form */}
          {showJoin && (
            <motion.form
              onSubmit={handleJoin}
              variants={fadeUp}
              className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                Join a room
              </p>
              <p className="mb-3 text-[12px] text-[var(--neutral-sub-600)]">
                Paste the invite code a teammate shared with you.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="aeg-..."
                  autoFocus
                />
                {/* size="lg" (h-9) so the Cancel + Join-room buttons
                    share their height with the Input above (also h-9).
                    Default Button md is h-8, which left a 4px height
                    delta and made the row read as "buttons too short
                    for the input." */}
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      setShowJoin(false);
                      setJoinCode('');
                    }}
                    disabled={submittingJoin}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    variant="primary"
                    disabled={submittingJoin || !joinCode.trim()}
                  >
                    {submittingJoin ? 'Joining…' : 'Join room'}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}

          {/* Rooms list or empty state */}
          {rooms.length === 0 ? (
            <motion.div
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-2 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <EmptyState
                icon={<DoorOpen className="h-5 w-5" />}
                title="Set up your first room"
                description="Rooms scope what AI agents can do on each of your repos. Pick a repo, choose tool policies for your team, connect an agent."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShowCreate(true);
                        setShowJoin(false);
                      }}
                      leadingIcon={
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                      }
                    >
                      Create from a repo
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowJoin(true);
                        setShowCreate(false);
                      }}
                    >
                      Got an invite? Join with code
                    </Button>
                  </div>
                }
              />
              {/* Three-feature reassurance strip — teaches what a
                  room actually unlocks. Appears below the empty
                  state so the description doesn't get long. */}
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--stroke-soft-200)] p-5 sm:grid-cols-3">
                <FeatureNote
                  icon={<Shield className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="Tool policies"
                  body="Allow or deny each MCP tool per role. Roles inherit a hierarchy: OWNER > ADMIN > DEVELOPER."
                />
                <FeatureNote
                  icon={<Users className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="Team membership"
                  body="Invite teammates with role-scoped invite codes that expire and limit uses."
                />
                <FeatureNote
                  icon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="MCP endpoint"
                  body="Every room ships with an MCP URL — point Cursor or Claude Code at it to enforce the policy."
                />
              </div>
            </motion.div>
          ) : (
            <motion.ul
              variants={staggerContainer(0.03, 0.04)}
              initial={reduce ? false : 'hidden'}
              animate="show"
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              {rooms.map((room) => {
                const id = getRoomId(room);
                return (
                  <motion.li
                    key={id}
                    variants={fadeUpSm}
                    className="group border-b border-[var(--stroke-soft-200)] last:border-b-0"
                  >
                    <Link
                      href={`/dashboard/rooms/${id}`}
                      /* primary-lighter/50 hover matches the shared
                         <Table> TR pattern. Was --neutral-weak-50,
                         which read as "did anything change?" against
                         the white card. */
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--primary-lighter)]/50"
                    >
                      {/* Generative avatar — deterministic from the
                          repo name, so users learn to recognize each
                          room by its color signature. Falls back to
                          the room id if the repo name is missing. */}
                      <GenerativeAvatar
                        seed={room.repo_name || id}
                        variant="user"
                        size={40}
                        radius={10}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                          {room.repo_name || id}
                        </p>
                        {/* Metadata line. The room ID used to be wrapped
                            in font-mono, which gave the mono glyphs a
                            different vertical baseline from the
                            surrounding sans text — the "ID" prefix
                            and "· created…" tail bounced ~1px above
                            the mono span. Dropping mono here keeps the
                            entire line on one baseline; the "ID" prefix
                            still signals "this is the identifier" without
                            needing the typography switch. */}
                        <p className="mt-0.5 truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                          ID{' '}
                          <span className="text-[var(--neutral-sub-600)]">
                            {id}
                          </span>
                          {room.created_at && (
                            <>
                              {' · created '}
                              <RelativeTime
                                timestamp={room.created_at}
                                className="inline"
                              />
                            </>
                          )}
                        </p>
                      </div>
                      {room.role && (
                        <Badge
                          tone={getRoomRoleBadgeTone(room.role)}
                          uppercase
                          className="text-[10.5px]"
                        >
                          {room.role}
                        </Badge>
                      )}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--neutral-soft-400)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </motion.div>
      </div>
    </>
  );
}

// ─── Feature note (empty-state reassurance strip) ───────────────────
function FeatureNote({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-[1.45] text-[var(--neutral-soft-400)]">
          {body}
        </p>
      </div>
    </div>
  );
}
