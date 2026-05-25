'use client';

/**
 * Kill Switches — emergency governance controls.
 *
 * Five controls live in Settings → Security and any active one renders
 * as a persistent amber banner at the top of every dashboard page so
 * the user can't forget that enforcement is paused.
 *
 * State is held in localStorage (`aegis_kill_switches`) so it survives
 * navigation + reloads in the demo. In production this would be a
 * server-side flag stored per workspace.
 *
 * The five controls (each gated by a ConfirmDialog):
 *   1. Pause one specific agent
 *   2. Disable one specific tool across all rooms
 *   3. Block all WRITE actions org-wide (toggle)
 *   4. Block all PRODUCTION-tier actions org-wide (toggle)
 *   5. EMERGENCY: pause all agents (single button)
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock, Pause, ShieldOff, Zap, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { IconMark } from '@/components/ui/IconMark';
import { useToast } from '@/components/ui/Toast';

// ─── State ──────────────────────────────────────────────────────────────────

interface KillSwitchState {
  pausedAgents: string[];          // agent names
  disabledTools: string[];         // tool names
  blockAllWrites: boolean;
  blockAllProduction: boolean;
  readOnlyMode: boolean;           // all writes blocked, reads unrestricted
  emergencyPauseAll: boolean;
}

const EMPTY_STATE: KillSwitchState = {
  pausedAgents: [],
  disabledTools: [],
  blockAllWrites: false,
  blockAllProduction: false,
  readOnlyMode: false,
  emergencyPauseAll: false,
};

const STORAGE_KEY = 'aegis_kill_switches';

function readState(): KillSwitchState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(s: KillSwitchState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event('aegis-kill-switches-changed'));
  } catch {
    // Quota or disabled storage — ignore in demo.
  }
}

export function useKillSwitches(): [KillSwitchState, (next: KillSwitchState) => void] {
  const [state, setState] = useState<KillSwitchState>(EMPTY_STATE);
  useEffect(() => {
    setState(readState());
    const handler = () => setState(readState());
    window.addEventListener('aegis-kill-switches-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('aegis-kill-switches-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  const setAndPersist = useCallback((next: KillSwitchState) => {
    setState(next);
    writeState(next);
  }, []);
  return [state, setAndPersist];
}

// ─── Active banner — mounted in dashboard layout ────────────────────────────

export function KillSwitchBanner() {
  const [state, setState] = useKillSwitches();
  const activeItems: { label: string; clear: () => void }[] = [];

  if (state.emergencyPauseAll) {
    activeItems.push({
      label: 'All agents are paused org-wide (emergency).',
      clear: () => setState({ ...state, emergencyPauseAll: false }),
    });
  }
  if (state.blockAllWrites) {
    activeItems.push({
      label: 'Write actions are blocked org-wide.',
      clear: () => setState({ ...state, blockAllWrites: false }),
    });
  }
  if (state.blockAllProduction) {
    activeItems.push({
      label: 'Production-tier actions are blocked org-wide.',
      clear: () => setState({ ...state, blockAllProduction: false }),
    });
  }
  if (state.readOnlyMode) {
    activeItems.push({
      label: 'Workspace is in read-only mode org-wide.',
      clear: () => setState({ ...state, readOnlyMode: false }),
    });
  }
  if (state.pausedAgents.length > 0) {
    activeItems.push({
      label: `${state.pausedAgents.length} ${state.pausedAgents.length === 1 ? 'agent is' : 'agents are'} paused: ${state.pausedAgents.join(', ')}.`,
      clear: () => setState({ ...state, pausedAgents: [] }),
    });
  }
  if (state.disabledTools.length > 0) {
    activeItems.push({
      label: `${state.disabledTools.length} ${state.disabledTools.length === 1 ? 'tool is' : 'tools are'} disabled: ${state.disabledTools.join(', ')}.`,
      clear: () => setState({ ...state, disabledTools: [] }),
    });
  }

  if (activeItems.length === 0) return null;

  return (
    <div
      role="alert"
      className="border-b px-4 py-2.5 sm:px-6 lg:px-8"
      style={{
        backgroundColor: 'rgba(246, 181, 30, 0.10)',
        borderColor: 'rgba(246, 181, 30, 0.40)',
      }}
    >
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 2xl:max-w-[1480px]">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: 'var(--warning-dark)' }}
            strokeWidth={2.25}
          />
          <span className="text-[12px] font-medium leading-[1.45] text-[var(--neutral-strong-950)]">
            <span
              className="mr-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--warning-dark)' }}
            >
              Kill switch active
            </span>
            {activeItems.map((item, i) => (
              <span key={i} className="mr-3">
                {item.label}
              </span>
            ))}
          </span>
        </div>
        <Link
          href="/dashboard/settings#security"
          className="shrink-0 text-[11.5px] font-semibold text-[var(--warning-dark)] hover:underline"
        >
          Lift restriction →
        </Link>
      </div>
    </div>
  );
}

// ─── Settings section ───────────────────────────────────────────────────────

const AVAILABLE_AGENTS = [
  'claude-code',
  'cursor-agent',
  'gpt-4o',
  'codex',
  'devin',
  'aider',
  'github-copilot',
  'replit-agent',
];

const AVAILABLE_TOOLS = [
  'push_files',
  'create_pull_request',
  'merge_pull_request',
  'delete_branch',
  'terraform_apply',
  'terraform_destroy',
  'kubectl_apply',
  'list_secrets',
];

type PendingDialog =
  | { kind: 'pause_agent'; agent: string }
  | { kind: 'disable_tool'; tool: string }
  | { kind: 'block_writes' }
  | { kind: 'block_production' }
  | { kind: 'read_only_mode' }
  | { kind: 'emergency_pause_all' }
  | null;

export function KillSwitchesSection() {
  const [state, setState] = useKillSwitches();
  const toast = useToast();
  const [pending, setPending] = useState<PendingDialog>(null);
  const [agentChoice, setAgentChoice] = useState(AVAILABLE_AGENTS[0]);
  const [toolChoice, setToolChoice] = useState(AVAILABLE_TOOLS[0]);

  const confirm = () => {
    if (!pending) return;
    switch (pending.kind) {
      case 'pause_agent': {
        if (!state.pausedAgents.includes(pending.agent)) {
          setState({ ...state, pausedAgents: [...state.pausedAgents, pending.agent] });
          toast.success(`Agent paused: ${pending.agent}`, {
            description: 'All in-flight tool calls from this agent will block until resumed.',
          });
        }
        break;
      }
      case 'disable_tool': {
        if (!state.disabledTools.includes(pending.tool)) {
          setState({ ...state, disabledTools: [...state.disabledTools, pending.tool] });
          toast.success(`Tool disabled org-wide: ${pending.tool}`, {
            description: 'No agent can call this tool until it is re-enabled.',
          });
        }
        break;
      }
      case 'block_writes':
        setState({ ...state, blockAllWrites: !state.blockAllWrites });
        toast.success(state.blockAllWrites ? 'Write block lifted' : 'Write actions blocked org-wide', {
          description: state.blockAllWrites
            ? 'Agents can write again.'
            : 'Every write action will be blocked until lifted.',
        });
        break;
      case 'block_production':
        setState({ ...state, blockAllProduction: !state.blockAllProduction });
        toast.success(state.blockAllProduction ? 'Production block lifted' : 'Production actions blocked org-wide', {
          description: state.blockAllProduction
            ? 'Production-tier writes resumed.'
            : 'Every action targeting production will be blocked.',
        });
        break;
      case 'read_only_mode':
        setState({ ...state, readOnlyMode: !state.readOnlyMode });
        toast.success(state.readOnlyMode ? 'Read-only mode lifted' : 'Workspace in read-only mode', {
          description: state.readOnlyMode
            ? 'Writes are allowed again.'
            : 'Every write action will be blocked org-wide. Reads still pass.',
        });
        break;
      case 'emergency_pause_all':
        setState({ ...state, emergencyPauseAll: !state.emergencyPauseAll });
        toast.success(state.emergencyPauseAll ? 'Emergency pause lifted' : 'EMERGENCY: All agents paused', {
          description: state.emergencyPauseAll
            ? 'All agents are resuming.'
            : 'No agent can execute any tool call until the emergency is lifted.',
        });
        break;
    }
    setPending(null);
  };

  return (
    <section className="mb-5 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <header className="flex items-start gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-4">
        <IconMark icon={Zap} color="var(--error)" strokeWidth={2.25} />
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            Kill switches
          </h3>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Emergency controls. Each switch is gated by a confirm dialog. Active switches show as an amber banner on every dashboard page.
          </p>
        </div>
      </header>

      <div className="divide-y divide-[var(--stroke-soft-200)]">
        {/* 1. Pause one agent */}
        <SwitchRow
          icon={Pause}
          title="Pause one agent"
          description="Block all tool calls from a specific agent. The agent stays connected; calls 503 until resumed."
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={agentChoice}
              onChange={(e) => setAgentChoice(e.target.value)}
              className="h-9 rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-2.5 font-mono text-[12px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-24)]"
            >
              {AVAILABLE_AGENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => setPending({ kind: 'pause_agent', agent: agentChoice })}
              disabled={state.pausedAgents.includes(agentChoice)}
            >
              {state.pausedAgents.includes(agentChoice) ? 'Already paused' : 'Pause agent'}
            </Button>
          </div>
        </SwitchRow>

        {/* 2. Disable one tool */}
        <SwitchRow
          icon={ShieldOff}
          title="Disable one tool"
          description="Block a specific tool across every room and every agent."
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={toolChoice}
              onChange={(e) => setToolChoice(e.target.value)}
              className="h-9 rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-2.5 font-mono text-[12px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-24)]"
            >
              {AVAILABLE_TOOLS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => setPending({ kind: 'disable_tool', tool: toolChoice })}
              disabled={state.disabledTools.includes(toolChoice)}
            >
              {state.disabledTools.includes(toolChoice) ? 'Already disabled' : 'Disable tool'}
            </Button>
          </div>
        </SwitchRow>

        {/* 3. Block all writes */}
        <SwitchRow
          icon={Lock}
          title="Block all writes org-wide"
          description="Every write tool (push, merge, terraform apply, kubectl apply) returns DENY until lifted."
        >
          <Toggle
            active={state.blockAllWrites}
            onClick={() => setPending({ kind: 'block_writes' })}
          />
        </SwitchRow>

        {/* 4. Block all production */}
        <SwitchRow
          icon={Lock}
          title="Block all production-tier actions"
          description="Block every action targeting production environments (anything with env_tier=production)."
        >
          <Toggle
            active={state.blockAllProduction}
            onClick={() => setPending({ kind: 'block_production' })}
          />
        </SwitchRow>

        {/* 5. Read-only mode org-wide */}
        <SwitchRow
          icon={Lock}
          title="Enter read-only mode org-wide"
          description="All writes blocked. Reads pass through unrestricted. Use when you need agents to keep gathering context without changing anything."
        >
          <Toggle
            active={state.readOnlyMode}
            onClick={() => setPending({ kind: 'read_only_mode' })}
          />
        </SwitchRow>

        {/* 6. Emergency pause all */}
        <div
          className="px-5 py-4"
          style={{ backgroundColor: 'rgba(251, 55, 72, 0.04)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <IconMark icon={AlertTriangle} color="var(--error)" strokeWidth={2.25} />
              <div>
                <p className="text-[13px] font-semibold text-[var(--error)]">
                  Emergency: pause every agent
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  Single button. Every agent, every tool, every room. Use when you don't have time to think.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              onClick={() => setPending({ kind: 'emergency_pause_all' })}
            >
              {state.emergencyPauseAll ? 'Lift emergency pause' : 'EMERGENCY: pause all'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={dialogTitle(pending, state)}
        description={dialogDescription(pending, state)}
        confirmLabel={dialogConfirm(pending, state)}
        cancelLabel="Cancel"
        variant={dialogVariant(pending)}
        onConfirm={confirm}
      />
    </section>
  );
}

function dialogTitle(p: PendingDialog, s: KillSwitchState): string {
  if (!p) return '';
  switch (p.kind) {
    case 'pause_agent': return `Pause agent ${p.agent}?`;
    case 'disable_tool': return `Disable tool ${p.tool} org-wide?`;
    case 'block_writes': return s.blockAllWrites ? 'Lift the write block?' : 'Block ALL writes org-wide?';
    case 'block_production': return s.blockAllProduction ? 'Lift the production block?' : 'Block ALL production actions?';
    case 'read_only_mode': return s.readOnlyMode ? 'Lift read-only mode?' : 'Enter read-only mode org-wide?';
    case 'emergency_pause_all': return s.emergencyPauseAll ? 'Lift the emergency pause?' : 'Pause EVERY agent now?';
  }
}

function dialogDescription(p: PendingDialog, s: KillSwitchState): string {
  if (!p) return '';
  switch (p.kind) {
    case 'pause_agent': return `${p.agent} will stop executing tool calls immediately. In-flight calls return 503. Resume from this same panel.`;
    case 'disable_tool': return `Every agent loses access to ${p.tool} across every room until you re-enable it.`;
    case 'block_writes': return s.blockAllWrites ? 'Agents will be allowed to perform write actions again.' : 'Every write tool call will be denied org-wide. Reads still pass. Use during incidents.';
    case 'block_production': return s.blockAllProduction ? 'Production-tier actions resume.' : 'Every action targeting production environments will be denied. Staging and dev still pass.';
    case 'read_only_mode': return s.readOnlyMode ? 'Writes resume across the workspace.' : 'Every write tool call denied org-wide. Reads still pass. Use when you need agents to keep observing.';
    case 'emergency_pause_all': return s.emergencyPauseAll ? 'All agents resume execution.' : 'Every agent, every tool, every room: blocked. Use only when something is actively going wrong.';
  }
}

function dialogConfirm(p: PendingDialog, s: KillSwitchState): string {
  if (!p) return 'Confirm';
  switch (p.kind) {
    case 'pause_agent': return 'Pause agent';
    case 'disable_tool': return 'Disable tool';
    case 'block_writes': return s.blockAllWrites ? 'Lift block' : 'Block writes';
    case 'block_production': return s.blockAllProduction ? 'Lift block' : 'Block production';
    case 'read_only_mode': return s.readOnlyMode ? 'Lift read-only' : 'Enter read-only';
    case 'emergency_pause_all': return s.emergencyPauseAll ? 'Lift pause' : 'Pause all agents';
  }
}

function dialogVariant(p: PendingDialog): 'danger' | 'primary' {
  if (!p) return 'danger';
  if (p.kind === 'pause_agent' || p.kind === 'disable_tool') return 'primary';
  return 'danger';
}

function SwitchRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-sub-600)]"
          strokeWidth={2}
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={active}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
      style={{ backgroundColor: active ? 'var(--error)' : 'var(--stroke-sub-300)' }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: active ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}
