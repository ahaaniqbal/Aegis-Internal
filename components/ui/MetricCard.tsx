'use client';

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'allow' | 'deny' | 'rewrite' | 'approval';
}

const variantColors: Record<string, string> = {
  default: 'text-foreground',
  allow: 'text-accent',
  deny: 'text-destructive',
  rewrite: 'text-amber-400',
  approval: 'text-muted-foreground',
};

export default function MetricCard({ label, value, variant = 'default' }: MetricCardProps) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${variantColors[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
