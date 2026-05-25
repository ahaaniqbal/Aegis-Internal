'use client';

/**
 * Compliance — `/dashboard/compliance`.
 *
 * The SOC 2 / ISO 27001 / HIPAA evidence surface. Maps every Aegis
 * policy to the change-management and access-control controls it
 * satisfies, exports auditor-ready evidence packs, manages retention
 * and scheduled exports.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  FileText,
  Calendar,
  Plus,
  Mail,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconMark } from '@/components/ui/IconMark';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, staggerContainer } from '@/lib/motion';

interface EvidencePack {
  title: string;
  badge: 'AVAILABLE' | 'PRO';
  controls: string[];
  description: string;
}

const PACKS: EvidencePack[] = [
  {
    title: 'SOC 2 Type II',
    badge: 'AVAILABLE',
    controls: ['CC6.1 — Logical access', 'CC6.2 — Access provisioning', 'CC7.2 — System monitoring', 'CC8.1 — Change management'],
    description: 'Auditor-ready PDF mapping every governance decision to the relevant change-management and logical-access controls.',
  },
  {
    title: 'ISO 27001',
    badge: 'AVAILABLE',
    controls: ['A.12.1 — Operational procedures', 'A.12.4 — Logging', 'A.12.6 — Technical vulnerability management'],
    description: 'Maps Aegis policy activity to the Annex A controls auditors look for during an ISO 27001 certification.',
  },
  {
    title: 'HIPAA',
    badge: 'PRO',
    controls: ['§164.312(b) — Audit controls', '§164.312(d) — Authentication'],
    description: 'For engineering teams operating on systems that touch PHI. Maps audit events to the HIPAA technical safeguards.',
  },
];

const CONTROL_MAPPING = [
  { policy: 'Protected Branch Denial',     controls: 'CC8.1 — Change Management' },
  { policy: 'Mandatory PR Flow',           controls: 'CC8.1 — Change Management' },
  { policy: 'No Autonomous Merge',         controls: 'CC6.1 — Logical Access' },
  { policy: 'CI Required Before Merge',    controls: 'CC8.1 — Change Management' },
  { policy: 'Secret Detection',            controls: 'CC6.1 — Logical Access · CC6.2 — Access Provisioning' },
  { policy: 'Sensitive Path Approval',     controls: 'CC8.1 — Change Management' },
  { policy: 'Freeze Window Enforcement',   controls: 'CC8.1 — Change Management' },
  { policy: 'Blast Radius Gate',           controls: 'CC7.2 — System Monitoring' },
  { policy: 'Repo Allowlist',              controls: 'CC6.1 — Logical Access' },
  { policy: 'Workflow / Infra Approval',   controls: 'CC8.1 — Change Management' },
];

export default function CompliancePage() {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const startExport = (pack: string) => {
    setExporting(pack);
    toast.success(`Generating ${pack} evidence pack…`, {
      description: 'This takes about 30 seconds. We will surface the download when it is ready.',
    });
    setTimeout(() => {
      setExporting(null);
      toast.success(`${pack} evidence pack ready`, {
        description: 'Download link sent to ahaan@runaegis.co.',
      });
    }, 1800);
  };

  return (
    <>
      <Topbar title="Compliance" subtitle="Evidence packs and control mapping for security audits" />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-5"
        >
          {/* ── Status banner ───────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3"
            style={{
              backgroundColor: 'rgba(31, 193, 107, 0.08)',
              borderColor: 'rgba(31, 193, 107, 0.30)',
            }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} strokeWidth={2.25} />
            <span className="text-[13px] leading-[1.45] text-[var(--neutral-strong-950)]">
              <span
                className="mr-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--success)' }}
              >
                SOC 2 ready
              </span>
              Aegis has been logging immutable audit events since May 5, 2026. Your audit trail covers 23 days of agent activity.
            </span>
          </motion.section>

          {/* ── Evidence packs ──────────────────────────────────────── */}
          <motion.section variants={fadeUp}>
            <div className="mb-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Evidence pack
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Export your full audit trail in auditor-ready PDFs
              </h2>
              <p className="mt-1 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Maps every governance decision to the relevant compliance controls. Sign your auditor's NDA and email the PDF directly.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {PACKS.map((p) => {
                const isPro = p.badge === 'PRO';
                return (
                  <div
                    key={p.title}
                    className="flex flex-col gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <IconMark icon={FileText} color={isPro ? 'var(--neutral-soft-400)' : 'var(--primary-base)'} strokeWidth={2.25} />
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                        style={
                          isPro
                            ? { backgroundColor: 'var(--neutral-weak-50)', color: 'var(--neutral-sub-600)' }
                            : { backgroundColor: 'rgba(31,193,107,0.12)', color: 'var(--success)' }
                        }
                      >
                        {p.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                        {p.description}
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {p.controls.map((c) => (
                        <li key={c} className="font-mono text-[10.5px] text-[var(--neutral-sub-600)]">
                          · {c}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-1">
                      {isPro ? (
                        <Link
                          href="/dashboard/settings#plan"
                          className="inline-flex h-9 w-full items-center justify-center rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 text-[12px] font-semibold text-[var(--neutral-sub-600)]"
                        >
                          Upgrade to access
                        </Link>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => startExport(p.title)}
                          disabled={exporting === p.title}
                          leadingIcon={<Download className="h-3.5 w-3.5" strokeWidth={2.25} />}
                        >
                          {exporting === p.title ? 'Generating…' : 'Export PDF'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* ── Control mapping ─────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Policy → control mapping
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Which SOC 2 control each active Aegis policy satisfies
              </h2>
            </div>
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {CONTROL_MAPPING.map((row) => (
                <li
                  key={row.policy}
                  className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-[var(--neutral-weak-50)] transition-colors"
                >
                  <CheckCircle2
                    className="h-4 w-4"
                    style={{ color: 'var(--success)' }}
                    strokeWidth={2.25}
                  />
                  <Link
                    href="/dashboard/policies"
                    className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)] hover:text-[var(--primary-base)]"
                  >
                    {row.policy}
                  </Link>
                  <span className="font-mono text-[11px] text-[var(--neutral-sub-600)]">
                    {row.controls}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ── Retention ─────────────────────────────────────────── */}
            <motion.section
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Retention
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Pro plan · 90-day retention
                </h2>
              </div>
              <div className="px-5 py-4">
                <div className="mb-2 flex items-baseline justify-between text-[12px]">
                  <span className="text-[var(--neutral-sub-600)]">23 of 90 days used</span>
                  <span className="font-mono tabular-nums text-[var(--neutral-strong-950)]">26%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: '26%', backgroundColor: 'var(--primary-base)' }}
                  />
                </div>
                <Link
                  href="/dashboard/settings#plan"
                  className="mt-3 inline-block text-[11.5px] font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
                >
                  Upgrade to Enterprise for unlimited retention →
                </Link>
              </div>
            </motion.section>

            {/* ── Scheduled exports ─────────────────────────────────── */}
            <motion.section
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-5 py-3">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                    Scheduled exports
                  </p>
                  <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    Auto-export your audit trail on a schedule
                  </h2>
                </div>
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2 text-[11.5px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.25} />
                  Add schedule
                </button>
              </div>
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[var(--neutral-sub-600)]" strokeWidth={2} />
                    <div>
                      <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                        Monthly PDF
                      </p>
                      <p className="text-[11px] text-[var(--neutral-sub-600)]">
                        Sent to ahaan@runaegis.co on the 1st
                      </p>
                    </div>
                  </div>
                  <Mail className="h-4 w-4 text-[var(--neutral-soft-400)]" strokeWidth={2} />
                </li>
              </ul>
            </motion.section>
          </div>
        </motion.div>
      </div>

      <ConfirmDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title="Schedule audit export"
        description={
          <div className="space-y-3 text-[12.5px] text-[var(--neutral-sub-600)]">
            <p>
              Aegis will email or webhook your full audit trail on the schedule you set.
            </p>
            <ul className="space-y-2 text-[12px]">
              <li>1. Frequency (weekly · monthly · quarterly)</li>
              <li>2. Format (JSON · PDF · CSV)</li>
              <li>3. Destination (email · webhook URL)</li>
              <li>4. Filters (decisions · policies · agents)</li>
            </ul>
            <p className="text-[11px] text-[var(--neutral-soft-400)]">
              Full schedule builder lands with the next sprint.
            </p>
          </div>
        }
        confirmLabel="Got it"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setScheduleOpen(false);
          toast.success('Schedule saved', {
            description: 'You will receive your first export at the start of next period.',
          });
        }}
      />
    </>
  );
}
