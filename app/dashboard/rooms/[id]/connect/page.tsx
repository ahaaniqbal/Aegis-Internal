'use client';

/**
 * Connect tab — the wiring wizard.
 *
 * In the old single-page room view, the integration URL was just
 * another field crammed into the config wall. But the URL is the
 * actual product outcome: it's how an agent enters this room. We
 * promote it to a dedicated tab + give it a step-by-step format:
 *
 *   1. Pick your agent (Cursor / Claude Code / VS Code / Other)
 *   2. Copy the MCP URL
 *   3. Paste the tool-specific config snippet
 *
 * Each step is its own visually-numbered block so a new user can
 * see exactly where they are in the flow. The snippet for each
 * agent is generated client-side from the integration URL we get
 * from `api.getRoomIntegrationConfig`.
 *
 * No backend changes required.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CheckCircle2, Copy, Plug, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { JsonHighlight } from '@/components/ui/JsonHighlight';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToolLogo } from '@/components/ui/ToolLogo';
import { useToast } from '@/components/ui/Toast';
import { useUser } from '@/lib/hooks';
import { useRoom } from '@/lib/roomContext';
import type { SessionAction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { fadeUp, staggerContainer } from '@/lib/motion';

type AgentTool = 'cursor' | 'claude-code' | 'vscode-copilot' | 'other';

const AGENTS: Array<{
  id: AgentTool;
  name: string;
  description: string;
  toolLogoId: 'cursor' | 'claude-code' | 'vscode-copilot';
}> = [
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-first code editor',
    toolLogoId: 'cursor',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's coding agent CLI",
    toolLogoId: 'claude-code',
  },
  {
    id: 'vscode-copilot',
    name: 'VS Code Copilot',
    description: 'GitHub Copilot in VS Code',
    toolLogoId: 'vscode-copilot',
  },
];

export default function RoomConnectPage() {
  const { roomId, room, loading: roomLoading } = useRoom();
  const { user } = useUser();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [integrationUrl, setIntegrationUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentTool>('cursor');
  const [copiedSection, setCopiedSection] = useState<'url' | 'config' | null>(
    null,
  );
  // Verification state — the latest run we've seen for this room's
  // repo. Null until the first fetch succeeds. We record the mount
  // time so we can highlight runs that landed AFTER the user
  // arrived on this tab (those are the "first connection" wins).
  const [latestRun, setLatestRun] = useState<SessionAction | null>(null);
  const [checking, setChecking] = useState(false);
  const mountTimeRef = useRef<number>(Date.now());

  const loadIntegrationUrl = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const config = await api.getRoomIntegrationConfig(roomId);
      setIntegrationUrl(config?.url ?? '');
    } catch (err) {
      toast.error("Couldn't load integration URL", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    void loadIntegrationUrl();
  }, [loadIntegrationUrl]);

  // Verification fetcher — pulls the latest runs and finds the most
  // recent one whose target_repo matches THIS room's repo. The
  // backend doesn't expose a per-room runs endpoint, so we filter
  // client-side. Cheap (the same call powers the Overview tab) and
  // gives us a real "did it connect?" signal without new endpoints.
  const checkConnection = useCallback(async () => {
    if (!user?.id || !room?.repo_name) return;
    setChecking(true);
    try {
      const runs = await api.getRuns(user.id);
      const match = runs.find((r) => r.target_repo === room.repo_name) ?? null;
      setLatestRun(match);
    } catch {
      /* swallow — failure is silent, manual button still works */
    } finally {
      setChecking(false);
    }
  }, [user?.id, room?.repo_name]);

  // Initial check + 8-second poll while the tab is active. The poll
  // is deliberately slow — the user just wants to know "it worked,"
  // not stream actions. The Overview tab is the live view.
  useEffect(() => {
    void checkConnection();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkConnection();
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [checkConnection]);

  // A "fresh" connection is one whose latest run landed AFTER the
  // user opened this tab — that's the moment the wiring worked.
  const justConnected = useMemo(() => {
    if (!latestRun) return false;
    return new Date(latestRun.timestamp).getTime() >= mountTimeRef.current;
  }, [latestRun]);

  // Generate the agent-specific config snippet from the integration
  // URL. Different tools want different config shapes — Cursor +
  // Claude Code expect MCP server entries; VS Code is similar. The
  // "other" branch falls back to an MCP-spec generic config that
  // any compliant tool can consume.
  const configSnippet = useMemo(() => {
    if (!integrationUrl) return '';
    const mcpEntry = {
      mcpServers: {
        aegis: {
          transport:"sse",
          url: integrationUrl,
        },
      },
    };
     
    if (selectedAgent === 'cursor' || selectedAgent === 'claude-code') {
      return JSON.stringify(mcpEntry, null, 2);
    }
    if (selectedAgent === 'vscode-copilot') {
      return JSON.stringify(
        {
          
            servers: {
           
              aegis: { 
                   type:"sse",
                url: integrationUrl },
            },
        
        },
        null,
        2,
      );
    }
    // Other / generic MCP — same shape as Cursor + Claude Code.
    return JSON.stringify(mcpEntry, null, 2);
  }, [integrationUrl, selectedAgent]);

  const copyTo = async (section: 'url' | 'config', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      window.setTimeout(() => setCopiedSection(null), 2000);
      toast.success(
        section === 'url' ? 'MCP URL copied' : 'Config copied',
        {
          description:
            section === 'url'
              ? 'Paste it into your agent settings.'
              : 'Paste this snippet into your agent settings file.',
        },
      );
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  if (roomLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[420px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        {/* Section intro */}
        <motion.div variants={fadeUp}>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
            Connect an agent
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Wire an AI coding agent into this room so its tool calls run
            through Aegis policy + audit.
          </p>
        </motion.div>

        {/* Step 1 — Pick an agent */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <StepHeader number={1} title="Pick your agent" />
          <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => {
              const active = selectedAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-[10px] border p-3 text-left',
                    'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    active
                      ? 'border-[var(--primary-base)]/40 bg-[var(--primary-alpha-10)]/40 shadow-[0_2px_6px_rgba(206,94,18,0.10)]'
                      : 'border-[var(--stroke-soft-200)] bg-white hover:border-[var(--stroke-sub-300)] hover:bg-[var(--neutral-weak-50)]',
                  )}
                  aria-pressed={active}
                >
                  <ToolLogo id={agent.toolLogoId} size={32} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-[13px] font-semibold tracking-[-0.005em]',
                        active
                          ? 'text-[var(--neutral-strong-950)]'
                          : 'text-[var(--neutral-strong-950)]',
                      )}
                    >
                      {agent.name}
                    </p>
                    <p className="text-[11px] text-[var(--neutral-soft-400)]">
                      {agent.description}
                    </p>
                  </div>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-[var(--primary-base)]"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
            {/* "Other / Generic MCP" tile — sits with the named
                agents but visually subdued so the brand-named cards
                read as primary. */}
            <button
              type="button"
              onClick={() => setSelectedAgent('other')}
              className={cn(
                'flex items-center gap-3 rounded-[10px] border p-3 text-left',
                'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                selectedAgent === 'other'
                  ? 'border-[var(--primary-base)]/40 bg-[var(--primary-alpha-10)]/40 shadow-[0_2px_6px_rgba(206,94,18,0.10)]'
                  : 'border-dashed border-[var(--stroke-sub-300)] bg-white hover:border-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)]',
              )}
            >
              {/* Canonical icon box. Neutral icon color signals
                  "catch-all / generic" vs the brand-colored ToolLogo
                  containers used for known agents in the same list. */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
                <Plug className="h-4 w-4" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                  Other MCP agent
                </p>
                <p className="text-[11px] text-[var(--neutral-soft-400)]">
                  Any MCP-compatible client
                </p>
              </div>
              {selectedAgent === 'other' && (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[var(--primary-base)]"
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
            </button>
          </div>
        </motion.section>

        {/* Step 2 — Copy the MCP URL */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <StepHeader
            number={2}
            title="Copy your MCP URL"
            subtitle="This URL routes every tool call through this room's policies."
          />
          <div className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={integrationUrl}
                readOnly
                aria-label="MCP integration URL"
                onClick={(e) => e.currentTarget.select()}
                className="h-9 flex-1 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--neutral-weak-50)] px-3 text-[11.5px] text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
              />
              <Button
                variant="secondary"
                onClick={() => copyTo('url', integrationUrl)}
                disabled={!integrationUrl}
                leadingIcon={
                  copiedSection === 'url' ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  )
                }
              >
                {copiedSection === 'url' ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Step 3 — Paste the config snippet */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <StepHeader
            number={3}
            title={`Paste this config into ${
              AGENTS.find((a) => a.id === selectedAgent)?.name ?? 'your agent'
            }`}
            subtitle={
              selectedAgent === 'cursor'
                ? 'Add this to your Cursor settings.json (Settings → MCP Servers).'
                : selectedAgent === 'claude-code'
                ? 'Add this to your Claude Code config (~/.claude/config.json).'
                : selectedAgent === 'vscode-copilot'
                ? 'Add this to your VS Code settings.json.'
                : 'Paste this MCP server entry into your agent of choice.'
            }
          />
          <div className="space-y-3 p-4">
            <div className="relative overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
              <pre className="max-h-[260px] overflow-auto p-4 text-[11.5px] leading-[1.55] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                <JsonHighlight code={configSnippet} />
              </pre>
              <button
                type="button"
                onClick={() => copyTo('config', configSnippet)}
                disabled={!configSnippet}
                aria-label="Copy config snippet"
                className={cn(
                  'absolute right-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2 text-[11px] font-medium text-[var(--neutral-sub-600)]',
                  'shadow-[var(--shadow-regular-xs)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                )}
              >
                {copiedSection === 'config' ? (
                  <>
                    <Check
                      className="h-3 w-3 text-[var(--success)]"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[11.5px] leading-[1.5] text-[var(--neutral-soft-400)]">
              Once {AGENTS.find((a) => a.id === selectedAgent)?.name ?? 'your agent'} reloads, its
              tool calls will route through this room. You&apos;ll see actions in
              the <span className="font-semibold text-[var(--neutral-sub-600)]">Overview</span> tab
              within seconds.
            </p>
          </div>
        </motion.section>

        {/* Step 4 — Verify the connection works.
            Previously the user had no feedback loop: paste config,
            then bounce between tabs hoping to see activity. This
            panel polls runs filtered to this room's repo so the
            user gets a real "did it work?" answer without leaving
            the wizard. Three states:
              • Just-connected (run after mount) → green success
              • Older activity (last run before mount) → neutral info
              • No activity → waiting pulse */}
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <StepHeader
            number={4}
            title="Verify the connection"
            subtitle="Run a single command in your agent — Aegis will pick it up here."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              {justConnected ? (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success-lighter)]"
                  aria-hidden
                >
                  <CheckCircle2
                    className="h-4 w-4 text-[var(--success)]"
                    strokeWidth={2}
                  />
                </span>
              ) : latestRun ? (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-alpha-10)]"
                  aria-hidden
                >
                  <CheckCircle2
                    className="h-4 w-4 text-[var(--primary-base)]"
                    strokeWidth={2}
                  />
                </span>
              ) : (
                // Pulsing dot — visual cue that we're listening.
                // Reduces "is this thing even doing anything?"
                // anxiety while the user wires up the agent.
                <span
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--neutral-weak-50)]"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-[var(--primary-base)]/40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--primary-base)]" />
                </span>
              )}
              <div className="min-w-0">
                {justConnected ? (
                  <>
                    <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--success)]">
                      Connected
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">
                      First action picked up{' '}
                      <RelativeTime
                        timestamp={latestRun!.timestamp}
                        className="inline"
                      />
                      {latestRun?.tool_name && (
                        <>
                          {' · '}
                          <code className="text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                            {latestRun.tool_name}
                          </code>
                        </>
                      )}
                    </p>
                  </>
                ) : latestRun ? (
                  <>
                    <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                      Last activity{' '}
                      <RelativeTime
                        timestamp={latestRun.timestamp}
                        className="inline"
                      />
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">
                      No new actions since you opened this tab. Trigger
                      one in your agent to verify it&apos;s still wired up.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                      Waiting for first action…
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">
                      Run any command in your agent. We&apos;ll detect it
                      automatically — checks every 8s.
                    </p>
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void checkConnection()}
              disabled={checking}
              leadingIcon={
                <RefreshCw
                  className={cn(
                    'h-3 w-3',
                    checking && 'animate-spin',
                  )}
                  strokeWidth={2}
                />
              }
            >
              {checking ? 'Checking…' : 'Check now'}
            </Button>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

// ─── Numbered step header ───────────────────────────────────────────
function StepHeader({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-alpha-10)] text-[11px] font-bold text-[var(--primary-base)] tabular-nums">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
