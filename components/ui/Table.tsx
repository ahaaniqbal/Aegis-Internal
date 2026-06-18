'use client';

import {
  type HTMLAttributes,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// Emphasized-decelerate easing — matches the rest of the dashboard's motion language.
const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/**
 * Premium data table — Linear / Resend pattern.
 * - Card wrapper with subtle shadow, 12px radius.
 * - Sticky header that stays visible while rows scroll.
 * - 1px dividers, no zebra. Hover state is a soft warm tint.
 * - Row interactivity signaled by `clickable` — adds cursor + chevron-friendly group.
 */

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /**
   * Keep horizontal scroll active at all breakpoints (including desktop).
   * Use when the table has too many columns to fit comfortably even on
   * wide screens — Runs is the canonical case (9 columns including
   * Policy + Blast Radius split out).
   *
   * Tradeoff: when on, the wrapper becomes the sticky-ancestor for the
   * thead at all breakpoints, so the header pins to the top of the
   * wrapper rather than under the page-level Topbar. Acceptable since
   * tables wide enough to need this usually live on their own page.
   *
   * Sets a 1180px floor so the columns have room to breathe — anything
   * narrower and the chips start wrapping into each other.
   */
  scrollX?: boolean;
}

export function Table({
  className,
  children,
  scrollX,
  ...props
}: TableProps) {
  // `overflow: clip` clips children to the rounded rect WITHOUT creating
  // a new scroll/containing context — so position:sticky on <thead> still
  // anchors against the page scroll and pins under the topbar.
  // (overflow:hidden would establish a scroll container and break this;
  //  clip-path would clip the wrapper's own border at the corners.)
  //
  // On mobile, the table can be wider than the viewport. Wrap in a
  // horizontal scroll container so it stays usable without forcing
  // the entire page to scroll horizontally.
  return (
    <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] [clip-path:inset(0_round_12px)] [overflow:clip]">
      {/* Below lg: enable horizontal scroll so wide tables stay usable on
          mobile/tablet. At lg+: clear the scroll container so the thead's
          page-level sticky positioning works again (sticky anchors against
          the nearest scrolling ancestor — we don't want that to be this
          wrapper on desktop). When `scrollX` is on, keep the scroll
          container at all breakpoints — the table is wide enough that
          horizontal scroll is worth the tradeoff.

          IMPORTANT: with scrollX on, this wrapper becomes the sticky-ancestor
          for the thead at desktop too. The thead's `lg:top-[var(--table-thead-top,56px)]`
          would then leave a 56px gap of empty wrapper above the header (the
          56px offset is calibrated for page-level Topbar, not wrapper-internal
          sticky). Override the var to 0 so the thead sticks to the wrapper top
          instead. */}
      <div
        className={cn('overflow-x-auto', !scrollX && 'lg:overflow-x-visible')}
        style={scrollX ? ({ ['--table-thead-top' as string]: '0px' } as React.CSSProperties) : undefined}
      >
        <table
          className={cn(
            // `border-separate` instead of collapse so the table's outer
            // cell borders don't merge with the wrapper's border at the
            // rounded corners (caused a visible "border cut off" artifact
            // where the table's straight edge fought the curved wrapper).
            // `[border-spacing:0]` keeps cells visually adjacent so this
            // is purely a corner-rendering fix, no row-gap change.
            'w-full border-separate text-[13px] [border-spacing:0]',
            // Default: 760px on mobile, fluid on desktop.
            // scrollX: 1180px floor at every breakpoint, so all 9 columns
            // stay readable and the user scrolls horizontally on narrow
            // viewports instead of having columns squish.
            scrollX ? 'min-w-[1180px]' : 'min-w-[760px] lg:min-w-0',
            // scrollX action rail: freeze the rightmost column (where the
            // chevron / kebab lives) to the right edge so it stays reachable
            // while the data columns scroll horizontally underneath. Pattern
            // referenced from Rox (/customers) and Mercury (/transactions):
            // wide enterprise-data tables both pin a thin actions column on
            // the right. The 1px `border-l` acts as the visual seam between
            // the scrolling content and the anchored rail.
            //
            // The sticky tbody cells need an opaque bg so scrolling content
            // doesn't show through. Bg stays neutral (`--white-0`) even on
            // row hover/expand because (a) following the row's bg would
            // require a CSS-variable handshake and (b) the chevron rotation
            // already signals row state — the action rail is meant to read
            // as a separate UI zone, not part of the row.
            scrollX &&
              '[&_thead_th:last-child]:sticky [&_thead_th:last-child]:right-0 [&_thead_th:last-child]:border-l [&_thead_th:last-child]:border-[var(--stroke-soft-200)] [&_tbody_td:last-child]:sticky [&_tbody_td:last-child]:right-0 [&_tbody_td:last-child]:z-[1] [&_tbody_td:last-child]:bg-[var(--white-0)] [&_tbody_td:last-child]:border-l [&_tbody_td:last-child]:border-[var(--stroke-soft-200)]',
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        // Desktop (lg+): the table wrapper is overflow-visible, so sticky
        // anchors against the page — pin under the Topbar. The exact offset
        // is layered: by default we pin at the 56px Topbar bottom, but
        // any ancestor that introduces an extra sticky strip below the
        // Topbar (e.g. the RoomTabs strip on /dashboard/rooms/[id]/*)
        // overrides `--table-thead-top` to push the header further down so
        // it lands BELOW that strip instead of colliding with it. Default
        // 56px keeps every existing page working unchanged.
        //
        // Below lg: the wrapper is a horizontal scroll container, so
        // sticky anchors within it; top-0 keeps the header flush with
        // the wrapper edge instead of leaving a 56px gap.
        //
        // NOTE: no bg on the thead itself — it's applied per-cell via
        // `<TH>` so the first/last cells can carry rounded top corners
        // matching the wrapper's `rounded-[12px]` curve. A thead-level
        // bg was leaking past the wrapper's clip and hiding the curved
        // border at the top corners in some browsers (sticky + clip
        // interaction).
        'sticky top-0 z-10 backdrop-blur-sm lg:top-[var(--table-thead-top,56px)]',
        // Subtle bottom border matching the table's outer stroke — just
        // enough to anchor the header without competing with the card edge.
        '[&_tr]:shadow-[inset_0_-1px_0_0_var(--stroke-soft-200)]',
        '[&_tr]:border-b-0',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTHProps {
  /** Make this header click-to-sort. Adds chevron indicator + cursor + onClick wiring. */
  sortable?: boolean;
  /** Current sort direction. `null` = not the active sort column. */
  sortDirection?: SortDirection;
  /** Fired on click when `sortable`. Page owns the cycling (asc → desc → null). */
  onSort?: () => void;
}

export function TH({
  className,
  children,
  sortable,
  sortDirection = null,
  onSort,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & SortableTHProps) {
  const isActive = sortable && sortDirection !== null;

  return (
    <th
      className={cn(
        'whitespace-nowrap bg-[var(--table-header-bg)] px-[18px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]',
        // First / last cells get a touch more breathing room from the
        // card edge + rounded outer corners that match the wrapper's
        // 12px curve (minus 1px for the wrapper's border). This makes
        // the header bg respect the wrapper's rounded corners cleanly,
        // instead of relying on overflow:clip which sticky thead seems
        // to defeat in some browsers.
        'first:rounded-tl-[11px] first:pl-5 last:rounded-tr-[11px] last:pr-5',
        // Sortable headers: smooth color transition on hover instead
        // of Tailwind's default `transition-colors` (150ms, ease-in)
        // which felt abrupt per user feedback. 200ms with the
        // emphasized-decelerate curve matches the motion language
        // used across the dashboard (tabs, buttons, etc).
        sortable &&
          'cursor-pointer select-none transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:text-[var(--neutral-strong-950)]',
        isActive && 'text-[var(--neutral-strong-950)]',
        className,
      )}
      onClick={sortable ? onSort : props.onClick}
      aria-sort={
        sortable
          ? sortDirection === 'asc'
            ? 'ascending'
            : sortDirection === 'desc'
              ? 'descending'
              : 'none'
          : undefined
      }
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <SortChevron direction={sortDirection} />
        )}
      </span>
    </th>
  );
}

/** Tiny chevron indicator for sortable column headers. Shows up/down
 *  arrows when active; faded neutral icon when inactive (signals
 *  "this column is sortable" without competing visually with active). */
function SortChevron({ direction }: { direction: SortDirection }) {
  const active = direction !== null;
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      aria-hidden
      className={cn(
        'shrink-0 transition-opacity',
        active
          ? 'text-[var(--neutral-strong-950)] opacity-100'
          : 'text-[var(--neutral-soft-400)] opacity-50',
      )}
    >
      {direction === 'desc' ? (
        // Down arrow only
        <path
          d="M3.5 5L6 7.5L8.5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : direction === 'asc' ? (
        // Up arrow only
        <path
          d="M3.5 7L6 4.5L8.5 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        // Idle state — up + down arrows stacked (signals "sortable")
        <>
          <path
            d="M3.5 5L6 2.5L8.5 5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3.5 7L6 9.5L8.5 7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function TBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('', className)} {...props}>
      {children}
    </tbody>
  );
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** When true, applies pointer cursor + group hover so child chevron animates. */
  clickable?: boolean;
  /** Mark a row as expanded so the hover state is "stuck open". */
  isExpanded?: boolean;
}

export function TR({ className, clickable, isExpanded, children, ...props }: TRProps) {
  return (
    <tr
      className={cn(
        // Row separator via inset shadow on the cells (not border-b
        // on the <tr>) because this table uses border-separate +
        // border-spacing:0, where <tr> borders don't render reliably
        // across browsers. The THEAD already uses the same trick.
        // Visually identical to the divide-y the Sessions page uses
        // on its <ul>: 1px line at --stroke-soft-200.
        'group transition-colors [&>td]:shadow-[inset_0_-1px_0_0_var(--stroke-soft-200)] last:[&>td]:shadow-none',
        // Hover: solid `--primary-lighter`/50 (≈ average of the gradient
        // stops on the expanded state). Solid instead of gradient so
        // the bg can SMOOTHLY transition with the global 180ms curve —
        // CSS can't tween between `background-image` states cleanly
        // (gradients snap, not fade). Applied per-cell because
        // border-separate can swallow <tr> bg in tables. Visually
        // ≈ the same as the gradient since the row is short.
        clickable && !isExpanded &&
          'cursor-pointer hover:[&>td]:bg-[var(--primary-lighter)]/50',
        clickable && isExpanded && 'cursor-pointer',
        // When expanded: suppress the row-divider (the inset shadow
        // ends here so the row hands off cleanly into TRExpanded's
        // top edge) AND apply the top-to-bottom warm gradient that
        // hands off into TRExpanded's panel below. Stops are tuned
        // so this row's end-color matches TRExpanded's start-color,
        // producing one continuous wash.
        isExpanded &&
          '[&>td]:!shadow-none [&>td]:bg-gradient-to-b [&>td]:from-[var(--primary-lighter)]/55 [&>td]:to-[var(--primary-lighter)]/45',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-[18px] py-[12px] align-middle text-[13px] text-[var(--neutral-strong-950)]',
        'first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Expanded-row insert — spans all columns. Carries the bottom half of the
 * warm orange → white gradient that started on the trigger row above.
 * Start-stop (primary-lighter/45) matches the trigger row's end-stop so
 * the two render as one continuous wash. The inner card is pure white,
 * sitting on the gradient like a clean detail surface.
 *
 * Motion: a height-collapsing inner div produces a smooth, no-layout-jolt
 * expand. Use inside <AnimatePresence initial={false}> so the row exits
 * smoothly too. The <tr> itself fades opacity in/out so the gradient
 * appears/disappears in sync with the panel rather than snapping.
 */
export function TRExpanded({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.tr
      className={cn(className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE_EMPH }}
    >
      <td
        colSpan={colSpan}
        className="border-b border-[var(--stroke-soft-200)] bg-gradient-to-b from-[var(--primary-lighter)]/45 to-[var(--white-0)] p-0"
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ duration: 0.24, ease: EASE_EMPH }}
          style={{ overflow: 'hidden', willChange: 'height' }}
        >
          <div className="px-5 pb-5 pt-1">
            <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              {children}
            </div>
          </div>
        </motion.div>
      </td>
    </motion.tr>
  );
}
