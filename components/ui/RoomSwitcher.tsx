'use client';

/**
 * RoomSwitcher — in-context project switcher for the room header.
 *
 * Inspired by Vercel's project switcher and Linear's workspace
 * switcher: the user shouldn't have to go back to /rooms just to
 * jump between two rooms they actively work on. Click the room
 * avatar, get a popover of every room, pick a different one — done.
 *
 * Design choices:
 *   • Trigger looks like the room title itself so it doesn't read as
 *     "yet another button." The user discovers the affordance from
 *     the chevron + hover ring.
 *   • Lazy fetch — we don't call /rooms until the popover opens. Most
 *     visits never need this data.
 *   • Search input only renders when there are ≥6 rooms; at 1–5
 *     rooms it's noise.
 *   • Current room is checkmarked, not hidden — keeps the list shape
 *     stable and confirms "yes, I'm in the right place."
 *   • Footer "All rooms" link gives an out for users who want the
 *     index page (Create / Join controls live there).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { RoomSummary } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, getRoomRoleBadgeTone } from '@/lib/utils';

// Emphasized-decel easing — matches UserMenu so the two popovers
// feel like the same family of motion.
const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface RoomSwitcherProps {
  /** ID of the currently active room — checkmarked in the list. */
  activeRoomId: string;
  /** Repo name of the active room — shown on the trigger. */
  activeRepoName?: string;
  /** Role in the active room — shown as a badge next to the title. */
  role?: string;
}

const getRoomId = (room: RoomSummary): string =>
  String(room.id || room.room_id || '');

export function RoomSwitcher({
  activeRoomId,
  activeRepoName,
  role,
}: RoomSwitcherProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Lazy-fetch on first open — don't pay the API cost on every
  // room view.
  useEffect(() => {
    if (!open || rooms.length > 0 || loading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getMyRooms();
        if (!cancelled) setRooms(data);
      } catch {
        /* swallow — the trigger still works; user can navigate via "All rooms" */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, rooms.length, loading]);

  // Close-on-outside-click and Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) =>
      (r.repo_name || '').toLowerCase().includes(q),
    );
  }, [rooms, query]);

  const showSearch = rooms.length >= 6;
  const displayName = activeRepoName || activeRoomId;

  return (
    <div className="relative">
      {/* Trigger — looks like the page title, so the affordance
          is unobtrusive but discoverable via the chevron. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch rooms"
        className={cn(
          'group flex items-center gap-3 rounded-[10px] px-2 py-1.5 -mx-2 -my-1.5',
          'transition-colors hover:bg-[var(--neutral-weak-50)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
        )}
      >
        <GenerativeAvatar
          seed={activeRepoName || activeRoomId}
          variant="user"
          size={36}
          radius={10}
        />
        <div className="min-w-0 text-left">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            Room
          </p>
          {/* Role badge sits on the title line, not as a sibling of
              the eyebrow+title block. Placing it next to the title
              keeps its baseline aligned with the room name; the
              previous layout vertically centered it against the
              whole 2-line block, which made it visually float above
              the title. Tone now reflects role hierarchy (OWNER →
              brand orange, ADMIN → amber, DEVELOPER → info blue)
              instead of a single primary tone for every role. */}
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="max-w-[420px] truncate text-[20px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
              {displayName}
            </h1>
            <ChevronsUpDown
              className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)] transition-colors group-hover:text-[var(--neutral-strong-950)]"
              strokeWidth={2}
              aria-hidden
            />
            {role && (
              <Badge tone={getRoomRoleBadgeTone(role)} uppercase>
                {role}
              </Badge>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            role="listbox"
            aria-label="Your rooms"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_EMPH }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 z-50 mt-2 w-[340px] overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                Switch room
              </p>
            </div>

            {showSearch && (
              <div className="border-b border-[var(--stroke-soft-200)] p-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search rooms…"
                  leadingIcon={
                    <Search
                      className="h-3.5 w-3.5 text-[var(--neutral-soft-400)]"
                      strokeWidth={2}
                    />
                  }
                  autoFocus
                />
              </div>
            )}

            {/* space-y-0.5 between rows so the hover bg on one item
                and the active bg on another don't visually touch.
                Without it the two surfaces shared an edge and read as
                one continuous fill, which made it hard to see which
                row was active and which was just hovered. */}
            <div className="max-h-[320px] space-y-0.5 overflow-y-auto p-1">
              {loading ? (
                <div className="space-y-1 p-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-[8px]" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-[var(--neutral-soft-400)]">
                  {query ? 'No rooms match.' : 'No rooms yet.'}
                </p>
              ) : (
                filtered.map((room) => {
                  const id = getRoomId(room);
                  const isActive = id === activeRoomId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setOpen(false);
                        if (!isActive) router.push(`/dashboard/rooms/${id}`);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors',
                        isActive
                          ? 'bg-[var(--primary-alpha-10)]'
                          : 'hover:bg-[var(--neutral-weak-50)]',
                      )}
                    >
                      <GenerativeAvatar
                        seed={room.repo_name || id}
                        variant="user"
                        size={28}
                        radius={7}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-[12.5px] font-semibold tracking-[-0.005em]',
                            isActive
                              ? 'text-[var(--primary-base)]'
                              : 'text-[var(--neutral-strong-950)]',
                          )}
                        >
                          {room.repo_name || id}
                        </p>
                        {room.role && (
                          <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                            {room.role}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[var(--primary-base)]"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer — escape hatches: All rooms (where Create
                + Join live) and a "New room" shortcut. */}
            <div className="grid grid-cols-2 gap-1 border-t border-[var(--stroke-soft-200)] p-1">
              <Link
                href="/dashboard/rooms"
                onClick={() => setOpen(false)}
                className="flex h-8 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[11.5px] font-medium tracking-[-0.005em] text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                All rooms
                <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
              </Link>
              <Link
                href="/dashboard/rooms"
                onClick={() => setOpen(false)}
                className="flex h-8 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[11.5px] font-semibold tracking-[-0.005em] text-[var(--primary-base)] hover:bg-[var(--primary-alpha-10)]"
              >
                <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                New room
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
