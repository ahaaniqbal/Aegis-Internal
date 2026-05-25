'use client';

/**
 * Policy Marketplace — `/dashboard/marketplace`.
 *
 * Compliance bundles + community policies. The pitch surface that
 * shows the policy ecosystem isn't just what Aegis ships — there's
 * a community of platform-eng / sec-eng teams contributing rules.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  Users,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconMark } from '@/components/ui/IconMark';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

interface Bundle {
  title: string;
  policies: number;
  covers: string;
  description: string;
  installs: number;
  enterpriseOnly?: boolean;
}

const BUNDLES: Bundle[] = [
  { title: 'SOC 2 Readiness', policies: 15, covers: 'CC6.1 · CC6.2 · CC7.2 · CC8.1', description: 'Installs 15 Aegis policies that satisfy SOC 2 Type II change-management and logical-access controls. Used by 340 teams.', installs: 340 },
  { title: 'HIPAA Safeguards', policies: 8,  covers: '§164.312(b) · §164.312(d)',     description: 'For engineering teams operating on systems that touch PHI. Blocks agent access to patient-data tables, enforces audit logging on all DB queries.', installs: 87 },
  { title: 'ISO 27001 Controls', policies: 12, covers: 'A.12.1 · A.12.4 · A.12.6',    description: 'Maps to ISO 27001 Annex A operational controls. Includes logging requirements and change-management gates.', installs: 156 },
  { title: 'PCI-DSS', policies: 10, covers: 'PCI DSS v4.0 requirement 7',              description: 'Access control bundle for engineering teams handling cardholder data. Enterprise only.', installs: 43, enterpriseOnly: true },
];

type FilterTab = 'all' | 'verified' | 'security' | 'compliance' | 'devops';

interface CommunityPolicy {
  name: string;
  author: string;
  verified: boolean;
  description: string;
  effect: 'DENY' | 'REQUIRE_APPROVAL';
  installs: number;
  category: 'security' | 'compliance' | 'devops';
}

const COMMUNITY: CommunityPolicy[] = [
  { name: 'Monorepo Package Boundary Lock',  author: '@platform-team-stripe', verified: true,  description: "Prevents agents from writing across package boundaries in monorepos. Uses nx.json / turbo.json / CODEOWNERS for boundary detection.", effect: 'DENY',             installs: 1243, category: 'devops' },
  { name: 'Dockerfile Hardening Gate',       author: '@security-eng',         verified: true,  description: "Hard DENY for --privileged, --net=host, FROM:latest, and docker.sock mounts in all container configuration changes.",                  effect: 'DENY',             installs:  892, category: 'security' },
  { name: 'Infrastructure Cost Gate',        author: '@finops-community',     verified: true,  description: "Parses terraform plan output, estimates monthly cost delta via cloud pricing API, gates changes above $500/mo.",                       effect: 'REQUIRE_APPROVAL', installs:  634, category: 'devops' },
  { name: 'Git History Rewrite Prevention',  author: '@devex-labs',           verified: true,  description: "Blocks git rebase --onto, filter-branch, and force pushes to branches with open PRs.",                                                  effect: 'DENY',             installs:  521, category: 'devops' },
  { name: 'Privileged Token Escalation Block', author: '@appsec-community',   verified: true,  description: "Hard DENY on API key creation, OAuth token generation, IAM role modification, and service account creation by agents.",                effect: 'DENY',             installs:  478, category: 'security' },
  { name: 'AI-Generated Code Reviewer',      author: '@openai-team',          verified: false, description: "Routes all agent-authored code changes for mandatory human review before merge. Experimental.",                                       effect: 'REQUIRE_APPROVAL', installs:  234, category: 'compliance' },
];

export default function MarketplacePage() {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [installBundle, setInstallBundle] = useState<Bundle | null>(null);
  const [installPolicy, setInstallPolicy] = useState<CommunityPolicy | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = COMMUNITY.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'verified') return p.verified;
    return p.category === filter;
  });

  return (
    <>
      <Topbar title="Policy Marketplace" subtitle="Community policies and compliance bundles — install in one click" />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* ── Bundles ─────────────────────────────────────────────── */}
          <motion.section variants={fadeUp}>
            <div className="mb-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Compliance bundles
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Pre-packaged policy sets mapped to industry standards
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {BUNDLES.map((b) => (
                <motion.div
                  key={b.title}
                  variants={fadeUpSm}
                  className="flex flex-col gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <IconMark icon={ShieldCheck} color="var(--primary-base)" strokeWidth={2.25} />
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                      style={{ backgroundColor: 'var(--neutral-weak-50)', color: 'var(--neutral-strong-950)' }}
                    >
                      OFFICIAL
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                      {b.title}
                    </h3>
                    <p className="mt-1 font-mono text-[10.5px] text-[var(--neutral-sub-600)]">
                      {b.policies} policies · {b.covers}
                    </p>
                    <p className="mt-2 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {b.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
                      <Users className="h-3 w-3" strokeWidth={2} />
                      {b.installs.toLocaleString()} installs
                    </span>
                    {b.enterpriseOnly ? (
                      <span className="inline-flex h-7 items-center rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 text-[11px] font-semibold text-[var(--neutral-soft-400)]">
                        Enterprise only
                      </span>
                    ) : (
                      <button
                        onClick={() => setInstallBundle(b)}
                        className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-[var(--primary-base)] px-2.5 text-[11px] font-semibold text-white hover:bg-[var(--primary-dark)]"
                      >
                        <Download className="h-3 w-3" strokeWidth={2.25} />
                        Install
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── Community policies ──────────────────────────────────── */}
          <motion.section variants={fadeUp}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Community policies
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Verified policies contributed by the Aegis community
                </h2>
              </div>
              <div
                role="tablist"
                className="inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5"
              >
                {(['all', 'verified', 'security', 'compliance', 'devops'] as FilterTab[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={filter === t}
                    onClick={() => setFilter(t)}
                    className={[
                      'h-7 rounded-[6px] px-2.5 text-[11px] font-semibold capitalize tracking-[-0.005em] transition-colors',
                      filter === t
                        ? 'bg-[var(--white-0)] text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                        : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((p) => (
                <motion.div
                  key={p.name}
                  variants={fadeUpSm}
                  className="flex flex-col gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--neutral-sub-600)]">
                        {p.author}
                        {p.verified && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(31,193,107,0.10)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--success)' }}>
                            <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
                            Verified
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                      style={{
                        backgroundColor: p.effect === 'DENY' ? 'rgba(251,55,72,0.10)' : 'rgba(246,181,30,0.14)',
                        color: p.effect === 'DENY' ? 'var(--error)' : 'var(--warning-dark)',
                      }}
                    >
                      {p.effect}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    {p.description}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
                      <Users className="h-3 w-3" strokeWidth={2} />
                      {p.installs.toLocaleString()} installs
                    </span>
                    <button
                      onClick={() => setInstallPolicy(p)}
                      className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2.5 text-[11px] font-semibold text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                    >
                      <Download className="h-3 w-3" strokeWidth={2.25} />
                      Install
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── Contribute ──────────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-dashed border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-4"
          >
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Contribute a policy
              </p>
              <p className="mt-0.5 text-[12.5px] text-[var(--neutral-strong-950)]">
                Built a policy that other teams should use? Submit it for community review.
              </p>
            </div>
            <Button
              variant="secondary"
              leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
              onClick={() => setSubmitOpen(true)}
            >
              Submit policy →
            </Button>
          </motion.section>
        </motion.div>
      </div>

      {/* Bundle install modal */}
      <ConfirmDialog
        open={installBundle !== null}
        onOpenChange={(o) => !o && setInstallBundle(null)}
        title={installBundle ? `Install ${installBundle.title}?` : ''}
        description={
          installBundle
            ? `This will activate ${installBundle.policies} policies in your workspace, mapped to ${installBundle.covers}. You can disable individual policies any time from the Policies page.`
            : ''
        }
        confirmLabel="Install bundle"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          if (installBundle) {
            toast.success(`${installBundle.title} installed`, {
              description: `${installBundle.policies} policies are now active in your workspace.`,
            });
            setInstallBundle(null);
          }
        }}
      />

      {/* Community policy install modal */}
      <ConfirmDialog
        open={installPolicy !== null}
        onOpenChange={(o) => !o && setInstallPolicy(null)}
        title={installPolicy ? `Install ${installPolicy.name}?` : ''}
        description={
          installPolicy ? (
            <div className="space-y-2.5 text-[12.5px] text-[var(--neutral-sub-600)]">
              <p>{installPolicy.description}</p>
              <p className="font-mono text-[11px]">
                Effect: <span className="font-semibold" style={{ color: installPolicy.effect === 'DENY' ? 'var(--error)' : 'var(--warning-dark)' }}>{installPolicy.effect}</span> · Author: {installPolicy.author}
              </p>
              {!installPolicy.verified && (
                <div
                  className="flex items-start gap-2 rounded-[8px] border px-3 py-2"
                  style={{
                    backgroundColor: 'rgba(246, 181, 30, 0.10)',
                    borderColor: 'rgba(246, 181, 30, 0.30)',
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--warning-dark)' }} strokeWidth={2.25} />
                  <p className="text-[11.5px] text-[var(--warning-dark)]">
                    Unverified policy. Aegis has not reviewed this. Use at your own risk.
                  </p>
                </div>
              )}
            </div>
          ) : ''
        }
        confirmLabel="Install policy"
        cancelLabel="Cancel"
        variant={installPolicy?.verified === false ? 'danger' : 'primary'}
        onConfirm={() => {
          if (installPolicy) {
            toast.success(`${installPolicy.name} installed`, {
              description: 'Policy is now active across your workspace. Configure scope in Policies.',
            });
            setInstallPolicy(null);
          }
        }}
      />

      {/* Submit policy modal */}
      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit a policy for review"
        description={
          <div className="space-y-2.5 text-[12.5px] text-[var(--neutral-sub-600)]">
            <p>All submissions go through Aegis review before publishing to the marketplace.</p>
            <ul className="space-y-1.5 text-[12px]">
              <li>· Policy name</li>
              <li>· Description (what it blocks and why)</li>
              <li>· Effect (DENY / REWRITE / REQUIRE_APPROVAL)</li>
              <li>· JSON rule definition</li>
            </ul>
            <p className="text-[11px] text-[var(--neutral-soft-400)]">
              Full submission form lands with the next sprint.
            </p>
          </div>
        }
        confirmLabel="Got it"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setSubmitOpen(false);
          toast.success('Submission queue opens soon', {
            description: 'Email ahaan@runaegis.co with a policy draft to get into the early review.',
          });
        }}
      />
    </>
  );
}
