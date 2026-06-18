'use client';

/**
 * AgentMark — agent identity in a single small circle.
 *
 * Wraps `getAgentToolId(name)` + `<ToolLogo>` with a graceful
 * fallback to `<AgentAvatar>` (initials in a tinted circle) when
 * the agent name doesn't map to a known integration logo.
 *
 * Why this exists: the Runs page rendered this inline as a private
 * `AgentToolMark` helper. The same pattern is needed everywhere
 * agent names appear (Sessions, Audit, Approvals, Dashboard
 * recent-activity). Centralizing it here:
 *   • One place to add new logo mappings — Sessions, Audit, etc.
 *     all pick up new mappings automatically.
 *   • Consistent visual treatment (circle + ring) across pages so
 *     "agent X" reads the same everywhere it appears.
 *   • Size variants mirror AgentAvatar so callers can swap A → B
 *     without touching surrounding layout.
 *
 * If `getAgentToolId` returns null (e.g. `gpt-4o`, `devin`, custom
 * agent names), we render the existing initials avatar. The user
 * sees ONE consistent identity treatment — the only difference is
 * whether we recognize the tool or not.
 */

import { getAgentToolId, ToolLogo } from '@/components/ui/ToolLogo';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg';

// Outer circle dimensions match AgentAvatar's so swapping is
// drop-in. Inner logo is ~70% of the outer to leave breathing
// room around the asymmetric integration PNGs.
const SIZE_MAP: Record<Size, { box: string; logo: number }> = {
  xs: { box: 'h-5 w-5',           logo: 14 },
  sm: { box: 'h-[26px] w-[26px]', logo: 18 },
  md: { box: 'h-8 w-8',           logo: 22 },
  lg: { box: 'h-10 w-10',         logo: 28 },
};

interface AgentMarkProps {
  name: string;
  size?: Size;
  className?: string;
}

export function AgentMark({ name, size = 'sm', className }: AgentMarkProps) {
  const toolId = getAgentToolId(name);

  // Unknown agent → keep the initials avatar so the layout never
  // shifts based on whether we have a logo or not. Callers don't
  // have to branch on "is this a known agent?" themselves.
  if (!toolId) {
    return <AgentAvatar name={name} size={size} className={className} />;
  }

  const dims = SIZE_MAP[size];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[var(--stroke-soft-200)]',
        dims.box,
        className,
      )}
      title={name}
      aria-label={name}
    >
      <ToolLogo id={toolId} size={dims.logo} />
    </span>
  );
}
