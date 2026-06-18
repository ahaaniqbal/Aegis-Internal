'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Severity color for the 4px left accent border (used for blast/decision callouts). */
  accent?: 'success' | 'error' | 'warning' | 'feature' | 'info' | 'critical' | 'high' | 'medium' | 'low' | 'neutral';
  /** Render without padding (for table/list wrappers that handle their own spacing). */
  flush?: boolean;
}

const ACCENT_COLORS: Record<NonNullable<CardProps['accent']>, string> = {
  success:  'var(--success)',
  error:    'var(--error)',
  warning:  'var(--warning)',
  feature:  'var(--feature)',
  info:     'var(--information)',
  critical: 'var(--error)',
  high:     'var(--primary-base)',
  medium:   'var(--warning)',
  low:      'var(--neutral-sub-300)',
  neutral:  'var(--neutral-soft-200)',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, accent, flush, style, children, ...props },
  ref,
) {
  const accentStyle = accent
    ? { borderLeft: `4px solid ${ACCENT_COLORS[accent]}`, ...style }
    : style;

  return (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        flush ? '' : '',
        className,
      )}
      style={accentStyle}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-[18px] py-[12px]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-[13px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]',
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardEyebrow({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-[18px]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-[18px] py-[10px]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardSection({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      {(title || eyebrow || action) && (
        <CardHeader>
          <div className="min-w-0">
            {eyebrow && <CardEyebrow className="mb-1">{eyebrow}</CardEyebrow>}
            {title && <CardTitle>{title}</CardTitle>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardBody>{children}</CardBody>
    </Card>
  );
}
