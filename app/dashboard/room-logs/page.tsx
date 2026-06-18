/**
 * Legacy redirect: /dashboard/room-logs → /dashboard/rooms
 *
 * The per-room audit log used to live at this top-level route. It's
 * now a tab inside the room scope (`/dashboard/rooms/[id]/activity`)
 * so the IA matches user mental models — pick a room first, then
 * inspect its activity, instead of having a parallel global view.
 *
 * This page exists purely to catch stale bookmarks / deep links and
 * route them somewhere sensible. The user picks a room from the list,
 * then the room layout takes them to whatever tab they want.
 *
 * Server component on purpose: `redirect()` from next/navigation only
 * works inside server components, and it issues a real 307 so the
 * browser updates its history correctly (no client-side flash).
 */

import { redirect } from 'next/navigation';

export default function RoomLogsRedirectPage() {
  redirect('/dashboard/rooms');
}
