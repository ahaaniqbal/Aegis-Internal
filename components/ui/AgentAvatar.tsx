'use client';

import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const sizes: Record<Size, { box: string; text: string }> = {
  xs: { box: 'h-5 w-5',         text: 'text-[9px]'  },
  sm: { box: 'h-[26px] w-[26px]', text: 'text-[11px]' },
  md: { box: 'h-8 w-8',          text: 'text-[12px]' },
  lg: { box: 'h-10 w-10',        text: 'text-[13px]' },
};

interface AgentAvatarProps {
  name: string;
  size?: Size;
  className?: string;
  /** When true (default), uses the orange brand tint; false uses neutral gray. */
  tinted?: boolean;
}

export default function AgentAvatar({
  name,
  size = 'sm',
  className,
  tinted = true,
}: AgentAvatarProps) {
  const sz = sizes[size];
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sz.box,
        sz.text,
        className,
      )}
      style={
        tinted
          ? { backgroundColor: 'rgba(250, 115, 25, 0.10)', color: 'var(--primary-base)' }
          : { backgroundColor: 'var(--neutral-soft-200)', color: 'var(--neutral-sub-600)' }
      }
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
