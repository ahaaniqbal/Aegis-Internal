'use client';

/**
 * Single-room layout — wraps every /dashboard/rooms/[id]/* tab.
 *
 * Responsibilities:
 *   1. Mount RoomProvider so the active room id + details + members
 *      + current user's role are shared across all child tab pages.
 *   2. Render the Topbar with the room's repo name as the subtitle
 *      (so the breadcrumb is "Rooms · acme/api-server") — consistent
 *      across every tab in this scope.
 *   3. Render the RoomTabs sub-navigation below the topbar so each
 *      child page can focus purely on its own content area.
 *
 * Failure-mode handling: if the room id in the URL doesn't resolve
 * (deleted room, bad bookmark, no access), render an inline empty
 * state with a "Back to rooms" link rather than letting child tabs
 * blow up trying to read null fields off the context.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, DoorOpen } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { RoomSwitcher } from '@/components/ui/RoomSwitcher';
import { RoomTabs } from '@/components/ui/RoomTabs';
import { RoomProvider, useRoom } from '@/lib/roomContext';

export default function RoomScopeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next.js App Router gives us the [id] param via useParams.
  // We treat it as a string and let RoomProvider handle the fetch.
  const params = useParams<{ id: string }>();
  const roomId = params?.id || '';

  return (
    <RoomProvider roomId={roomId}>
      {/* The room scope introduces an extra sticky strip (RoomTabs)
          below the Topbar. Any sticky <thead> inside a room subpage
          needs to land BELOW that strip, not at the default 56px
          where it would collide with RoomTabs. We declare the
          override here so every room subpage's tables get it for
          free, no per-page wiring. 56 (Topbar) + 40 (RoomTabs h-10)
          + 1 (its border-b) = 97. */}
      <div style={{ '--table-thead-top': '97px' } as React.CSSProperties}>
        <RoomScopeInner />
        {children}
      </div>
    </RoomProvider>
  );
}

/** Renders the Topbar + tabs. Lives inside RoomProvider so it can
 *  use `useRoom()` and reflect the live room name / role. */
function RoomScopeInner() {
  const { roomId, room, role, loading, error } = useRoom();

  // Title strategy: keep "Rooms" as the static page name (so the
  // breadcrumb is consistent across the section), use the repo name
  // as the subtitle since that's the real identity of a Room.
  const subtitle = room?.repo_name ?? (loading ? 'Loading…' : roomId);

  return (
    <>
      <Topbar title="Rooms" subtitle={subtitle} />
      {/* Error state — surfaces if the room fetch failed (bad id /
          permissions / network). Child pages still render so they
          can show their own loading/empty states, but this gives a
          page-level recovery path. */}
      {error && !loading && (
        <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-6 sm:px-6 lg:px-8">
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-2 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<DoorOpen className="h-5 w-5" />}
              title="Couldn't load this room"
              description={error}
              action={
                <Link href="/dashboard/rooms">
                  <Button
                    variant="secondary"
                    leadingIcon={
                      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    }
                  >
                    Back to rooms
                  </Button>
                </Link>
              }
            />
          </div>
        </div>
      )}
      {/* Room header — breadcrumb + room switcher + role.
          The switcher replaces the static title: clicking the room
          name opens a popover of every room the user can access, so
          they can hop between rooms without going back to /rooms.
          Vercel-style; pattern engineers know.

          Above the switcher: a hairline "Rooms / [repo]" breadcrumb
          gives a one-click out (the back arrow) and helps users
          understand where they are in the IA — critical for the
          tabbed sub-IA we just introduced. */}
      {!error && (
        <div className="border-b border-[var(--stroke-soft-200)] bg-[var(--white-0)]">
          {/* py-4 (not py-3) so the RoomSwitcher trigger's hover state
              has real breathing room from the bottom border below.
              The trigger uses -my-1.5 to widen its hover rect past
              the title; with py-3 that left only ~6px of clearance,
              which felt cramped when hovering. py-4 gives ~10px. */}
          <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
            {/* Breadcrumb — small, subtle, but the icon-only back
                arrow is a real affordance the user can click.
                mb-5 (not 3) so the breadcrumb has visible breathing
                room from the RoomSwitcher trigger below, which has
                a -my-1.5 negative margin for its hover effect that
                otherwise pulls it too tight against the breadcrumb. */}
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex items-center gap-1 text-[11.5px] text-[var(--neutral-soft-400)]"
            >
              <Link
                href="/dashboard/rooms"
                className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
                Rooms
              </Link>
              <ChevronRight
                className="h-3 w-3 text-[var(--neutral-soft-400)]"
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate font-medium text-[var(--neutral-sub-600)]">
                {room?.repo_name ?? (loading ? 'Loading…' : roomId)}
              </span>
            </nav>

            {/* Switcher — the trigger is the room title. Loading
                placeholder mirrors the trigger's height so the layout
                doesn't jump when the data resolves. */}
            {loading ? (
              <div className="flex h-[64px] items-center gap-3">
                <span className="h-9 w-9 rounded-[10px] bg-[var(--neutral-weak-50)]" />
                <div>
                  <span className="block h-3 w-12 rounded bg-[var(--neutral-weak-50)]" />
                  <span className="mt-1.5 block h-5 w-40 rounded bg-[var(--neutral-weak-50)]" />
                </div>
              </div>
            ) : room ? (
              <RoomSwitcher
                activeRoomId={roomId}
                activeRepoName={room.repo_name}
                role={role}
              />
            ) : null}
          </div>
        </div>
      )}
      {/* Tab nav. Sticky below the topbar so it persists as the
          content scrolls. */}
      {!error && <RoomTabs roomId={roomId} />}
    </>
  );
}
