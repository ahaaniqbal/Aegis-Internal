'use client';

/**
 * Connectors catalog — `/dashboard/connectors`.
 *
 * 2-column card grid. Each card has a brand-color radial signature in
 * the upper-left, anchoring its visual identity without committing to a
 * marketing-site full-color treatment. GitHub leads as the live
 * production integration; Slack follows as the actively-building
 * critical-path item; the rest are queued in priority order.
 *
 * Design pulls from:
 *   • Linear app directory — large brand marks doing the heavy lifting,
 *     sparse copy per tile, single-line policy preview.
 *   • Stripe Apps — colored-signature header area with brand mark,
 *     content stack below, status pill consistent in upper-right.
 *   • Vercel Marketplace — subtle radial gradients giving each tile a
 *     unique color identity without flooding the card with brand.
 *
 * Data lives in CONNECTORS (components/ui/ConnectorMark.tsx).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Clock, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { ConnectorMark, CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type ConnectorStatus = 'live' | 'in-progress' | 'coming-soon';

/**
 * Real-mode connector status — what's actually shipped in the backend.
 * Honest engineering state for prospects and pilots clicking through
 * the page when NOT in the demo workspace.
 */
const STATUS_BY_ID_REAL: Record<ConnectorId, ConnectorStatus> = {
  github: 'live',
  slack: 'live',
  linear: 'in-progress',
  'github-actions': 'in-progress',
  postgres: 'coming-soon',
  terraform: 'coming-soon',
  jira: 'coming-soon',
  // Stage 2 connectors — honest "coming soon" until backend integration ships.
  datadog: 'coming-soon',
  sentry: 'coming-soon',
  kubernetes: 'coming-soon',
  cloudflare: 'coming-soon',
  notion: 'coming-soon',
};

/**
 * Demo-workspace status — shows the FULL control-plane vision with all
 * 12 connectors active. This is the pitch view: an investor watching
 * the demo sees the entire surface. The honest roadmap state is
 * preserved for real-workspace visitors via STATUS_BY_ID_REAL above.
 */
const STATUS_BY_ID_DEMO: Record<ConnectorId, ConnectorStatus> = {
  github: 'live',
  slack: 'live',
  linear: 'live',
  'github-actions': 'live',
  postgres: 'live',
  terraform: 'live',
  jira: 'live',
  datadog: 'live',
  sentry: 'live',
  kubernetes: 'live',
  cloudflare: 'live',
  notion: 'live',
};

// Display order — Live first, then In Progress, then queued in the
// priority order from the Notion roadmap.
const DISPLAY_ORDER: ConnectorId[] = [
  // Live integrations first — what an evaluator can use today.
  'github',
  'slack',
  // In-progress next — actively in build, visible state for transparency.
  'linear',
  'github-actions',
  // Coming-soon at the end, in roadmap-priority order from the Notion
  // page. Observability + cluster + edge round out the full developer
  // workflow; Notion at the end is the docs-as-attack-surface bet.
  'postgres',
  'terraform',
  'jira',
  'datadog',
  'sentry',
  'kubernetes',
  'cloudflare',
  'notion',
];

