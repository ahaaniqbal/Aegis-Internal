'use client';

/**
 * FreezeWeekPreview — live 7×24 visualization of the user's freeze
 * coverage.
 *
 * The old freeze-windows page surfaced configs as a textual list:
 *   "Mon, Tue, Wed, Thu, Fri · 18:00 → 09:00 · UTC"
 *
 * That's accurate but it asks the user to mentally render the
 * schedule. With multiple overlapping windows (e.g. "nights" +
 * "weekends") it's almost unreadable — and our audience is security
 * engineers who NEED to be sure agents are blocked when they expect.
 *
 * SavvyCal solves the same problem in their availability editor: a
 * week grid where the user can SEE the shape of the schedule. We
 * borrow the pattern. Every hour-cell that falls inside ANY freeze
 * window gets a diagonal-hatch primary-orange overlay. A "now"
 * indicator (line + dot) confirms the live time. The user reads
 * the grid as "the shaded zones are when agents can't act."
 *
 * Handles overnight windows correctly — `window_start > window_end`
 * means the freeze wraps midnight, so we split it into two segments
 * per listed day (start→24 on day D, 0→end on day D+1 if our model
 * said the day belongs to D's "freeze evening"). We keep the same
 * interpretation the rest of the page uses: each window's
 * `work_days` is the set of LOCAL calendar days the freeze applies
 * to, evaluated in the window's timezone.
 *
 * Design notes:
 *   • Compact — 8px per hour row, 24 rows total = 192px grid height.
 *     Fits cleanly below a status banner without dominating the page.
 *   • Hour labels show every 4 hours (0, 4, 8, 12, 16, 20) so the
 *     vertical rhythm reads even at small sizes.
 *   • Day labels match data-model order Mon→Sun.
 *   • The hatch pattern uses primary-alpha-16 + primary-alpha-10
 *     stripes — same tones we use for "in-progress" elsewhere in
 *     the product, so freeze coverage reads as deliberate UI state,
 *     not random fill.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface FreezeWindowShape {
  /** IANA timezone — e.g. "UTC", "America/New_York". */
  timezone: string;
  /** Days the freeze applies to. 0=Mon ... 6=Sun (matches the
   *  backend's `work_days` field). */
  work_days: number[];
  /** Start time, "HH:MM" or "HH:MM:SS" — local to `timezone`. */
  window_start: string;
  /** End time, "HH:MM" or "HH:MM:SS" — local to `timezone`. If less
   *  than start, the window wraps midnight. */
  window_end: string;
}

interface FreezeWeekPreviewProps {
  /** Persisted freeze windows. */
  windows: FreezeWindowShape[];
  /** Optional in-progress window from the form — rendered with a
   *  distinct tint so the user can see "what would the schedule
   *  look like if I saved this?" before committing. */
  draftWindow?: FreezeWindowShape | null;
  /** Timezone to evaluate "now" in. If omitted, falls back to the
   *  user's browser timezone. Used to draw the live time indicator
   *  on the grid. */
  nowTimezone?: string;
  className?: string;
}

// Mon-first because the backend uses 0=Mon. Visible day labels are
// short so the column headers stay narrow.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = 24;
const HOUR_PX = 8; // 8px per hour → 192px grid height
const DAY_HEADER_PX = 22;

/** Parse "HH:MM" or "HH:MM:SS" → fractional hour (e.g. "09:30" → 9.5). */
function parseTimeToHours(t: string): number {
  const [hh = '0', mm = '0'] = t.split(':');
  return Math.max(0, Math.min(24, parseInt(hh, 10) + parseInt(mm, 10) / 60));
}

/** Resolve "now" → { dayIndex (0=Mon), hourFraction (0..24) } in a
 *  given IANA timezone. Uses Intl.DateTimeFormat for tz-correct
 *  weekday + hour + minute. Falls back to local time on failure. */
function getNowInTimezone(tz: string): { dayIndex: number; hourFraction: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const dayIndex = DAY_LABELS.indexOf(weekday);
    return {
      dayIndex: dayIndex >= 0 ? dayIndex : 0,
      // Intl can return "24" for midnight in some locales; normalize.
      hourFraction: (hour === 24 ? 0 : hour) + minute / 60,
    };
  } catch {
    const d = new Date();
    // getDay() returns 0=Sun; map to 0=Mon convention.
    const dayIndex = (d.getDay() + 6) % 7;
    return { dayIndex, hourFraction: d.getHours() + d.getMinutes() / 60 };
  }
}

/** For one window, return a list of [day, startHour, endHour]
 *  segments. Overnight windows produce two segments per listed day. */
