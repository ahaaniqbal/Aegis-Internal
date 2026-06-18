'use client';

/**
 * Members tab — who's in the room + active invites.
 *
 * Read-only-ish for now. The "remove member" / "change role" /
 * "revoke invite" destructive operations are intentionally not wired
 * because the backend doesn't expose endpoints for them yet (flagged
 * in the PRODUCT.md "needed backend" list). When those land, the
 * row-level kebab menus and invite revoke buttons here become
 * functional with a small wiring change.
 *
 * What IS functional today:
 *   • Members list with avatars, roles, join timestamps
 *   • Active invites list with usage / expiry metadata
 *   • Generate a new invite (OWNER + ADMIN only)
 *   • Copy invite code to clipboard
 *
 * The Invite-generation card sits inline at the top of the invites
 * panel so the action is discoverable. We don't gate it behind a
 * modal because the only fields are max-uses + expires-at — small
 * enough to live inline without weighing down the page.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Copy,
  Hash,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import EmptyState from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useUser } from '@/lib/hooks';
import { useRoom } from '@/lib/roomContext';
import type { RoomInvite } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { getRoomRoleBadgeTone } from '@/lib/utils';

const getInviteCode = (invite: RoomInvite): string =>
  String(invite.invite_code || invite.code || invite.id || '');

// Default expires-at: 7 days out from now. Formatted for
// <input type="datetime-local"> which expects `YYYY-MM-DDTHH:mm`
// in LOCAL time (not UTC) — toISOString().slice would be wrong here.
function defaultExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  // Convert local Date → "YYYY-MM-DDTHH:mm" by subtracting tz offset
  // before slicing the ISO string.
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

// Build a Slack-ready share message for an invite. Includes:
//   • What it's for (room + repo)
//   • Where to go (current host's /dashboard/rooms)
//   • How to use it ("Join with code", paste)
//   • The code itself on its own line so the recipient can copy
// We keep it terse — engineers will skim a long message.
function buildShareMessage({
  code,
  repoName,
  origin,
}: {
  code: string;
  repoName: string;
  origin: string;
}): string {
  return [
    `You're invited to the Aegis room for ${repoName}.`,
    '',
    `1. Open ${origin}/dashboard/rooms`,
    `2. Click "Join with code"`,
    `3. Paste: ${code}`,
  ].join('\n');
}

export default function RoomMembersPage() {
  const { roomId, room, members, role: myRole, loading: roomLoading } = useRoom();
  const { user } = useUser();
  const roomRepoName = room?.repo_name ?? 'this room';
  const toast = useToast();
  const reduce = useReducedMotion();

  const canCreateInvites = myRole === 'OWNER' || myRole === 'ADMIN';
  // canModifyMembers controls whether the disabled "..." kebab even
  // appears next to other members' rows. A DEVELOPER seeing greyed-
  // out admin affordances on their teammates' rows is confusing
  // ("am I supposed to be able to do this?"). Only show the
  // affordances to viewers who would eventually be able to use them.
  const canModifyMembers = myRole === 'OWNER' || myRole === 'ADMIN';

  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  // Defaults chosen so a Tech Lead can one-click generate a useful
  // invite. Max-uses=10 covers a typical small team; expires=7d
  // forces a healthy churn pattern (no immortal invite codes
  // floating in stale Slack threads).
  const [maxUses, setMaxUses] = useState('10');
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiresAt());
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!roomId) return;
    setInvitesLoading(true);
    try {
      const data = await api.getRoomInvites(roomId);
      setInvites(data);
    } catch {
      // Soft-fail — the rest of the page is still useful.
    } finally {
      setInvitesLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !canCreateInvites) return;
    setSubmittingInvite(true);
    try {
      const payload: Parameters<typeof api.createRoomInvite>[1] = {};
      if (maxUses.trim()) payload.max_uses = parseInt(maxUses, 10);
      if (expiresAt.trim()) payload.expires_at = new Date(expiresAt).toISOString();
      await api.createRoomInvite(roomId, payload);
      await loadInvites();
      // Reset back to the same defaults rather than empty fields,
      // so a Tech Lead generating a second invite in the same
      // session can immediately fire another.
      setMaxUses('10');
      setExpiresAt(defaultExpiresAt());
      setShowInviteForm(false);
      toast.success('Invite created', {
        description: 'Click "Share" on the new row to copy a paste-ready message.',
      });
    } catch (err) {
      toast.error('Could not create invite', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSubmittingInvite(false);
    }
  };

  // Copy a Slack-ready share message (not just the raw code).
  // Engineering leads were copying the code and then writing the
  // instructions by hand every time — this short-circuits that.
  const copyShareMessage = async (code: string) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    try {
      await navigator.clipboard.writeText(
        buildShareMessage({ code, repoName: roomRepoName, origin }),
      );
      toast.success('Share message copied', {
        description: 'Paste into Slack / email — your teammate can join in 3 clicks.',
      });
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  // Lightweight "just the code" copy — kept as a secondary action
  // for users who already wrote their own message but need the
  // raw code one more time.
  const copyJustCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied', {
        description: 'Just the raw invite code.',
      });
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
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
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        {/* Members panel */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Users
                className="h-4 w-4 text-[var(--primary-base)]"
                strokeWidth={2}
                aria-hidden
              />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Members
              </h2>
              <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                {members.length.toLocaleString()}
              </span>
            </div>
          </div>
          {members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No members yet"
              description="Invite a teammate with an invite code to share this room."
              compact
            />
          ) : (
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {members.map((member, idx) => {
                const isSelf = member.username === user?.username;
                return (
                  <li
                    key={`${member.user_id ?? member.username}-${idx}`}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <AgentAvatar
                      name={member.username || member.user_id}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--neutral-strong-950)]">
                        {member.username || member.user_id}
                        {isSelf && (
                          <span className="rounded-[4px] bg-[var(--neutral-weak-50)] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                            You
                          </span>
                        )}
                      </p>
                      {member.joined_at && (
                        <p className="text-[11px] text-[var(--neutral-soft-400)]">
                          Joined{' '}
                          <RelativeTime
                            timestamp={member.joined_at}
                            className="inline"
                          />
                        </p>
                      )}
                    </div>
                    {/* Role tone reflects role hierarchy: OWNER →
                        brand orange (highest authority), ADMIN →
                        warning amber, DEVELOPER → info blue. Helps
                        users scan a long member list and pick out
                        leads/admins at a glance instead of seeing
                        one uniform color. */}
                    <Badge
                      tone={getRoomRoleBadgeTone(member.role)}
                      uppercase
                      className="text-[10.5px]"
                    >
                      {member.role || 'member'}
                    </Badge>
                    {/* Disabled "..." button — surfaces that
                        Change role / Remove member affordances are
                        coming. Backend endpoints exist
                        (PATCH /room/{id}/members/{user_id} for role
                        and DELETE /room/{id}/members/{user_id} for
                        remove). Wiring those up — popover menu,
                        role picker, confirm dialog, optimistic
                        updates — is its own feature task; we're
                        keeping the kebab visible so the affordance
                        is discoverable, but disabled until the
                        frontend work lands. ADMIN/OWNER only and
                        never on the current user's own row. */}
                    {canModifyMembers && !isSelf && (
                      <button
                        type="button"
                        disabled
                        aria-label="Member actions (coming soon)"
                        title="Change role · Remove member — frontend coming soon."
                        className="flex h-7 w-7 shrink-0 cursor-not-allowed items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] opacity-60"
                      >
                        <MoreHorizontal
                          className="h-3.5 w-3.5"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {/* No hint footer here. The previous "Change role · Remove
              member — pending backend endpoint. Coming soon." text
              was misleading once Jenil shipped the backend mutations
              (PATCH/DELETE on /room/{id}/members/{user_id}). The
              kebab button above carries the "coming soon" signal
              already via its tooltip; an extra footer claiming the
              backend is the blocker would just be wrong. */}
        </motion.section>

        {/* Invites panel */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Link2
                className="h-4 w-4 text-[var(--primary-base)]"
                strokeWidth={2}
                aria-hidden
              />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Invites
              </h2>
              <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                {invites.length.toLocaleString()}
              </span>
            </div>
            {canCreateInvites && !showInviteForm && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowInviteForm(true)}
                leadingIcon={<UserPlus className="h-3 w-3" strokeWidth={2} />}
              >
                New invite
              </Button>
            )}
          </div>

          {/* Inline invite form — only renders when canCreateInvites
              + the user explicitly opened it. Two optional fields. */}
          {canCreateInvites && showInviteForm && (
            <form
              onSubmit={handleCreateInvite}
              className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                    Max uses
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                    Expires at
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-8 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12.5px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                  />
                </div>
                {/* size="md" (h-8) instead of size="sm" (h-7) so the
                    buttons share their bottom-AND-top baseline with the
                    h-8 inputs in the columns to the left. With "sm",
                    items-end aligned bottoms but the 4px height delta
                    made the buttons read as "starting below" the
                    inputs. */}
                <div className="flex items-end gap-1.5">
                  <Button
                    type="button"
                    size="md"
                    variant="secondary"
                    onClick={() => {
                      setShowInviteForm(false);
                      setMaxUses('');
                      setExpiresAt('');
                    }}
                    disabled={submittingInvite}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="md"
                    variant="primary"
                    disabled={submittingInvite}
                  >
                    {submittingInvite ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {invitesLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[56px] w-full rounded-[8px]" />
              ))}
            </div>
          ) : invites.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-5 w-5" />}
              title="No active invites"
              description={
                canCreateInvites
                  ? 'Generate an invite code to bring a teammate into this room.'
                  : 'Ask an admin to create one if you need to share access.'
              }
              compact
              action={
                canCreateInvites && !showInviteForm ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowInviteForm(true)}
                    leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
                  >
                    New invite
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {invites.map((invite, idx) => {
                const code = getInviteCode(invite);
                return (
                  <li
                    key={`${code}-${idx}`}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <CodeChip>{code}</CodeChip>
                      <p className="mt-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                        <span className="font-medium text-[var(--neutral-sub-600)]">
                          {invite.used_count ?? 0}
                        </span>
                        {typeof invite.max_uses === 'number' && (
                          <>
                            {' / '}
                            <span className="font-medium text-[var(--neutral-sub-600)]">
                              {invite.max_uses}
                            </span>
                          </>
                        )}{' '}
                        uses
                        {invite.expires_at && (
                          <>
                            {' · expires '}
                            <span className="font-medium text-[var(--neutral-sub-600)]">
                              {new Date(invite.expires_at).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year:
                                    new Date(invite.expires_at).getFullYear() !==
                                    new Date().getFullYear()
                                      ? 'numeric'
                                      : undefined,
                                },
                              )}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {/* "Share" — copies a Slack-ready message with the
                          join URL + instructions, not just the raw code.
                          Secondary style because "New invite" up in the
                          panel header is the primary action; once invites
                          exist, Share is a per-row repeat action and
                          shouldn't compete with the section CTA. */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyShareMessage(code)}
                        leadingIcon={
                          <Copy className="h-3 w-3" strokeWidth={2.25} />
                        }
                      >
                        Share
                      </Button>
                      {/* Secondary — icon-only "copy raw code" for the
                          power user who wants to compose their own
                          message. Tooltip explains the difference. */}
                      <button
                        type="button"
                        onClick={() => copyJustCode(code)}
                        aria-label="Copy just the code"
                        title="Copy just the code (no instructions)"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                      >
                        <Hash
                          className="h-3 w-3"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                      {/* Revoke — disabled today; the affordance
                          signals that invite revocation is on the
                          roadmap. ADMIN/OWNER only — DEVELOPER can't
                          revoke even when wired. */}
                      {canCreateInvites && (
                        <button
                          type="button"
                          disabled
                          aria-label="Revoke invite (coming soon)"
                          title="Revoke this invite. Pending backend endpoint."
                          className="flex h-7 w-7 shrink-0 cursor-not-allowed items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] opacity-60"
                        >
                          <Trash2
                            className="h-3.5 w-3.5"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Roadmap signal for the missing DELETE-on-invite endpoint.
              py-2 (not py-2.5) so the hint hugs the text rather than
              leaving extra breathing room below — the bg-neutral-weak
              fill made the extra ~2px read as a visible margin. */}
          {canCreateInvites && invites.length > 0 && (
            <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-2">
              <p className="text-[11px] italic text-[var(--neutral-soft-400)]">
              </p>
            </div>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}
