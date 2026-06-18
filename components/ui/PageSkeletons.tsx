'use client';

/**
 * Per-page composed skeletons.
 *
 * Each skeleton mirrors the EXACT geometry of the page's loaded layout —
 * column widths, row heights, card proportions, section spacing. Goal:
 * when the data lands, content slots into place with zero layout shift,
 * so the loading-to-loaded transition feels seamless.
 *
 * Pattern researched from Mercury / Nextdoor / Threads (see refero-design
 * session for full Steal List). Built on the shared <Skeleton> primitive.
 *
 * EXPORTS — one per dashboard route:
 *   DashboardHomeSkeleton, RunsSkeleton, SessionsSkeleton, ApprovalsSkeleton,
 *   AuditSkeleton, PoliciesSkeleton, FreezeWindowSkeleton, TokenSpendSkeleton,
 *   RoomsSkeleton, SettingsSkeleton,
 *   AppShellSkeleton (used by the dashboard layout during auth verify).
 *
 * Each takes no props — the page wraps it in its own <Topbar> so the
 * sticky chrome stays consistent across loaded and loading states.
 */

import {
  Skeleton,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
  SkeletonStatCell,
  SkeletonText,
} from './Skeleton';

// ─── App shell skeleton (used by app/dashboard/layout.tsx) ─────────────────
//
// Shown while the dashboard layout verifies auth + bootstraps the user
// session — i.e. the very first thing a user sees after sign-in. Mirrors
// the actual sidebar (220px) + topbar (56px) + content shell so the
// transition into the real layout has no visible shift.

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-[var(--bg-app)]">
      {/* Sidebar — width tracks --sidebar-w so the skeleton matches
          the user's saved collapsed/expanded preference on first paint. */}
      <aside
        className="hidden h-dvh flex-col overflow-hidden border-r border-[var(--stroke-soft-200)] bg-white lg:flex"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {/* Brand row */}
        <div className="flex h-[56px] items-center px-4">
          <Skeleton className="h-[22px] w-[88px] rounded-[4px]" />
        </div>
        {/* Nav groups */}
        <div className="flex-1 overflow-hidden px-2 pb-3">
          {[0, 1, 2, 3].map((g) => (
            <div key={g} className="mt-4">
              <Skeleton className="ml-2 h-[10px] w-16 rounded-[3px]" />
              <div className="mt-2 space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 items-center gap-2 rounded-[7px] px-2"
                  >
                    <Skeleton variant="circle" className="h-3.5 w-3.5" />
                    <SkeletonText width="3/6" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* User row */}
        <div className="border-t border-[var(--stroke-soft-200)] px-2 py-[10px]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <SkeletonAvatar size={26} />
            <div className="min-w-0 flex-1 space-y-1">
              <SkeletonText width="4/6" className="h-[11px]" />
              <SkeletonText width="3/6" className="h-[9px]" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main column — topbar + content */}
      <main className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-12 z-20 flex h-[56px] w-full shrink-0 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white px-4 sm:px-6 lg:top-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[14px] w-20 rounded-[4px]" />
            <span className="hidden h-3 w-px bg-[var(--stroke-soft-200)] sm:inline-block" />
            <Skeleton className="hidden h-[12px] w-32 rounded-[4px] sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-7 w-[160px] rounded-[8px] sm:block" />
            <SkeletonButton width={32} className="h-7 rounded-[8px]" />
            <SkeletonAvatar size={28} />
          </div>
        </header>

        {/* Default content fill — same metric strip the Dashboard home shows */}
        <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <DashboardHomeSkeleton />
        </div>
      </main>
    </div>
  );
}

// ─── Page-content skeletons ────────────────────────────────────────────────
// Each one is the body of a dashboard route. The route's own <Topbar>
// renders normally outside this — these only fill the scrollable content
// area, matching the layout of the loaded page underneath.

// Reusable page-header block: small eyebrow + page title + sub
function PageHeader() {
  return (
    <div className="mb-6">
      <Skeleton className="mb-3 h-[11px] w-24 rounded-[3px]" />
      <Skeleton className="h-[28px] w-[60%] max-w-[420px] rounded-[6px]" />
      <Skeleton className="mt-3 h-[14px] w-[80%] max-w-[520px] rounded-[5px]" />
    </div>
  );
}

// ─── /dashboard ─────────────────────────────────────────────────────────────

