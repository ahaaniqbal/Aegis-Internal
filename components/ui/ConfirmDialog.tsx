'use client';

/**
 * ConfirmDialog — small modal for destructive / irreversible actions.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   const [pending, setPending] = useState(false);
 *
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete API key?"
 *     description="This action cannot be undone. The key will stop working immediately."
 *     confirmLabel="Delete key"
 *     variant="danger"
 *     loading={pending}
 *     onConfirm={async () => {
 *       setPending(true);
 *       try { await api.deleteKey(id); setOpen(false); }
 *       finally { setPending(false); }
 *     }}
 *   />
 *
 * Design intent: prevent destructive misclicks without nagging. Cancel
 * is the default (focus + Escape). Confirm button is `danger` variant
 * in red so it reads as "you are about to do something serious."
 * Keyboard: Escape cancels, Enter confirms (only when the button has
 * focus, which matches native HTML form behavior).
 */

import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` shows a red confirm button; `primary` shows the brand orange one. */
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const reduce = useReducedMotion();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on open (safer default — accidental Enter
  // hits Cancel, not the destructive action).
  useEffect(() => {
    if (open) {
      // Slight delay so the focus lands after the modal mounts.
      const id = window.setTimeout(() => cancelRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onOpenChange]);

  const handleConfirm = useCallback(() => {
    if (loading) return;
    void onConfirm();
  }, [loading, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            initial={reduce ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_EMPH }}
            onClick={() => !loading && onOpenChange(false)}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[71] flex items-center justify-center px-4">
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-description"
              className="pointer-events-auto w-full max-w-[420px] rounded-[14px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14 } }
              }
              transition={{ duration: 0.2, ease: EASE_EMPH }}
            >
              <h2
                id="confirm-dialog-title"
                className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--neutral-strong-950)]"
              >
                {title}
              </h2>
              <div
                id="confirm-dialog-description"
                className="mt-2 text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]"
              >
                {description}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  ref={cancelRef}
                  variant="secondary"
                  size="md"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={variant === 'danger' ? 'danger' : 'primary'}
                  size="md"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? 'Working…' : confirmLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
