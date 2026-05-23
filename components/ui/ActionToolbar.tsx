'use client';

/**
 * ActionToolbar — surfaces Layer 5 of the Aegis control plane (Actions)
 * directly on run + session detail rows. Real-time interventions:
 *
 *   Pause agent       — freeze the agent's MCP endpoint immediately
 *                       so no further actions execute until released.
 *   Scope-down        — narrow this room's tool allowlist on the fly
 *                       (e.g. revoke write tools while we investigate).
 *   Rollback action   — reverse a completed action where possible
 *                       (delete the PR, restore the deleted record).
 *   Escalate          — route this action's session to the on-call
 *                       human even if no policy required approval.
 *
 * Today these are demo-mocked — clicking emits a toast that previews
 * the action's effect. The wiring abstraction is real; backend hookup
 * lands in the next sprint (each handler maps to a future POST
 * /api/{action} call with the run/session id).
 *
 * Visually compact (h-7 buttons) so this sits inside expanded rows
 * without overwhelming the existing detail content.
 */

import { useState } from 'react';
import {
  PauseCircle,
  RotateCcw,
  Scissors,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type ActionKind = 'pause' | 'scope-down' | 'rollback' | 'escalate';

interface ActionConfig {
  kind: ActionKind;
  label: string;
  icon: LucideIcon;
  toneVar: string;
  tooltip: string;
  /** True for irreversible / loud actions — opens a ConfirmDialog. */
  destructive?: boolean;
  /** Toast copy shown on confirmed click. */
  toast: { title: string; description: string };
}

const ACTIONS: ActionConfig[] = [
  {
    kind: 'pause',
    label: 'Pause agent',
    icon: PauseCircle,
    toneVar: 'var(--warning)',
    tooltip: "Freeze this agent's MCP endpoint until manually resumed",
    destructive: true,
    toast: {
      title: 'Agent paused',
      description:
        'No further actions will execute on this session until you resume. Preview action; backend wiring lands in the next release.',
    },
  },
  {
    kind: 'scope-down',
    label: 'Scope down',
    icon: Scissors,
    toneVar: 'var(--feature)',
    tooltip: "Narrow this room's tool allowlist on the fly",
    destructive: false,
    toast: {
      title: 'Scope reduced',
      description:
        'Write and destructive tools revoked for this room. Preview action; backend wiring lands in the next release.',
    },
  },
  {
    kind: 'rollback',
    label: 'Rollback',
    icon: RotateCcw,
    toneVar: 'var(--error)',
    tooltip: 'Reverse this action where possible (close PR, restore record)',
    destructive: true,
    toast: {
      title: 'Rollback queued',
      description:
        'Where reversible, this action will be undone. Preview action; backend wiring lands in the next release.',
    },
  },
  {
    kind: 'escalate',
    label: 'Escalate',
    icon: Send,
    toneVar: 'var(--primary-base)',
    tooltip: 'Route this session to the on-call human even if no policy required approval',
    destructive: false,
    toast: {
      title: 'Escalated to on-call',
      description:
        'A page has been sent to the on-call rotation. Preview action; backend wiring lands in the next release.',
    },
  },
];

interface ActionToolbarProps {
  /** What this action targets (a run id or a session id). Used in the
   *  toast confirmation copy. */
  targetLabel?: string;
  /** Which actions to show. Default: all 4. Pass a subset to render
   *  fewer buttons on a constrained surface. */
  show?: ActionKind[];
  className?: string;
}

export function ActionToolbar({
  targetLabel,
  show,
  className,
}: ActionToolbarProps) {
  const toast = useToast();
  const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null);
  const visible = show
    ? ACTIONS.filter((a) => show.includes(a.kind))
    : ACTIONS;

  const handleClick = (action: ActionConfig) => {
    if (action.destructive) {
      setConfirmAction(action);
    } else {
      toast.push(action.toast.title, {
        description: action.toast.description,
        variant: 'info',
      });
    }
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    toast.push(confirmAction.toast.title, {
      description: confirmAction.toast.description,
      variant: 'warning',
    });
    setConfirmAction(null);
  };

  return (
    <>
      <div className={['flex flex-wrap items-center gap-2', className ?? ''].join(' ')}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
          Actions
        </span>
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.kind} content={action.tooltip} side="top" delayMs={300}>
              <button
                type="button"
                onClick={() => handleClick(action)}
                className="group inline-flex h-7 items-center gap-1.5 rounded-[7px] border bg-white px-2.5 text-[12px] font-medium transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(23,23,23,0.06)] active:translate-y-0 active:shadow-[0_1px_1px_rgba(23,23,23,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
                style={{
                  borderColor: 'var(--stroke-sub-300)',
                  color: 'var(--neutral-sub-600)',
                }}
                onMouseEnter={(e) => {
                  // Tone-tinted border on hover. Done inline (not via
                  // className) so each button picks up its own
                  // action.toneVar without needing 4 className branches.
                  e.currentTarget.style.borderColor = action.toneVar;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--stroke-sub-300)';
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110"
                  style={{ color: action.toneVar }}
                  strokeWidth={2}
                />
                <span className="transition-colors duration-150 group-hover:text-[var(--neutral-strong-950)]">
                  {action.label}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmAction(null); }}
          variant={
            confirmAction.kind === 'rollback' || confirmAction.kind === 'pause'
              ? 'danger'
              : 'primary'
          }
          title={`${confirmAction.label}?`}
          description={
            <>
              {confirmAction.kind === 'pause' &&
                `Pause the agent on this session${targetLabel ? ` (${targetLabel})` : ''}? No further actions will execute until you manually resume.`}
              {confirmAction.kind === 'rollback' &&
                `Reverse this action where possible? Some side-effects (sent Slack messages, deployed CI workflows) cannot be fully undone.`}
            </>
          }
          confirmLabel={confirmAction.label}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
