'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PaginatedLayoutProps {
  total: number;
  page: number;
  pages: number;
  page_size: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
  paginationClassName?: string;
}

export default function PaginatedLayout({
  total,
  page,
  pages,
  page_size,
  onPageChange,
  children,
  paginationClassName,
}: PaginatedLayoutProps) {
  const safeTotal = Math.max(0, total);
  const safePage = Math.max(1, page);
  const safePages = Math.max(0, pages);
  const safePageSize = Math.max(1, page_size);

  const start = safeTotal === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const end = Math.min(safePage * safePageSize, safeTotal);

  const canPrev = safePage > 1;
  const canNext =
    safePages > 0 ? safePage < safePages : safePage * safePageSize < safeTotal;

  return (
    <>
      {children}
      {safeTotal > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3',
            paginationClassName,
          )}
        >
          <p className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">
              {start}–{end}
            </span>{' '}
            of <span className="font-medium text-foreground">{safeTotal}</span>
            {safePages > 1 && (
              <>
                {' '}
                · Page {safePage} of {safePages}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => canPrev && onPageChange(safePage - 1)}
              className={cn(
                'flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:cursor-pointer hover:bg-muted hover:text-foreground',
                !canPrev && 'pointer-events-none opacity-40',
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => canNext && onPageChange(safePage + 1)}
              className={cn(
                'flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:cursor-pointer hover:bg-muted hover:text-foreground',
                !canNext && 'pointer-events-none opacity-40',
              )}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}