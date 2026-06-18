'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
  label?: string;
}

export default function JsonViewer({
  data,
  collapsed = true,
  label = 'JSON',
}: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [copied, setCopied] = useState(false);

  const jsonStr =
    typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--stroke-soft-200)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-1.5">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          <span className="uppercase tracking-[0.05em]">{label}</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[var(--success)]" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      {!isCollapsed && (
        <pre className="max-h-64 overflow-auto p-3 text-[11px] leading-[1.6] text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}
