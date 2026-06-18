'use client';

/**
 * Settings tab — room identity + destructive operations.
 *
 * Today this tab is largely informational because the backend
 * doesn't yet expose endpoints for:
 *   • Renaming a room
 *   • Transferring ownership
 *   • Deleting a room
 *   • Leaving a room
 *
 * Rather than hide the destructive section, we render it with
 * inline "coming soon" messaging so the user knows the affordance
 * EXISTS (governance closure is on the roadmap) and where it'll
 * land — they just can't act yet. This is materially better than
 * silence because it's the difference between "the product doesn't
 * support this" and "the product is committed to this, we're just
 * not there yet."
 *
 * When the backend lands (5 simple CRUD endpoints — see PRODUCT.md
 * "Two opportunities for future backend work"), the disabled buttons
 * here become live with no UI restructuring.
 */

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useRoom } from '@/lib/roomContext';
import { motion, useReducedMotion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/motion';

export default function RoomSettingsPage() {
  const { roomId, room, role, loading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  const isOwner = role === 'OWNER';

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[240px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        {/* Identity section — pure-read for now, but the layout is
            already in place to support rename when the backend
            endpoint lands. */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Identity
            </h2>
            <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
              Core properties of this room. Read-only — bound to the GitHub repo.
            </p>
          </div>
          <dl className="divide-y divide-[var(--stroke-soft-200)]">
            <SettingsRow
              label="Repository"
              value={
                <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                  {room?.repo_name ?? '—'}
                </span>
              }
            />
            <SettingsRow
              label="Room ID"
              value={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-[var(--neutral-sub-600)]">
                    {roomId}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={copyRoomId}
                    leadingIcon={<Copy className="h-3 w-3" strokeWidth={2} />}
                  >
                    Copy
                  </Button>
                </div>
              }
            />
            <SettingsRow
              label="Owner"
              value={
                <span className="text-[12.5px] text-[var(--neutral-strong-950)]">
                  {room?.owner_username ?? '—'}
                </span>
              }
            />
            <SettingsRow
              label="Your role"
              value={
                <Badge tone="primary" uppercase className="text-[10.5px]">
                  {role}
                </Badge>
              }
            />
            {room?.created_at && (
              <SettingsRow
                label="Created"
                value={
                  <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
                    {new Date(room.created_at).toLocaleString()}
                  </span>
                }
              />
            )}
          </dl>
        </motion.section>

        {/* Danger zone — destructive ops the UI is ready for once
            the backend supports them. Each button is disabled with
            a tooltip explaining what's coming. */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--error)]/20 bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="border-b border-[var(--error)]/15 bg-[var(--error-lighter)]/40 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4 text-[var(--error)]"
                strokeWidth={2}
                aria-hidden
              />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Danger zone
              </h2>
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
              Irreversible actions for this room.
            </p>
          </div>
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            <DangerRow
              title={isOwner ? 'Transfer ownership' : 'Leave room'}
              description={
                isOwner
                  ? 'Promote another member to OWNER. You become an ADMIN.'
                  : 'Remove yourself from this room. You can rejoin with an invite.'
              }
              cta={isOwner ? 'Transfer…' : 'Leave room'}
              disabled
              disabledReason=""
            />
            {isOwner && (
              <DangerRow
                title="Delete this room"
                description="Permanently remove the room, its members, and its invites. The audit trail of past actions remains."
                cta="Delete room"
                disabled
                disabledReason=""
                destructive
              />
            )}
          </div>
        </motion.section>

        {/* Quick return to the room list */}
        <motion.div variants={fadeUp} className="flex">
          <Link href="/dashboard/rooms">
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              All rooms
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Identity row ───────────────────────────────────────────────────
function SettingsRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

// ─── Danger row — disabled button + "coming soon" hint ──────────────
function DangerRow({
  title,
  description,
  cta,
  disabled,
  disabledReason,
  destructive,
}: {
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {description}
        </p>
        {disabled && disabledReason && (
          <p className="mt-1 text-[11px] italic text-[var(--neutral-soft-400)]">
            {disabledReason}
          </p>
        )}
      </div>
      <Button
        size="sm"
        // `danger` paints the button red so the affordance reads as
        // destructive even while disabled. `secondary` is the safe
        // fallback for the non-destructive case (e.g. "Leave room"
        // for non-owners).
        variant={destructive ? 'danger' : 'secondary'}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
      >
        {cta}
      </Button>
    </div>
  );
}
