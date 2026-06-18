'use client';

/**
 * AgentationGate — dev-only wrapper around AgentationWidget.
 *
 * Why this exists separately from AgentationWidget:
 *   • Root layout (app/layout.tsx) is a server component. It can't
 *     call next/dynamic with `ssr: false` directly. This client-only
 *     wrapper lets the root layout mount the widget without a static
 *     import of the `agentation` library.
 *   • Static-importing `agentation` (as the previous root mount did)
 *     ships the entire library into production bundles even though
 *     the widget self-gates on NODE_ENV. The runtime guard runs
 *     after the bundle is already shipped — tree-shaking can't strip
 *     a top-level import based on a runtime check.
 *   • This wrapper uses `next/dynamic` with `ssr: false`. The dynamic
 *     import + NODE_ENV gate together mean the agentation library
 *     never enters prod bundles, and the widget never tries to run
 *     server-side.
 *
 * Mount this ONCE, at the root layout. The dashboard layout used to
 * have its own duplicate mount — that's been removed in favor of the
 * single root mount, so annotations work on every route (auth,
 * onboarding, dashboard, email previews).
 */

import dynamic from 'next/dynamic';

const AgentationWidget = dynamic(
  () => import('@/components/dev/AgentationWidget'),
  { ssr: false },
);

export default function AgentationGate() {
  if (process.env.NODE_ENV === 'production') return null;
  return <AgentationWidget />;
}