export function DashboardHomeSkeleton() {
  return (
    <div>
      <PageHeader />

      {/* Decision Overview hero */}
      <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="px-6 pt-6">
          <Skeleton className="h-[11px] w-32 rounded-[3px]" />
          <div className="mt-3 flex items-baseline gap-3">
            <Skeleton className="h-[40px] w-32 rounded-[6px]" />
            <Skeleton className="h-[14px] w-40 rounded-[4px]" />
          </div>
          <Skeleton className="mt-6 h-[10px] w-full rounded-[3px]" />
        </div>
        <div className="mt-5 grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatCell key={i} />
          ))}
        </div>
      </section>

      {/* 6-cell stat strip */}
      <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonStatCell key={i} />
          ))}
        </div>
      </section>

      {/* Two-column: activity feed + approvals */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Activity feed */}
        <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-4 w-4" />
              <Skeleton className="h-[14px] w-28 rounded-[4px]" />
              <SkeletonBadge />
            </div>
            <Skeleton className="h-[12px] w-16 rounded-[4px]" />
          </div>
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                <Skeleton variant="circle" className="h-3 w-3" />
                <SkeletonAvatar size={24} />
                <Skeleton className="h-[13px] w-24 rounded-[4px]" />
                <SkeletonBadge />
                <SkeletonText width="4/6" />
                <Skeleton className="hidden h-[11px] w-12 rounded-[3px] lg:block" />
                <SkeletonBadge />
                <Skeleton variant="circle" className="h-3.5 w-3.5" />
              </div>
            ))}
          </div>
        </section>

        {/* Pending approvals card */}
        <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-4 w-4" />
              <Skeleton className="h-[14px] w-32 rounded-[4px]" />
              <SkeletonBadge />
            </div>
          </div>
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-6 py-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton variant="circle" className="h-1.5 w-1.5" />
                  <SkeletonAvatar size={20} />
                  <Skeleton className="h-[12px] w-28 rounded-[4px]" />
                </div>
                <SkeletonText width="full" />
                <SkeletonText width="4/6" />
                <div className="flex gap-1.5">
                  <SkeletonBadge />
                  <SkeletonBadge />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <SkeletonButton width={64} className="h-8" />
                  <SkeletonButton width={80} className="h-8" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── /dashboard/runs ────────────────────────────────────────────────────────

export function RunsSkeleton() {
  return (
    <div>
      <PageHeader />

      {/* Metric strip — 5 cells */}
      <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonStatCell key={i} />
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-[260px] flex-1 rounded-[8px]" />
        <Skeleton className="h-9 w-[140px] rounded-[8px]" />
      </div>

      {/* Table */}
      <SkeletonTable
        columns={[
          { width: 'flex-1 min-w-[180px]' }, // Agent
          { width: 'w-[120px]' },             // Tool
          { width: 'flex-1 min-w-[140px]' }, // Repository
          { width: 'w-[100px]' },             // Branch
          { width: 'w-[80px]' },              // Decision
          { width: 'w-[120px]' },             // Time/exec
          { width: 'w-6' },                   // chevron
        ]}
        rows={9}
      />
    </div>
  );
}

// ─── /dashboard/sessions ────────────────────────────────────────────────────

