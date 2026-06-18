'use client';

/**
 * AgentationWidget — the floating annotation toolbar that lets the
 * user click any element on the page, leave a note, and pipe it
 * through to me (the agent) via the local agentation daemon.
 *
 * The `agentation` package was already a dev dependency in
 * package.json, but it was never mounted — which is why the widget
 * wasn't showing up. This file wires it in at the root layout.
 *
 * Why it's a separate client component:
 *   • `app/layout.tsx` is a server component. The agentation widget
 *     is client-only (DOM listeners, portals, state).
 *   • Gating render on `process.env.NODE_ENV !== 'production'` keeps
 *     this out of prod builds entirely — Next.js will tree-shake the
 *     whole module out when NODE_ENV is `production`.
 *   • The `endpoint` prop enables "Agent Sync" — annotations get
 *     POSTed to the local agentation daemon (default port 4747),
 *     which the MCP server then reads back into my session via
 *     `agentation_watch_annotations`.
 */

import { Agentation } from 'agentation';

export default function AgentationWidget() {
  // Belt-and-suspenders: tree-shaking should remove this in prod,
  // but the explicit guard makes the dev-only intent obvious to
  // anyone reading the code and survives misconfigured builds.
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <Agentation
      // Default agentation daemon endpoint (matches what `npx
      // agentation-mcp server` listens on). If the daemon isn't
      // running, the widget still works locally — it just can't
      // sync annotations back to me. Run `npx agentation-mcp
      // server` in a terminal to enable the bridge.
      endpoint="http://localhost:8000"
    />
  );
}
