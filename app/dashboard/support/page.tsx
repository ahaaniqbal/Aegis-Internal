'use client';

/**
 * Support — `/dashboard/support`.
 *
 * Minimal support landing. Three resource cards (docs, community, email)
 * + a Report a Bug form that surfaces a success toast on submit.
 *
 * The sidebar already links here. Before this page existed the link
 * 404'd, which read as "the product isn't finished" — exactly the
 * impression an investor pitch needs to avoid.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BookOpen, ExternalLink, MessageCircle, Mail, Bug } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { IconMark } from '@/components/ui/IconMark';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

const RESOURCES = [
  {
    icon: BookOpen,
    title: 'Documentation',
    detail: 'API reference, MCP integration guides, policy authoring, audit export schemas.',
    cta: 'Read the docs',
    href: 'https://docs.runaegis.co',
    external: true,
  },
  {
    icon: MessageCircle,
    title: 'Community',
    detail: 'Discord for design partners and early users. Ship-related questions, policy patterns, and roadmap conversations.',
    cta: 'Join Discord',
    href: '#',
    external: true,
    placeholder: true,
  },
  {
    icon: Mail,
    title: 'Email support',
    detail: 'Direct line for production issues, billing, custom policy work, and SOC 2 evidence requests.',
    cta: 'ahaan@runaegis.co',
    href: 'mailto:ahaan@runaegis.co',
    external: false,
  },
];

export default function SupportPage() {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    // Demo: simulate the submit. In production this would POST to a
    // support intake endpoint and surface a ticket id.
    await new Promise((res) => setTimeout(res, 600));
    setSubmitting(false);
    setName('');
    setDescription('');
    toast.success('Bug report received', {
      description: 'Thanks. We will follow up at the email on your account within 24 hours.',
    });
  };

  return (
    <>
      <Topbar title="Support" subtitle="Docs, community, and direct line to the team" />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.div
          variants={staggerContainer(0.06)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* Resource cards */}
          <motion.section variants={fadeUp}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--neutral-soft-400)]">
              Resources
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RESOURCES.map((r) => {
                const Icon = r.icon;
                const linkProps = r.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {};
                return (
                  <motion.a
                    key={r.title}
                    href={r.href}
                    {...linkProps}
                    variants={fadeUpSm}
                    whileHover={{
                      y: -2,
                      transition: { duration: 0.2, ease: [0.32, 0.72, 0.32, 1] },
                    }}
                    className="group flex flex-col gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_8px_24px_rgba(23,23,23,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <IconMark icon={Icon} color="var(--primary-base)" strokeWidth={2.25} />
                      {r.external && (
                        <ExternalLink
                          className="h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-colors group-hover:text-[var(--primary-base)]"
                          strokeWidth={2}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                        {r.title}
                        {r.placeholder && (
                          <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                            Coming soon
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                        {r.detail}
                      </p>
                    </div>
                    <span className="mt-auto text-[12px] font-medium text-[var(--primary-base)]">
                      {r.cta}
                    </span>
                  </motion.a>
                );
              })}
            </div>
          </motion.section>

          {/* Report a bug form */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
              <IconMark icon={Bug} color="var(--error)" strokeWidth={2.25} />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Report a bug
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Tell us what broke. We will follow up within 24 hours.
                </h2>
              </div>
            </div>
            <form onSubmit={onSubmit} className="grid gap-4 px-4 py-4 sm:px-5">
              <div>
                <label
                  htmlFor="support-name"
                  className="mb-1.5 block text-[11px] font-medium text-[var(--neutral-sub-600)]"
                >
                  Your name (optional)
                </label>
                <input
                  id="support-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahaan Iqbal"
                  className="w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3 py-2 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-24)]"
                />
              </div>
              <div>
                <label
                  htmlFor="support-description"
                  className="mb-1.5 block text-[11px] font-medium text-[var(--neutral-sub-600)]"
                >
                  What happened?
                </label>
                <textarea
                  id="support-description"
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The agent's run on aegis/dashboard was classified as protected_branch_write but the actual branch was a feature/* branch. Expected ALLOW, got REWRITE."
                  className="w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-24)]"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !description.trim()}
                >
                  {submitting ? 'Submitting…' : 'Submit report'}
                </Button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      </div>
    </>
  );
}