export function SessionsSkeleton() {
  return (
    <div>
      <PageHeader />

      <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <ul className="divide-y divide-[var(--stroke-soft-200)]">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-[14px] sm:px-6">
              <SkeletonAvatar size={36} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-[14px] w-32 rounded-[4px]" />
                  <SkeletonBadge />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-[11px] w-16 rounded-[3px]" />
                  <Skeleton className="h-[11px] w-20 rounded-[3px]" />
                  <Skeleton className="hidden h-[11px] w-28 rounded-[3px] sm:block" />
                </div>
              </div>
              {/* Decision pills slot — 220px fixed */}
              <div className="hidden w-[220px] shrink-0 justify-end md:flex">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((j) => (
                    <SkeletonBadge key={j} />
                  ))}
                </div>
              </div>
              <Skeleton variant="circle" className="h-4 w-4 shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── /dashboard/approvals ───────────────────────────────────────────────────

export function ApprovalsSkeleton() {
  return (
    <div>
      <PageHeader />

      {/* Filter chip bar */}
      <div className="mb-6 flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-[7px]" />
        ))}
      </div>

      <ul className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SkeletonAvatar size={32} />
                <div className="space-y-1.5">
                  <Skeleton className="h-[14px] w-36 rounded-[4px]" />
                  <Skeleton className="h-[11px] w-28 rounded-[3px]" />
                </div>
              </div>
              <SkeletonBadge />
            </div>
            <Skeleton className="mt-4 h-[14px] w-[85%] rounded-[5px]" />
            <Skeleton className="mt-2 h-[14px] w-[55%] rounded-[5px]" />
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[var(--stroke-soft-200)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-[10px] w-20 rounded-[3px]" />
                  <SkeletonBadge />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-[12px] w-24 rounded-[4px]" />
              <div className="flex items-center gap-2">
                <SkeletonButton width={70} className="h-8" />
                <SkeletonButton width={86} className="h-8" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── /dashboard/audit ───────────────────────────────────────────────────────

export function AuditSkeleton() {
  return (
    <div>
      <PageHeader />

      {/* Date filter + export bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[11px] w-12 rounded-[3px]" />
          <Skeleton className="h-9 w-[220px] rounded-[8px]" />
        </div>
        <SkeletonButton width={120} className="h-9" />
      </div>

      {/* Table */}
      <SkeletonTable
        columns={[
          { width: 'w-[180px]' },             // Timestamp
          { width: 'flex-1 min-w-[140px]' }, // Agent
          { width: 'w-[100px]' },             // Tool
          { width: 'flex-1 min-w-[180px]' }, // Summary
          { width: 'w-[140px]' },             // Repository
          { width: 'w-[80px]' },              // Decision
          { width: 'w-6' },                   // chevron
        ]}
        rows={12}
      />
    </div>
  );
}

// ─── /dashboard/policies ───────────────────────────────────────────────────

export function PoliciesSkeleton() {
  return (
    <div>
      <PageHeader />

      <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        {/* Pseudo-table header */}
        <div className="grid grid-cols-[44px_1fr_140px_120px_64px] items-center gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-6 py-3">
          <span />
          <Skeleton className="h-[10px] w-12 rounded-[3px]" />
          <Skeleton className="h-[10px] w-16 rounded-[3px]" />
          <Skeleton className="h-[10px] w-12 rounded-[3px]" />
          <Skeleton className="ml-auto h-[10px] w-10 rounded-[3px]" />
        </div>
        <ul className="divide-y divide-[var(--stroke-soft-200)]">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <li
              key={i}
              className="grid grid-cols-[44px_1fr_140px_120px_64px] items-center gap-3 px-6 py-4"
            >
              <Skeleton className="h-9 w-9 rounded-[10px]" />
              <div className="space-y-1.5">
                <Skeleton className="h-[14px] w-40 rounded-[4px]" />
                <Skeleton className="h-[12px] w-[70%] rounded-[3px]" />
              </div>
              <SkeletonBadge />
              <SkeletonBadge />
              <div className="ml-auto">
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── /dashboard/freeze-window ───────────────────────────────────────────────

export function FreezeWindowSkeleton() {
  return (
    <div>
      <PageHeader />

      <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <ul className="divide-y divide-[var(--stroke-soft-200)]">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-4 sm:gap-3 sm:px-6"
            >
              <Skeleton className="h-9 w-9 rounded-[10px]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-[14px] w-32 rounded-[4px]" />
                  <SkeletonBadge />
                </div>
                <Skeleton className="h-[11px] w-20 rounded-[3px]" />
              </div>
              <SkeletonButton width={68} className="h-8" />
              <SkeletonButton width={80} className="h-8" />
              <Skeleton variant="circle" className="h-4 w-4" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── /dashboard/token-spenditure ───────────────────────────────────────────

export function TokenSpendSkeleton() {
  return (
    <div>
      <PageHeader />

      {/* Range tabs */}
      <div className="mb-4 inline-flex rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mx-0.5 h-7 w-[68px] rounded-[7px]" />
        ))}
      </div>

      {/* 4-cell stat strip */}
      <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatCell key={i} />
          ))}
        </div>
      </section>

      {/* Monetary savings tile */}
      <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" className="h-11 w-11" />
            <div className="space-y-2">
              <Skeleton className="h-[10px] w-32 rounded-[3px]" />
              <Skeleton className="h-[28px] w-28 rounded-[6px]" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="space-y-1.5 text-right">
              <Skeleton className="ml-auto h-[10px] w-20 rounded-[3px]" />
              <Skeleton className="ml-auto h-[14px] w-16 rounded-[4px]" />
            </div>
            <SkeletonBadge />
          </div>
        </div>
      </section>

      {/* Charts grid — bar (2 cols) + pie (1 col) */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)] xl:col-span-2">
          <Skeleton className="mb-4 h-[14px] w-40 rounded-[4px]" />
          <ChartSkeleton height={220} />
        </section>
        <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <Skeleton className="mb-4 h-[14px] w-32 rounded-[4px]" />
          {/* Pie placeholder */}
          <div className="flex items-center justify-center py-6">
            <Skeleton variant="circle" className="h-[160px] w-[160px]" />
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-[12px] w-16 rounded-[3px]" />
              <Skeleton className="h-[12px] w-12 rounded-[3px]" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-[12px] w-20 rounded-[3px]" />
              <Skeleton className="h-[12px] w-12 rounded-[3px]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── /dashboard/rooms ──────────────────────────────────────────────────────