export default function ConnectorsPage() {
  const reduce = useReducedMotion();

  // Demo workspace shows the FULL vision (all 12 connectors live);
  // real workspace shows honest engineering state. Detect via the
  // data-demo attribute set on <html> by OnboardingDemoShell /
  // DashboardLayout.
  const [demoOn, setDemoOn] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => {
      setDemoOn(document.documentElement.dataset.demo === 'true');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-demo'],
    });
    return () => observer.disconnect();
  }, []);

  const statusById = demoOn ? STATUS_BY_ID_DEMO : STATUS_BY_ID_REAL;
  const liveCount = Object.values(statusById).filter((s) => s === 'live').length;
  const inflightCount = Object.values(statusById).filter((s) => s !== 'live').length;

  // Category filter state. `null` = "All". Selecting a category
  // narrows the displayed grid to connectors in that category. The
  // chip strip pattern mirrors Vercel Marketplace + Linear Integrations
  // — the convention for catalog filtering in dev tools.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Precompute the chip pool from the connector catalog so adding a
  // new connector with a new category automatically gets a chip
  // without code change. Each chip carries a count so the user knows
  // catalog breadth before clicking.
  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of DISPLAY_ORDER) {
      const cat = CONNECTORS[id].category;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    // Stable order: by display-order of the first connector in each
    // category. Keeps the chip row predictable as the catalog grows.
    const firstSeenIndex = new Map<string, number>();
    DISPLAY_ORDER.forEach((id, i) => {
      const cat = CONNECTORS[id].category;
      if (!firstSeenIndex.has(cat)) firstSeenIndex.set(cat, i);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort(
        (a, b) =>
          (firstSeenIndex.get(a.category) ?? 0) - (firstSeenIndex.get(b.category) ?? 0),
      );
  }, []);

  const visibleConnectors = useMemo(
    () =>
      selectedCategory
        ? DISPLAY_ORDER.filter((id) => CONNECTORS[id].category === selectedCategory)
        : DISPLAY_ORDER,
    [selectedCategory],
  );

  return (
    <>
      <Topbar title="Connectors" subtitle="The tools Aegis governs for your agents" />

      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* ─── Header ──────────────────────────────────────────────────
            Tight eyebrow + h1 + single stat line, matching the shape of
            every other dashboard page (Runs, Policies, Sessions, etc.).
            The previous marketing-grade 40px display heading + 560px
            paragraph felt like a landing page slab inside a dashboard —
            the eye couldn't flow naturally into the filter chip row +
            connector grid below. */}
        <motion.header
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="mb-6"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
          >
            Connector catalog
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Every tool your agents touch
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            {liveCount} live
            {inflightCount > 0 ? ` · ${inflightCount} in flight` : ''} · Allow,
            Approval, Deny on every call.
          </motion.p>
        </motion.header>

        {/* ─── Category filter chip strip ────────────────────────────
            Horizontal pill row. "All" plus one chip per category, each
            showing its count. Same chip pattern as the ConnectorSwitcher
            on the detail page so the catalog reads as one design family.
            Mobile: horizontal scroll with edge-fade mask (same as
            ConnectorSwitcher) so the row stays one clean line on
            narrow viewports. */}
        <motion.nav
          aria-label="Filter connectors by category"
          className="-mx-1 mb-5 overflow-x-auto px-1 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:[mask-image:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.1 }}
        >
          <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap">
            <CategoryChip
              label="All"
              count={DISPLAY_ORDER.length}
              active={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
            />
            {categoryChips.map(({ category, count }) => (
              <CategoryChip
                key={category}
                label={category}
                count={count}
                active={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              />
            ))}
          </div>
        </motion.nav>

        {/* ─── Grid ──────────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer(0.04, 0.16)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          // Key on the selected category so the stagger animation
          // re-fires on filter change. Without this, swapping the
          // filter would feel static — the user clicked, did anything
          // change? The cascading fade is the visual confirmation.
          key={selectedCategory ?? 'all'}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
        >
          {visibleConnectors.length > 0 ? (
            visibleConnectors.map((id) => (
              <ConnectorCard key={id} id={id} status={statusById[id]} />
            ))
          ) : (
            // Defensive empty state. Today every category has ≥1
            // connector so this can't render, but as the catalog grows
            // / shrinks dynamically (e.g. plan-gated visibility) it'll
            // matter.
            <div className="col-span-full rounded-[12px] border border-dashed border-[var(--stroke-soft-200)] bg-white px-6 py-12 text-center">
              <p className="text-[13px] text-[var(--neutral-sub-600)]">
                No connectors in {selectedCategory}. Try another category or{' '}
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="font-medium text-[var(--primary-base)] underline-offset-4 hover:underline"
                >
                  show all
                </button>
                .
              </p>
            </div>
          )}
        </motion.div>

        {/* ─── Footer hint ───────────────────────────────────────────── */}
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.5 }}
          className="mt-12 text-center text-[12px] text-[var(--neutral-soft-400)]"
        >
          Don&rsquo;t see your tool?{' '}
          <a
            href="mailto:product@runaegis.co"
            className="text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--neutral-strong-950)] hover:underline"
          >
            Tell us what to build next
          </a>
          .
        </motion.p>
      </div>
    </>
  );
}

// ─── Category filter chip ─────────────────────────────────────────────
/**
 * Single chip in the category filter row. Visual treatment matches the
 * ConnectorSwitcher pills on the connector detail page so the whole
 * Connectors surface reads as one filter design family.
 *
 * Active chip: brand-orange tint + dark text + faint shadow.
 * Inactive: white + neutral border + hover lift.
 */