function windowSegments(
  w: FreezeWindowShape,
): Array<{ day: number; start: number; end: number }> {
  const start = parseTimeToHours(w.window_start);
  const end = parseTimeToHours(w.window_end);
  const segs: Array<{ day: number; start: number; end: number }> = [];
  for (const day of w.work_days) {
    if (start === end) continue; // zero-length window — skip
    if (start < end) {
      segs.push({ day, start, end });
    } else {
      // Wraps midnight: split into evening-of-day-D and morning-of-day-D+1.
      // Convention: the window "belongs" to the day it starts on, so
      // a freeze starting Mon 18:00 ending 06:00 marks Mon evening
      // (18→24) + Tue morning (0→6). This matches how on-call shifts
      // are typically described ("Monday night").
      segs.push({ day, start, end: 24 });
      segs.push({ day: (day + 1) % 7, start: 0, end });
    }
  }
  return segs;
}

export function FreezeWeekPreview({
  windows,
  draftWindow,
  nowTimezone,
  className,
}: FreezeWeekPreviewProps) {
  // Build segments for the saved windows (one color) and the draft
  // (a slightly stronger tint so the user can spot the in-progress
  // overlay against what's already configured).
  const savedSegs = useMemo(
    () => windows.flatMap((w) => windowSegments(w)),
    [windows],
  );
  const draftSegs = useMemo(
    () => (draftWindow ? windowSegments(draftWindow) : []),
    [draftWindow],
  );

  // Compute "now" in the most relevant timezone. Priority:
  //   1. explicit nowTimezone prop
  //   2. the first saved window's timezone
  //   3. the draft window's timezone
  //   4. browser's local tz
  const activeTz =
    nowTimezone ??
    windows[0]?.timezone ??
    draftWindow?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useMemo(() => getNowInTimezone(activeTz), [activeTz]);

  // Build a flat 7×24 frozen-mask so we can quickly know whether
  // the live time indicator is sitting on a frozen cell — used to
  // color the indicator dot for emphasis when freeze IS active now.
  const mask = useMemo(() => {
    const m: boolean[][] = Array.from({ length: 7 }, () => Array(24).fill(false));
    for (const s of [...savedSegs, ...draftSegs]) {
      const startH = Math.floor(s.start);
      const endH = Math.ceil(s.end);
      for (let h = startH; h < endH; h++) {
        m[s.day][h] = true;
      }
    }
    return m;
  }, [savedSegs, draftSegs]);

  const frozenNow =
    mask[now.dayIndex]?.[Math.floor(now.hourFraction)] ?? false;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        className,
      )}
    >
      {/* Caption strip — explains the visualization at a glance.
          Color swatch + label so the user knows what the hatch means. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
            Weekly coverage
          </h3>
          <span className="text-[11px] text-[var(--neutral-soft-400)]">
            {activeTz}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--neutral-soft-400)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{
                background:
                  'repeating-linear-gradient(45deg, var(--primary-alpha-16) 0 2px, var(--primary-alpha-10) 2px 4px)',
              }}
            />
            Frozen
          </span>
          {draftWindow && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, var(--primary-base) 0 2px, var(--primary-alpha-16) 2px 4px)',
                }}
              />
              Editing
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-[var(--success)]"
            />
            Now
          </span>
        </div>
      </div>

      {/* Grid container — left time column + 7 day columns. We use a
          grid (not table) so each cell can be precisely positioned
          and overlays (hatch + now line) can layer cleanly. */}
      <div className="relative px-4 pb-3 pt-2">
        {/* Day-of-week header row, offset to clear the time column. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `28px repeat(7, minmax(0, 1fr))`,
            columnGap: 2,
          }}
        >
          <div />
          {DAY_LABELS.map((day, i) => {
            const isToday = i === now.dayIndex;
            return (
              <div
                key={day}
                className={cn(
                  'flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.06em]',
                  isToday
                    ? 'text-[var(--neutral-strong-950)]'
                    : 'text-[var(--neutral-soft-400)]',
                )}
                style={{ height: DAY_HEADER_PX }}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Body — time labels (left) + 7 day columns. The grid is
            absolutely positioned for the now-indicator overlay so
            we can draw it precisely without disrupting column widths. */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `28px repeat(7, minmax(0, 1fr))`,
            columnGap: 2,
            height: HOURS * HOUR_PX,
          }}
        >
          {/* Time labels column — show every 4 hours. */}
          <div className="relative">
            {[0, 4, 8, 12, 16, 20].map((h) => (
              <div
                key={h}
                className="absolute right-1 text-[9px] font-medium tabular-nums text-[var(--neutral-soft-400)]"
                style={{
                  top: h * HOUR_PX - 5,
                  // Subtract half line-height so the label sits ON
                  // the hour gridline rather than below it.
                }}
              >
                {h.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Day columns. Each one is a stack of 24 hour-cells. */}
          {Array.from({ length: 7 }).map((_, dayIdx) => (
            <div
              key={dayIdx}
              className={cn(
                'relative rounded-[3px]',
                dayIdx === now.dayIndex
                  ? 'bg-[var(--neutral-weak-50)]/60'
                  : 'bg-[var(--neutral-weak-50)]/30',
              )}
            >
              {/* Subtle hour gridlines every 6 hours for visual
                  rhythm. Pure decoration. */}
              {[6, 12, 18].map((h) => (
                <span
                  key={h}
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-[var(--stroke-soft-200)]/70"
                  style={{ top: h * HOUR_PX }}
                />
              ))}

              {/* Saved-window segments — diagonal hatch overlay
                  showing the frozen hours. We render each segment
                  as an absolutely-positioned block over the day
                  column. */}
              {savedSegs
                .filter((s) => s.day === dayIdx)
                .map((s, i) => (
                  <span
                    key={`saved-${i}`}
                    aria-hidden
                    className="absolute inset-x-0.5 rounded-[2px]"
                    style={{
                      top: s.start * HOUR_PX,
                      height: (s.end - s.start) * HOUR_PX,
                      background:
                        'repeating-linear-gradient(45deg, var(--primary-alpha-16) 0 2px, var(--primary-alpha-10) 2px 4px)',
                    }}
                  />
                ))}

              {/* Draft-window segments — same shape, stronger tint
                  so the user can spot the diff against saved state. */}
              {draftSegs
                .filter((s) => s.day === dayIdx)
                .map((s, i) => (
                  <span
                    key={`draft-${i}`}
                    aria-hidden
                    className="absolute inset-x-0.5 rounded-[2px] ring-1 ring-inset ring-[var(--primary-base)]/40"
                    style={{
                      top: s.start * HOUR_PX,
                      height: (s.end - s.start) * HOUR_PX,
                      background:
                        'repeating-linear-gradient(45deg, var(--primary-base) 0 2px, var(--primary-alpha-16) 2px 4px)',
                      mixBlendMode: 'multiply',
                    }}
                  />
                ))}

              {/* "Now" indicator — only on today's column. Dot at
                  the exact current hour, on top of any hatch so the
                  user can see whether NOW is frozen. */}
              {dayIdx === now.dayIndex && (
                <span
                  aria-label={frozenNow ? 'Now (frozen)' : 'Now'}
                  className="absolute inset-x-0 z-10 flex items-center"
                  style={{
                    top: now.hourFraction * HOUR_PX - 4,
                    height: 8,
                  }}
                >
                  <span
                    className="block h-px w-full"
                    style={{
                      background: frozenNow
                        ? 'var(--primary-base)'
                        : 'var(--success)',
                    }}
                  />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      background: frozenNow
                        ? 'var(--primary-base)'
                        : 'var(--success)',
                      boxShadow: '0 0 0 2px white',
                    }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Public helper — given a list of windows, compute "is freeze
 *  active right now?" along with the next transition. Used by the
 *  status banner on the freeze-windows page. Pure function, no
 *  side effects — kept here next to the segments logic so the two
 *  stay in sync. */
export function computeFreezeStatus(
  windows: FreezeWindowShape[],
  evaluateInTimezone?: string,
): {
  activeNow: boolean;
  /** ISO time string when the current state changes, or null if no
   *  windows are configured. */
  nextTransitionAt: Date | null;
  /** The window currently in effect, if any — used to label the
   *  status banner with which freeze fired. */
  activeWindow: FreezeWindowShape | null;
  /** Total hours/week the user is covered by ANY freeze (deduped). */
  coverageHours: number;
} {
  if (windows.length === 0) {
    return {
      activeNow: false,
      nextTransitionAt: null,
      activeWindow: null,
      coverageHours: 0,
    };
  }

  // Build a 7×24 union mask of all freeze windows. We evaluate
  // "now" against the first window's timezone (or override). For
  // a UI signal this is good enough — exact per-window TZ math
  // happens server-side; we just need to tell the user which way
  // the wind's blowing.
  const tz = evaluateInTimezone ?? windows[0].timezone;
  const mask: boolean[][] = Array.from({ length: 7 }, () => Array(24).fill(false));
  const ownerByCell: (FreezeWindowShape | null)[][] = Array.from(
    { length: 7 },
    () => Array(24).fill(null),
  );

  for (const w of windows) {
    for (const seg of windowSegments(w)) {
      const startH = Math.floor(seg.start);
      const endH = Math.ceil(seg.end);
      for (let h = startH; h < endH; h++) {
        if (!mask[seg.day][h]) {
          ownerByCell[seg.day][h] = w;
        }
        mask[seg.day][h] = true;
      }
    }
  }

  const now = getNowInTimezone(tz);
  const nowHour = Math.floor(now.hourFraction);
  const activeNow = mask[now.dayIndex][nowHour];
  const activeWindow = ownerByCell[now.dayIndex][nowHour];

  // Walk forward up to a week to find the next transition.
  let nextDay = now.dayIndex;
  let nextHour = nowHour;
  let nextTransitionAt: Date | null = null;
  for (let i = 1; i <= 7 * 24; i++) {
    nextHour = (nowHour + i) % 24;
    nextDay = (now.dayIndex + Math.floor((nowHour + i) / 24)) % 7;
    if (mask[nextDay][nextHour] !== activeNow) {
      const d = new Date();
      d.setHours(d.getHours() + i, 0, 0, 0);
      nextTransitionAt = d;
      break;
    }
  }

  const coverageHours = mask.flat().filter(Boolean).length;

  return { activeNow, nextTransitionAt, activeWindow, coverageHours };
}