export function RoomsSkeleton() {
  return (
    <div>
      <PageHeader />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Create room card */}
        <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <Skeleton className="h-[14px] w-28 rounded-[4px]" />
          <Skeleton className="mt-3 h-9 w-full rounded-[8px]" />
          <SkeletonButton className="mt-3 h-9 w-full" />
        </div>
        {/* Join room card */}
        <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <Skeleton className="h-[14px] w-24 rounded-[4px]" />
          <Skeleton className="mt-3 h-9 w-full rounded-[8px]" />
          <SkeletonButton className="mt-3 h-9 w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Room list */}
        <aside className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="border-b border-[var(--stroke-soft-200)] p-4">
            <Skeleton className="h-[12px] w-20 rounded-[3px]" />
          </div>
          <ul className="divide-y divide-[var(--stroke-soft-200)]">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-2.5 px-4 py-3">
                <Skeleton variant="circle" className="h-7 w-7" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-[12px] w-28 rounded-[4px]" />
                  <Skeleton className="h-[10px] w-20 rounded-[3px]" />
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Tools grid */}
        <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] p-4">
            <Skeleton className="h-[14px] w-32 rounded-[4px]" />
            <Skeleton className="h-7 w-[140px] rounded-[8px]" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-[10px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2.5"
              >
                <SkeletonText width="3/6" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── /dashboard/rooms/[id]/activity ────────────────────────────────────────
//
// Used while the room's per-user audit log loads. The room layout
// already renders the Topbar + breadcrumb + tab strip, so the skeleton
// only fills the activity card itself (no page header, no room picker).

export function RoomActivitySkeleton() {
  return (
    <div>
      <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] p-4">
          <Skeleton className="h-[14px] w-44 rounded-[4px]" />
          <Skeleton className="h-[12px] w-24 rounded-[3px]" />
        </div>
        <SkeletonTable
          columns={[
            { width: 'flex-1 min-w-[160px]' }, // User
            { width: 'w-[140px]' },             // Tool
            { width: 'w-[140px]' },             // Branch
            { width: 'w-[110px]' },             // Risk (stacked chips)
            { width: 'w-[100px]' },             // Decision
            { width: 'w-[100px]' },             // Time
            { width: 'w-6' },                   // chevron
          ]}
          rows={9}
        />
        <div className="flex items-center justify-between border-t border-[var(--stroke-soft-200)] px-4 py-3">
          <Skeleton className="h-[11px] w-40 rounded-[3px]" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-[7px]" />
            <Skeleton className="h-7 w-20 rounded-[7px]" />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── /dashboard/settings ───────────────────────────────────────────────────

export function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Settings nav sidebar */}
      <aside className="space-y-1">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2">
            <Skeleton variant="circle" className="h-3.5 w-3.5" />
            <SkeletonText width="4/6" />
          </div>
        ))}
      </aside>

      {/* Section panel */}
      <section>
        <Skeleton className="mb-2 h-[10px] w-20 rounded-[3px]" />
        <Skeleton className="h-[24px] w-52 rounded-[5px]" />
        <Skeleton className="mt-2 h-[13px] w-[60%] max-w-[380px] rounded-[4px]" />

        <div className="mt-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="space-y-2 border-b border-[var(--stroke-soft-200)] p-5 last:border-b-0"
            >
              <Skeleton className="h-[12px] w-24 rounded-[3px]" />
              <Skeleton className="h-9 w-full rounded-[8px]" />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <SkeletonButton width={120} className="h-9" />
        </div>
      </section>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function SkeletonTable({
  columns,
  rows,
}: {
  columns: Array<{ width: string }>;
  rows: number;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-[18px] py-[10px]">
        {columns.map((c, i) => (
          <div key={i} className={c.width}>
            <Skeleton className="h-[10px] w-12 rounded-[3px]" />
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-[var(--stroke-soft-200)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-3 px-[18px] py-[12px]">
            {columns.map((c, i) => (
              <div key={i} className={c.width}>
                {/* First column gets two stacked bars to suggest agent + tool;
                    everything else is a single bar. Last (w-6) gets a chevron. */}
                {i === 0 ? (
                  <div className="flex items-center gap-2.5">
                    <SkeletonAvatar size={20} />
                    <Skeleton className="h-[13px] w-28 rounded-[4px]" />
                  </div>
                ) : i === columns.length - 1 && c.width === 'w-6' ? (
                  <Skeleton variant="circle" className="h-3.5 w-3.5" />
                ) : (
                  <Skeleton className="h-[13px] w-[80%] rounded-[4px]" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  // Faux bar chart: 12 vertical bars at varied heights, baseline at the bottom.
  const heights = [60, 80, 45, 95, 70, 88, 55, 92, 78, 65, 85, 72];
  return (
    <div
      className="flex items-end gap-2"
      style={{ height }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t-[4px] rounded-b-none"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