function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 py-[5px] text-[11.5px] font-medium transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
        active
          ? 'border-[var(--primary-base)]/40 bg-[var(--primary-lighter)] text-[var(--primary-dark)] shadow-[0_1px_2px_rgba(250,115,25,0.10)]'
          : 'border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)] hover:-translate-y-px hover:border-[var(--stroke-sub-300)] hover:text-[var(--neutral-strong-950)] hover:shadow-[0_2px_4px_rgba(23,23,23,0.05)]',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular-nums transition-colors duration-150',
          active
            ? 'bg-[var(--primary-base)]/15 text-[var(--primary-dark)]'
            : 'bg-[var(--neutral-weak-50)] text-[var(--neutral-soft-400)] group-hover:bg-[var(--neutral-soft-200)] group-hover:text-[var(--neutral-sub-600)]',
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─── The connector card itself ────────────────────────────────────────
function ConnectorCard({
  id,
  status,
}: {
  id: ConnectorId;
  status: ConnectorStatus;
}) {
  const def = CONNECTORS[id];

  return (
    <Link
      href={`/dashboard/connectors/${id}`}
      className="block"
      aria-label={`${def.name} connector detail`}
    >
    <motion.article
      variants={fadeUp}
      // Lift handled by Framer Motion instead of CSS transition because
      // Framer uses requestAnimationFrame + translate3d under the hood,
      // which forces GPU compositing and avoids the subpixel-rendering
      // jank we kept hitting with CSS `hover:-translate-y-*`. Shadow +
      // border-color still transition via CSS since they're not
      // transform-related; their 220ms timing is intentionally shorter
      // than the lift's 260ms so the cosmetic settle lands a frame
      // before the motion completes — feels more polished than all
      // three landing at the same instant.
      whileHover={{ y: -2, transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] } }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'cursor-pointer',
        'transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:border-[var(--primary-base)]/30',
        'hover:shadow-[0_12px_28px_rgba(23,23,23,0.07),0_2px_8px_rgba(250,115,25,0.06)]',
      )}
    >
      {/* Inset orange-tinted gradient — same treatment as the
          Dashboard's Decision Overview hero card. 4px inset on all
          four sides; fades to transparent before mid-card. Stays
          static (no hover state) so the only motion is the card lift. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
        }}
      />

      {/* Top: brand mark + status pill */}
      <div className="relative flex items-start justify-between gap-3 px-4 pt-4">
        <ConnectorMark id={id} size="md" />
        <StatusPill status={status} />
      </div>

      {/* Title block — name leads, single meta line beneath combines
          category + primitive so they read as one piece of context
          instead of two stacked rows competing for the eye. */}
      <div className="relative px-4 pt-3">
        <h2 className="text-[16px] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--neutral-strong-950)]">
          {def.name}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--neutral-soft-400)]">
          <span>{def.category}</span>
          {def.primitive && (
            <>
              <span aria-hidden className="text-[var(--neutral-soft-400)]/60">·</span>
              <span
                className="font-mono text-[9.5px] font-bold tracking-[0.06em] text-[var(--neutral-sub-600)]"
                title={`Codified policy primitive: ${def.primitive}`}
              >
                {def.primitive}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Description — fills remaining vertical space so the footer
          band sits cleanly at the bottom across cards of varying copy
          lengths. */}
      <div className="relative flex flex-1 flex-col px-4 pb-4 pt-2">
        <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
          {def.description}
        </p>
      </div>

      {/* Footer — uniform layout across all three status states: a
          status indicator (icon + label) on the left, optional action
          on the right. The consistent left-right rhythm gives the band
          its own clear hierarchy regardless of which status this card
          carries. */}
      <div className="relative flex min-h-[42px] items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4 py-2 backdrop-blur-[2px]">
        {status === 'live' && (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--success-dark)]">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Live today
            </span>
            {/* "Configure" CTA reads as a visual affordance; the
                whole card is a Link, so we render it as a styled
                span instead of a nested <Link>/<a> (invalid HTML). */}
            <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--stroke-sub-300)] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[var(--neutral-strong-950)] transition-colors group-hover:bg-[var(--neutral-weak-50)]">
              Open
              <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
            </span>
          </>
        )}
        {status === 'in-progress' && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--primary-base)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            Ships this sprint
          </span>
        )}
        {status === 'coming-soon' && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--neutral-soft-400)]">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            Designed · queued
          </span>
        )}
      </div>
    </motion.article>
    </Link>
  );
}

// ─── Status pill in upper-right ───────────────────────────────────────
function StatusPill({ status }: { status: ConnectorStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/22 bg-[var(--success-lighter)]/50 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--success-dark)] backdrop-blur-[2px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Live
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-base)]/24 bg-[var(--primary-alpha-10)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--primary-base)] backdrop-blur-[2px]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary-base)]" />
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)] backdrop-blur-[2px]">
      Coming soon
    </span>
  );
}

