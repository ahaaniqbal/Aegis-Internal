'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Tiny JSON syntax highlighter — splits the source into tokens via regex
 * and wraps each in a span with a semantic color from the AlignUI palette.
 * Not a full parser — good enough for config snippets.
 */

const TOKEN_RE = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b\d+\.?\d*\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],])/g;

function classify(token: string): { kind: string; color: string } {
  if (/^".*":$/.test(token.trim())) return { kind: 'key', color: 'var(--neutral-strong-950)' };
  if (token.startsWith('"')) return { kind: 'string', color: 'var(--success-dark)' };
  if (/^\d/.test(token)) return { kind: 'number', color: 'var(--feature-dark)' };
  if (token === 'true' || token === 'false' || token === 'null') {
    return { kind: 'literal', color: 'var(--primary-dark)' };
  }
  if (/[{}[\],]/.test(token)) return { kind: 'punct', color: 'var(--neutral-soft-400)' };
  return { kind: 'plain', color: 'var(--neutral-sub-600)' };
}

export function JsonHighlight({ code }: { code: string }): ReactNode {
  const parts: { text: string; color?: string; bold?: boolean }[] = [];
  let lastIndex = 0;
  const matches = code.matchAll(TOKEN_RE);

  for (const m of matches) {
    if (m.index === undefined) continue;
    if (m.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, m.index), color: 'var(--neutral-sub-600)' });
    }
    const { color, kind } = classify(m[0]);
    parts.push({ text: m[0], color, bold: kind === 'key' });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: 'var(--neutral-sub-600)' });
  }

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          <span style={{ color: p.color, fontWeight: p.bold ? 600 : 400 }}>
            {p.text}
          </span>
        </Fragment>
      ))}
    </>
  );
}
