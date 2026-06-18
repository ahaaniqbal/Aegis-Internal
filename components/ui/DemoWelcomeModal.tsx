'use client';

/**
 * Welcome modal — first-visit choice between demo workspace and
 * empty real workspace.
 *
 * Shown by DashboardLayout when localStorage.aegis_demo === null
 * (i.e. the user has never picked). After they choose, the flag is
 * persisted and the modal never reappears.
 *
 * Why a modal instead of silent default-on:
 *   • Default-on without explanation was confusing — users saw
 *     pre-populated data and assumed it was their account.
 *   • An explicit choice teaches the model: "demo is a thing you
 *     can switch into, not a default state."
 *   • Removes the need for a permanent banner — the modal IS the
 *     introduction; after that, the WorkspaceSwitcher carries the
 *     load.
 *
 * Two visual variants of the option cards mirror what they'll see
 * after picking:
 *   • Demo card → branded orange, Sparkles, "see what this looks
 *     like populated"
 *   • Empty card → neutral, user-initial avatar, "start fresh"
 *
 * Reload semantics: picking "demo" triggers a reload so the mock
 * layer in lib/preview-data.ts can monkey-patch the api singleton
 * cleanly (it's irreversible within a single page session). Picking
 * "empty" just dismisses — no reload needed since we don't install
 * any mocks.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { cn } from '@/lib/utils';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface DemoWelcomeModalProps {
  open: boolean;
  /** Called after the user picks demo (parent should reload). */
  onPickDemo: () => void;
  /** Called after the user picks the empty/real workspace. */
  onPickEmpty: () => void;
}

export function DemoWelcomeModal({
  open,
  onPickDemo,
  onPickEmpty,
}: DemoWelcomeModalProps) {
  const { user } = useUser();
  const reduce = useReducedMotion();

  // Lock body scroll while the modal is open so the page underneath
  // doesn't drift behind the dim layer. Restores on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dimmed backdrop. Click does nothing — the user has to
              make an explicit choice. This is one of the few places
              where a modal is genuinely modal (no escape hatch). */}
          <motion.div
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_EMPH }}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-[91] flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-welcome-title"
          >
            <motion.div
              className="w-full max-w-[520px] overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_24px_72px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.14 } }
              }
              transition={{ duration: 0.22, ease: EASE_EMPH }}
            >
              {/* Header — brand mark + welcome line. Tight rhythm
                  so the option cards below get most of the visual
                  weight (they're the actual decision). */}
              <div className="px-7 pt-7">
                <div className="mb-6 flex items-center gap-2.5 text-[var(--neutral-strong-950)]">
                  <AegisLogo style={{ height: 20, width: 'auto' }} />
                </div>
                <h2
                  id="demo-welcome-title"
                  className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--neutral-strong-950)]"
                >
                  Welcome to Aegis
                  {user?.username && user.username !== 'demo' ? `, ${user.username}` : ''}.
                </h2>
                <p className="mt-2 text-[14px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  How would you like to start? You can switch between these
                  any time from the workspace menu.
                </p>
              </div>

              {/* Two stacked option cards. The demo card is the
                  recommended path (primary visual weight) — most
                  new users benefit from seeing what populated looks
                  like before wiring up their first agent.

                  Both icons are GenerativeAvatar (Bayer dither
                  pattern) so the modal previews the exact identity
                  marks the user will see in the WorkspaceSwitcher
                  after picking. Same seeds + variants used there:
                    Demo  → seed="aegis-demo-workspace", variant="demo"
                            (locks to brand orange palette)
                    User  → seed=username, variant="user"
                            (seed picks one of the curated palettes) */}
              <div className="space-y-2.5 p-5 pb-6">
                <OptionCard
                  icon={
                    <GenerativeAvatar
                      seed="aegis-demo-workspace"
                      variant="demo"
                      size={40}
                      radius={10}
                    />
                  }
                  title="Take a tour with demo data"
                  description="Explore a fully-populated Aegis with sample runs, approvals, and policies. Nothing is real — perfect for getting the feel."
                  cta="Show me the demo"
                  recommended
                  onClick={onPickDemo}
                />
                <OptionCard
                  icon={
                    <GenerativeAvatar
                      seed={user?.username || user?.email || 'workspace'}
                      variant="user"
                      size={40}
                      radius={10}
                    />
                  }
                  title="Start with my workspace"
                  description="Skip the demo and go straight to your empty dashboard. Connect your first agent to start seeing real activity."
                  cta="Take me to my dashboard"
                  onClick={onPickEmpty}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  recommended?: boolean;
  onClick: () => void;
}

function OptionCard({
  icon,
  title,
  description,
  cta,
  recommended,
  onClick,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-3.5 rounded-[12px] border p-4 text-left',
        // Smooth hover treatment: in addition to the border/bg shift,
        // lift the card 1px and add a subtle shadow so the response
        // feels physical, not flat. duration-200 with the
        // emphasized-decelerate curve matches the rest of the
        // dashboard's motion language.
        'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'shadow-[0_1px_2px_rgba(23,23,23,0)]',
        'hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(23,23,23,0.06)]',
        // Recommended card: subtle orange tint + stronger hover lift,
        // so the eye lands here first. The non-recommended card stays
        // pure neutral so the choice doesn't feel coerced — both are
        // legitimate paths.
        recommended
          ? 'border-[var(--primary-base)]/30 bg-[var(--primary-alpha-10)]/40 hover:border-[var(--primary-base)]/60 hover:bg-[var(--primary-alpha-10)]/70'
          : 'border-[var(--stroke-soft-200)] hover:border-[var(--stroke-sub-300)] hover:bg-[var(--neutral-weak-50)]',
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[15px] font-semibold text-[var(--neutral-strong-950)]">
            {title}
          </p>
          {recommended && (
            <span className="rounded-[4px] bg-[var(--primary-base)]/12 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--primary-base)]">
              Recommended
            </span>
          )}
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
          {description}
        </p>
        <div
          className={cn(
            'mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold',
            recommended
              ? 'text-[var(--primary-base)]'
              : 'text-[var(--neutral-strong-950)]',
          )}
        >
          {cta}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
      </div>
    </button>
  );
}
