'use client';

/**
 * RoomContext — shared room data across the room sub-tabs.
 *
 * The [id]/layout.tsx fetches room details + current-user role + member
 * list once on mount; each child tab page (overview / tools / members
 * / connect / settings) consumes them via `useRoom()` without
 * refetching. Members are shared at the layout level because both
 * Overview (shows count) and Members (shows full list) need them — and
 * the array is small.
 *
 * Why a context instead of refetching per page:
 *   • Snappy tab navigation. Without the context, every tab click
 *     would refetch room details + member list — adds 100-300ms of
 *     latency to a navigation that should feel instant.
 *   • Single source of truth for role. The user's role is derived
 *     from membership data; if each page recomputed it independently,
 *     they could disagree during in-flight updates.
 *   • Optimistic updates. When a tab mutates the room (e.g. Tools
 *     page saves new policies), the context refresh becomes a
 *     single trigger that all tabs observe.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { RoomDetails, RoomMember } from '@/lib/types';

interface RoomContextValue {
  roomId: string;
  room: RoomDetails | null;
  members: RoomMember[];
  /** The current user's role within this room. Falls back to
   *  DEVELOPER if no membership found (shouldn't happen in practice
   *  but stays safe). */
  role: string;
  loading: boolean;
  error: string | null;
  /** Manually re-fetch room + members. Use after a successful
   *  mutation (rename, role change, etc.) to refresh the shared
   *  state for every tab. */
  refresh: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const { user } = useUser();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      // We fetch getMyRooms alongside getRoomDetails because the
      // detail endpoint doesn't always echo the caller's role,
      // but the list endpoint does (it's server-derived from
      // membership). Merging the two means we always have a role
      // that matches what shows on the rooms-index list — no more
      // creator-sees-themself-as-DEVELOPER mismatches.
      const [roomData, memberData, myRoomsList] = await Promise.all([
        api.getRoomDetails(roomId),
        api.getRoomMembers(roomId),
        api.getMyRooms(),
      ]);
      const myRow = myRoomsList.find(
        (r) => String(r.id || r.room_id || '') === String(roomId),
      );
      // Merge the role from the list (authoritative) into the
      // detail payload so consumers can read room.role uniformly.
      setRoom({ ...roomData, role: myRow?.role ?? roomData.role });
      setMembers(memberData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Role resolution — three tiers:
  //   1. room.role from getMyRooms (most reliable, server-derived
  //      from auth + membership)
  //   2. members.find() — works when the backend keys members by
  //      the same username string we have on the user object
  //   3. 'DEVELOPER' — defensive default; rare in practice once
  //      tier 1 lands.
  const role = useMemo(() => {
    if (room?.role) return room.role;
    const me = members.find((m) => m.username === user?.username);
    if (me?.role) return me.role;
    return 'DEVELOPER';
  }, [room?.role, members, user?.username]);

  const value = useMemo<RoomContextValue>(
    () => ({ roomId, room, members, role, loading, error, refresh }),
    [roomId, room, members, role, loading, error, refresh],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoom must be called inside a RoomProvider');
  }
  return ctx;
}
