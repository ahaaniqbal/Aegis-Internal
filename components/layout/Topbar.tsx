'use client';

import { RefreshCw } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
}

export default function Topbar({ title, subtitle, lastUpdated, onRefresh }: TopbarProps) {
  const formatTime = (d: Date) => {
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
        {subtitle && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          </>
        )}
      </div>
      {onRefresh && (
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      )}
    </header>
  );
}
