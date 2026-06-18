'use client';

import type { CSSProperties } from 'react';

/**
 * Tool brand marks rendered from PNGs in /public/integrations.
 * Every logo is rendered inside a fixed-size square so the marks
 * read at consistent visual weight no matter how each source asset
 * is cropped — the image is centered inside the box with `object-contain`.
 */

export type ToolId =
  | 'vscode-copilot'
  | 'cursor'
  | 'claude-code'
  | 'claude'          // raw Claude (anthropic) — non-Code-CLI usage
  | 'github-copilot'  // GitHub Copilot proper (distinct from VS Code's host)
  | 'openai'          // GPT family (gpt-4o, gpt-5, o3, etc.)
  | 'windsurf'        // Codeium's Windsurf editor
  | 'replit'          // Replit Agent
  | 'devin'           // Cognition's Devin
  | 'aider';          // Aider terminal coder

const SOURCES: Record<ToolId, { src: string; alt: string }> = {
  'vscode-copilot': { src: '/integrations/vscode.png',         alt: 'VS Code' },
  cursor:           { src: '/integrations/cursor.png',         alt: 'Cursor' },
  'claude-code':    { src: '/integrations/claude-code.png',    alt: 'Claude Code' },
  claude:           { src: '/integrations/claude.png',         alt: 'Claude' },
  'github-copilot': { src: '/integrations/github-copilot.png', alt: 'GitHub Copilot' },
  openai:           { src: '/integrations/openai.png',         alt: 'OpenAI' },
  windsurf:         { src: '/integrations/windsurf.png',       alt: 'Windsurf' },
  replit:           { src: '/integrations/replit.png',         alt: 'Replit' },
  devin:            { src: '/integrations/devin.png',          alt: 'Devin' },
  aider:            { src: '/integrations/aider.png',          alt: 'Aider' },
};

/**
 * Best-effort mapping from a free-form `agent_name` (e.g. `claude-sonnet-4`,
 * `cursor-agent`, `github-copilot`, `gpt-4o`) to the corresponding
 * integration logo. Returns `null` when no confident match is found so
 * callers can fall back to a generic initials avatar.
 *
 * Match order matters: host/editor identity wins over the underlying
 * model. An agent like `cursor-claude-haiku` is Cursor (not Claude), and
 * `copilot-gpt-4` is Copilot (not OpenAI raw). Specific tools (Devin,
 * Aider, Windsurf, Replit) match before the more general families.
 */
export function getAgentToolId(agentName?: string | null): ToolId | null {
  if (!agentName) return null;
  const n = agentName.toLowerCase();

  // ── Host / editor (these wrap a model, so they win over the model name)
  if (n.includes('cursor')) return 'cursor';
  if (n.includes('windsurf') || n.includes('cascade') || n.includes('codeium')) {
    return 'windsurf';
  }
  if (n.includes('github-copilot') || n.includes('githubcopilot') || n.includes('gh-copilot')) {
    return 'github-copilot';
  }
  if (n.includes('copilot') || n.includes('vscode') || n.includes('vs-code')) {
    return 'vscode-copilot';
  }
  if (n.includes('replit')) return 'replit';
  if (n.includes('devin') || n.includes('cognition')) return 'devin';
  if (n.includes('aider')) return 'aider';

  // ── Model families (only matched when no host is named)
  // Claude Code (CLI) explicitly named → use the Code logo. Otherwise
  // raw Claude usage (claude-sonnet, claude-opus, anthropic) → generic
  // Claude mark.
  if (n.includes('claude-code') || n.includes('claudecode')) return 'claude-code';
  if (n.includes('claude') || n.includes('anthropic') || n.includes('sonnet') || n.includes('opus') || n.includes('haiku')) {
    return 'claude';
  }
  if (
    n.includes('gpt') ||
    n.includes('openai') ||
    n.startsWith('o1') ||
    n.startsWith('o3') ||
    n.startsWith('o4')
  ) {
    return 'openai';
  }

  return null;
}

interface ToolLogoProps {
  id: ToolId;
  /** Outer square edge length in px (default 28). */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function ToolLogo({ id, size = 28, className, style }: ToolLogoProps) {
  const { src, alt } = SOURCES[id];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Plain <img> — these are small PNGs, no need for next/image.
          `data-tool-id` lets the dark-mode CSS in globals.css selectively
          invert monochromatic dark logos (Cursor) without touching
          colored ones (VS Code blue). Add new dark-only inversions
          there as new logos get added. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        data-tool-id={id}
        width={size}
        height={size}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  );
}
