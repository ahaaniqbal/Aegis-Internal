'use client';

/**
 * MCP Server Registry — `/dashboard/mcp-servers`.
 *
 * Every MCP server connected to the workspace. The "control plane" claim
 * lives or dies on this table: it has to read like a unified registry,
 * not a coming-soon roadmap.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Plus, AlertTriangle, MoreHorizontal } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ConnectorIcon, type ConnectorId } from '@/components/ui/ConnectorMark';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type Status = 'active' | 'in_progress' | 'coming_soon';

interface ServerRow {
  name: string;
  connector: ConnectorId | null;
  owner: string;
  tools: number;
  status: Status;
  policyCoverage: number; // 0-100
  errorRate: number | null;
  lastActivity: string | null;
  custom?: boolean;
}

const SERVERS: ServerRow[] = [
  { name: 'GitHub MCP',         connector: 'github',         owner: 'Aegis (official)', tools: 26, status: 'active',        policyCoverage: 100, errorRate: 0.2,  lastActivity: '1m ago' },
  { name: 'Slack MCP',          connector: 'slack',          owner: 'Aegis (official)', tools:  8, status: 'in_progress',   policyCoverage:  62, errorRate: null, lastActivity: null    },
  { name: 'Linear MCP',         connector: 'linear',         owner: 'Community',        tools: 12, status: 'coming_soon',   policyCoverage:   0, errorRate: null, lastActivity: null    },
  { name: 'Jira MCP',           connector: null,             owner: 'Atlassian',        tools: 18, status: 'coming_soon',   policyCoverage:   0, errorRate: null, lastActivity: null    },
  { name: 'GitHub Actions MCP', connector: 'github-actions', owner: 'Community',        tools:  9, status: 'coming_soon',   policyCoverage:   0, errorRate: null, lastActivity: null    },
  { name: 'Terraform Cloud MCP', connector: 'terraform',     owner: 'HashiCorp',        tools: 11, status: 'coming_soon',   policyCoverage:   0, errorRate: null, lastActivity: null    },
  { name: 'PostgreSQL MCP',     connector: 'postgres',       owner: 'Community',        tools: 14, status: 'coming_soon',   policyCoverage:   0, errorRate: null, lastActivity: null    },
  { name: 'Custom MCP Server',  connector: null,             owner: 'ahaaniqbal',       tools:  6, status: 'active',        policyCoverage:  33, errorRate: 1.8,  lastActivity: '3h ago', custom: true },
];

const STATUS_TONE: Record<Status, { label: string; color: string; bg: string }> = {
  active:        { label: 'ACTIVE',        color: 'var(--success)',      bg: 'rgba(31, 193, 107, 0.12)' },
  in_progress:   { label: 'IN PROGRESS',   color: 'var(--warning-dark)', bg: 'rgba(246, 181, 30, 0.14)' },
  coming_soon:   { label: 'COMING SOON',   color: 'var(--neutral-soft-400)', bg: 'var(--neutral-weak-50)' },
};

export default function MCPServersPage() {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [registerOpen, setRegisterOpen] = useState(false);

  const lowCoverageServer = SERVERS.find((s) => s.status === 'active' && s.policyCoverage < 50);

  return (
    <>
      <Topbar
        title="MCP Servers"
        subtitle="Every MCP server connected to your workspace"
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-4"
        >
          {/* Warning banner for low policy coverage */}
          {lowCoverageServer && (
            <motion.div
              variants={fadeUp}
              className="flex items-start justify-between gap-3 rounded-[10px] border px-4 py-3"
              style={{
                backgroundColor: 'rgba(246, 181, 30, 0.10)',
                borderColor: 'rgba(246, 181, 30, 0.36)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: 'var(--warning-dark)' }}
                  strokeWidth={2.25}
                />
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                    1 MCP server has low policy coverage
                  </p>
                  <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Tool calls from <code className="font-mono">{lowCoverageServer.name}</code> may be ungoverned.
                    {' '}<a href="/dashboard/policies" className="font-medium text-[var(--warning-dark)] hover:underline">Review policies →</a>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Header + register button */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
              {SERVERS.filter((s) => s.status === 'active').length} active ·{' '}
              {SERVERS.filter((s) => s.status === 'in_progress').length} in progress ·{' '}
              {SERVERS.filter((s) => s.status === 'coming_soon').length} coming soon
            </p>
            <Button
              variant="primary"
              leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
              onClick={() => setRegisterOpen(true)}
            >
              Register MCP server
            </Button>
          </motion.div>

          {/* Table */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                    <th className="px-5 py-2.5">Server</th>
                    <th className="px-3 py-2.5">Owner</th>
                    <th className="px-3 py-2.5">Tools</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Policy coverage</th>
                    <th className="px-3 py-2.5">Error rate</th>
                    <th className="px-3 py-2.5">Last activity</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                  {SERVERS.map((s) => {
                    const tone = STATUS_TONE[s.status];
                    const coverageColor =
                      s.policyCoverage >= 90 ? 'var(--success)'
                      : s.policyCoverage >= 50 ? 'var(--warning-dark)'
                      : s.policyCoverage > 0  ? 'var(--error)'
                      : 'var(--neutral-soft-400)';
                    return (
                      <tr key={s.name} className="hover:bg-[var(--neutral-weak-50)] transition-colors">
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2">
                            {s.connector && <ConnectorIcon id={s.connector} size={14} />}
                            <span className="font-semibold text-[var(--neutral-strong-950)]">
                              {s.name}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--neutral-sub-600)]">{s.owner}</td>
                        <td className="px-3 py-3 font-mono tabular-nums text-[var(--neutral-strong-950)]">{s.tools}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                            style={{ backgroundColor: tone.bg, color: tone.color }}
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: tone.color }}
                            />
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2">
                            {s.policyCoverage > 0 && s.policyCoverage < 50 && (
                              <AlertTriangle
                                className="h-3 w-3"
                                style={{ color: 'var(--error)' }}
                                strokeWidth={2.25}
                              />
                            )}
                            <span
                              className="font-mono font-semibold tabular-nums"
                              style={{ color: coverageColor }}
                            >
                              {s.policyCoverage}%
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-[var(--neutral-sub-600)]">
                          {s.errorRate != null ? `${s.errorRate}%` : '—'}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11.5px] text-[var(--neutral-sub-600)]">
                          {s.lastActivity ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {s.status === 'active' ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                onClick={() => toast.success(`${s.name} configuration opened`)}
                                className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2.5 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                              >
                                Configure
                              </button>
                              {s.custom && (
                                <button
                                  aria-label="More"
                                  className="rounded-[6px] p-1 text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
                                </button>
                              )}
                            </span>
                          ) : s.status === 'in_progress' ? (
                            <button
                              disabled
                              className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--neutral-soft-400)]"
                              title="Ships this sprint"
                            >
                              Configure
                            </button>
                          ) : (
                            <a
                              href="https://docs.runaegis.co"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
                            >
                              View docs →
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.section>
        </motion.div>
      </div>

      {/* Register modal — uses ConfirmDialog as a minimal shell. The
          fields are sketch-level since this is demo-only and the server
          registration flow lands when the backend ships. */}
      <ConfirmDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        title="Register an MCP server"
        description={
          <div className="space-y-3 text-[13px] text-[var(--neutral-sub-600)]">
            <p>
              Wire a new MCP server into Aegis. Once registered, every tool call from connected agents passes through the Contextual Intelligence Layer before reaching the server.
            </p>
            <ul className="space-y-2 text-[12.5px]">
              <li>1. Server name (e.g. "Internal SRE MCP")</li>
              <li>2. SSE endpoint URL (e.g. <code className="font-mono">https://mcp.internal.company.com/sse</code>)</li>
              <li>3. Description (one-liner for the registry)</li>
              <li>4. Owner (Aegis-managed identity OR external)</li>
            </ul>
            <p className="text-[11.5px] text-[var(--neutral-soft-400)]">
              Full registration flow with authentication ships in the next sprint. Reach out at ahaan@runaegis.co for early access.
            </p>
          </div>
        }
        confirmLabel="Got it"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setRegisterOpen(false);
          toast.success('Registration form coming soon', {
            description: 'Email ahaan@runaegis.co to register a custom MCP server in the meantime.',
          });
        }}
      />
    </>
  );
}
