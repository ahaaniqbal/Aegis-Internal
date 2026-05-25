/**
 * Aegis Pitch Deck Generator
 *
 * Produces Aegis-Pitch-Deck.pptx — 14 slides for accelerator (a16z Speed Run,
 * YC) and seed VC fundraising. Hybrid tone: incident-led hook (slides 2-3),
 * thesis-driven follow (slide 4+).
 *
 * Visual identity mirrors the Aegis product:
 *   - Light slides on near-white canvas
 *   - Near-black headline text, mid-gray body
 *   - Brand orange (#FA7319) reserved for emphasis (decision: REWRITE, primary CTA)
 *   - Inter for headlines + body, Menlo for technical anchors (semantic_type, code, IDs)
 *   - Diagram primitives that read like the dashboard surfaces:
 *       mono key=value rows, layered cards, trace strips, request diagnostic
 *
 * Cover + closing slide use a dark canvas for sandwich-structure framing.
 */

const pptxgen = require('pptxgenjs');
const path = require('path');

// ─── Tokens ─────────────────────────────────────────────────────────────────

const COLORS = {
  bg: 'FFFFFF',
  bgDark: '0A0D14',
  textStrong: '0A0D14',
  textMid: '525866',
  textMuted: '99A0AE',
  textInvert: 'FFFFFF',
  textInvertMuted: 'A8AFBA',
  borderSoft: 'EBEBEB',
  borderSofter: 'F5F6F8',
  borderDark: '1F2329',
  brandOrange: 'FA7319',
  brandOrangeDark: 'D85800',
  brandOrangeTint: 'FFF1E5',
  brandOrangeRing: 'FFC899',
  success: '1F7A3E',
  successTint: 'EBF7EE',
  error: 'DA1D34',
  errorTint: 'FCEBEC',
  warning: 'B86700',
  warningTint: 'FFF5E5',
  monoBg: 'F6F8FA',
  monoBgDark: '12161C',
};

const FONT = {
  sans: 'Inter',
  mono: 'Menlo',
};

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const PAD = 0.7; // page side padding

// ─── Helpers ────────────────────────────────────────────────────────────────

function drawFooter(slide, pageNum, total, dark = false) {
  // Brand mark + page counter, mono and small
  slide.addText('AEGIS', {
    x: PAD, y: SLIDE_H - 0.5, w: 2, h: 0.3,
    fontFace: FONT.sans, fontSize: 9, bold: true,
    color: dark ? COLORS.textInvertMuted : COLORS.textMuted,
    charSpacing: 8, margin: 0,
  });
  slide.addText(`${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, {
    x: SLIDE_W - PAD - 2, y: SLIDE_H - 0.5, w: 2, h: 0.3,
    fontFace: FONT.mono, fontSize: 9,
    color: dark ? COLORS.textInvertMuted : COLORS.textMuted,
    align: 'right', margin: 0,
  });
}

function drawEyebrow(slide, text, x, y, color = COLORS.brandOrange) {
  slide.addText(text, {
    x, y, w: 6, h: 0.25,
    fontFace: FONT.sans, fontSize: 10, bold: true, color,
    charSpacing: 14, margin: 0,
  });
}

function drawTitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x || PAD, y: opts.y || 1.1, w: opts.w || SLIDE_W - 2 * PAD, h: opts.h || 1.6,
    fontFace: FONT.sans, fontSize: opts.size || 36, bold: true,
    color: opts.color || COLORS.textStrong,
    charSpacing: -1, lineSpacingMultiple: 1.05, margin: 0,
  });
}

function drawSubtitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x || PAD, y: opts.y || 2.7, w: opts.w || SLIDE_W - 2 * PAD, h: opts.h || 1.0,
    fontFace: FONT.sans, fontSize: opts.size || 15,
    color: opts.color || COLORS.textMid,
    lineSpacingMultiple: 1.45, margin: 0,
  });
}

/** Mono key=value diagnostic chip — exact visual match to the dashboard's
 *  request-trace strip and 4-context evidence panel rows. */
function drawMonoChip(slide, x, y, label, value, opts = {}) {
  const w = opts.w || 2.2;
  const h = opts.h || 0.34;
  const labelColor = opts.labelColor || COLORS.textMuted;
  const valueColor = opts.valueColor || COLORS.textStrong;
  const bg = opts.bg || COLORS.monoBg;
  const border = opts.border || COLORS.borderSoft;

  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: bg },
    line: { color: border, width: 0.5 },
  });
  slide.addText([
    { text: label, options: { fontFace: FONT.mono, fontSize: 10, color: labelColor } },
    { text: '  ' + value, options: { fontFace: FONT.mono, fontSize: 10, color: valueColor, bold: true } },
  ], { x: x + 0.1, y, w: w - 0.2, h, valign: 'middle', margin: 0 });
}

// ─── Slides ─────────────────────────────────────────────────────────────────

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Aegis · Pitch Deck';
pres.author = 'Ahaan Iqbal';
pres.company = 'Aegis';

const TOTAL = 14;

// ── Slide 1: Cover ───────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bgDark };

  // Brand mark top-left
  s.addText('AEGIS', {
    x: PAD, y: 0.55, w: 3, h: 0.4,
    fontFace: FONT.sans, fontSize: 12, bold: true,
    color: COLORS.textInvertMuted, charSpacing: 14, margin: 0,
  });
  s.addText('CONFIDENTIAL · 2026', {
    x: SLIDE_W - PAD - 3, y: 0.55, w: 3, h: 0.4,
    fontFace: FONT.mono, fontSize: 9, color: COLORS.textInvertMuted,
    charSpacing: 8, align: 'right', margin: 0,
  });

  // Main title
  s.addText('Aegis', {
    x: PAD, y: 2.7, w: SLIDE_W - 2 * PAD, h: 1.4,
    fontFace: FONT.sans, fontSize: 96, bold: true,
    color: COLORS.textInvert, charSpacing: -3, margin: 0,
  });
  s.addText('Governance for AI agents in production.', {
    x: PAD, y: 4.0, w: SLIDE_W - 2 * PAD, h: 0.7,
    fontFace: FONT.sans, fontSize: 22,
    color: COLORS.textInvertMuted, charSpacing: -1, margin: 0,
  });

  // Mono trace strip at the bottom — visual identity with the product
  const stripY = 6.1;
  s.addShape(pres.shapes.RECTANGLE, {
    x: PAD, y: stripY, w: SLIDE_W - 2 * PAD, h: 0.5,
    fill: { color: COLORS.monoBgDark },
    line: { color: COLORS.borderDark, width: 0.5 },
  });
  s.addText([
    { text: 'live ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.textInvertMuted } },
    { text: 'dashboard.runaegis.co', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.brandOrange, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 11, color: '3A3F47' } },
    { text: 'mcp ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.textInvertMuted } },
    { text: 'app.runaegis.co', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.textInvert, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 11, color: '3A3F47' } },
    { text: 'founder ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.textInvertMuted } },
    { text: 'ahaan@runaegis.co', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.textInvert, bold: true } },
  ], { x: PAD + 0.2, y: stripY, w: SLIDE_W - 2 * PAD - 0.4, h: 0.5, valign: 'middle', margin: 0 });

  drawFooter(s, 1, TOTAL, true);
}

// ── Slide 2: The incident ────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'MAR 8 · 2026', PAD, 0.7, COLORS.error);
  drawTitle(s, 'Claude Code ran `terraform destroy`\non a production database.', { y: 1.05, h: 1.9, size: 36 });

  // Body story
  s.addText([
    { text: 'Alexey Grigorev runs ', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid } },
    { text: 'DataTalksClub', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textStrong, bold: true } },
    { text: ', a community of 50,000+ data engineers. He asked Claude Code to debug a database issue.', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid, breakLine: true } },
    { text: ' ', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid, breakLine: true } },
    { text: 'The agent decided the cleanest fix was to ', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid } },
    { text: 'destroy and recreate', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textStrong, bold: true } },
    { text: ' the database.', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid, breakLine: true } },
    { text: ' ', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textMid, breakLine: true } },
    { text: 'No approval gate. No audit trail. No way to undo it.', options: { fontFace: FONT.sans, fontSize: 14, color: COLORS.textStrong, bold: true } },
  ], { x: PAD, y: 3.05, w: 7.6, h: 2.3, lineSpacingMultiple: 1.5, margin: 0 });

  // Pull quote
  s.addShape(pres.shapes.RECTANGLE, {
    x: 8.6, y: 3.05, w: SLIDE_W - PAD - 8.6, h: 2.6,
    fill: { color: COLORS.monoBg },
    line: { color: COLORS.borderSoft, width: 0.5 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 8.6, y: 3.05, w: 0.08, h: 2.6,
    fill: { color: COLORS.error },
    line: { type: 'none' },
  });
  s.addText('"There\'s no way to undo this. I\'m not sure what to do."', {
    x: 8.85, y: 3.25, w: SLIDE_W - PAD - 8.85 - 0.2, h: 1.5,
    fontFace: FONT.sans, fontSize: 15, italic: true,
    color: COLORS.textStrong, lineSpacingMultiple: 1.4, margin: 0,
  });
  s.addText('Alexey Grigorev', {
    x: 8.85, y: 5.0, w: SLIDE_W - PAD - 8.85 - 0.2, h: 0.3,
    fontFace: FONT.mono, fontSize: 11, color: COLORS.textMuted, margin: 0,
  });
  s.addText('DataTalksClub · Mar 8, 2026', {
    x: 8.85, y: 5.3, w: SLIDE_W - PAD - 8.85 - 0.2, h: 0.3,
    fontFace: FONT.mono, fontSize: 9, color: COLORS.textMuted, margin: 0,
  });

  // Bottom diagnostic strip
  s.addShape(pres.shapes.RECTANGLE, {
    x: PAD, y: 6.15, w: SLIDE_W - 2 * PAD, h: 0.5,
    fill: { color: COLORS.errorTint },
    line: { color: COLORS.error, width: 0.5 },
  });
  s.addText([
    { text: 'incident ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'unrecoverable_data_loss', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'agent ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'claude-code', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'tool ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'terraform_destroy', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'governance_layer ', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error } },
    { text: 'none', options: { fontFace: FONT.mono, fontSize: 11, color: COLORS.error, bold: true } },
  ], { x: PAD + 0.2, y: 6.15, w: SLIDE_W - 2 * PAD - 0.4, h: 0.5, valign: 'middle', margin: 0 });

  drawFooter(s, 2, TOTAL);
}

// ── Slide 3: The pattern ─────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'THE PATTERN', PAD, 0.7);
  drawTitle(s, 'This isn\'t one incident.\nIt\'s a category.', { y: 1.05, h: 1.9, size: 36 });
  drawSubtitle(s, 'Every CTO at a Series A+ company is asking the same question: what is the agent doing in my codebase?', { y: 3.0, w: 10.5, h: 0.9 });

  // Three incident cards
  const cardY = 4.2;
  const cardH = 1.85;
  const cardW = (SLIDE_W - 2 * PAD - 0.5) / 3;
  const gap = 0.25;

  const incidents = [
    {
      date: 'MAR 8, 2026',
      title: 'Claude Code → `terraform destroy`',
      detail: 'Production database lost. No approval gate. No undo.',
      tag: 'unrecoverable_data_loss',
    },
    {
      date: 'APR 22, 2026',
      title: 'Bitwarden CLI supply chain attack',
      detail: 'Compromised npm package exfiltrated developer credentials.',
      tag: 'credential_exposure',
    },
    {
      date: 'APR 30, 2026',
      title: 'OpenAI Codex → GitHub branch injection',
      detail: 'Malicious branch names triggered command execution.',
      tag: 'sensitive_path_change',
    },
  ];

  incidents.forEach((inc, i) => {
    const x = PAD + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: COLORS.bg },
      line: { color: COLORS.borderSoft, width: 0.75 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: 0.04,
      fill: { color: COLORS.error },
      line: { type: 'none' },
    });
    s.addText(inc.date, {
      x: x + 0.25, y: cardY + 0.2, w: cardW - 0.5, h: 0.25,
      fontFace: FONT.mono, fontSize: 9.5, bold: true,
      color: COLORS.error, charSpacing: 6, margin: 0,
    });
    s.addText(inc.title, {
      x: x + 0.25, y: cardY + 0.5, w: cardW - 0.5, h: 0.7,
      fontFace: FONT.sans, fontSize: 14.5, bold: true,
      color: COLORS.textStrong, charSpacing: 0,
      lineSpacingMultiple: 1.2, margin: 0,
    });
    s.addText(inc.detail, {
      x: x + 0.25, y: cardY + 1.1, w: cardW - 0.5, h: 0.35,
      fontFace: FONT.sans, fontSize: 11.5,
      color: COLORS.textMid, lineSpacingMultiple: 1.4, margin: 0,
    });
    // Bottom tag
    s.addText(inc.tag, {
      x: x + 0.25, y: cardY + cardH - 0.4, w: cardW - 0.5, h: 0.3,
      fontFace: FONT.mono, fontSize: 9.5,
      color: COLORS.textMuted, margin: 0,
    });
  });

  drawFooter(s, 3, TOTAL);
}

// ── Slide 4: Why now ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'WHY NOW', PAD, 0.7);
  drawTitle(s, 'AI coding agents are the new\ncloud workload.', { y: 1.05, h: 1.9, size: 36 });
  drawSubtitle(s, 'Cloud got Datadog. Agents get Aegis. The governance layer always emerges right after the dev primitive lands.', { y: 3.0, w: 11.0, h: 0.9 });

  // Three big-stat cards
  const statY = 4.15;
  const statH = 2.05;
  const statW = (SLIDE_W - 2 * PAD - 0.5) / 3;
  const gap = 0.25;

  const stats = [
    { big: '75%', label: 'OF ENTERPRISE WORKSPACES', detail: 'now have AI coding agents installed and used daily.', source: 'Linear · Mar 2026' },
    { big: '5×', label: 'GROWTH IN 3 MONTHS', detail: 'agent adoption rate across Series A+ engineering orgs.', source: 'Industry survey · Q1 2026' },
    { big: '0', label: 'GOVERNANCE LAYERS SHIPPING', detail: 'no purpose-built control plane exists for agent actions today.', source: 'Aegis competitive scan · May 2026', accent: true },
  ];

  stats.forEach((stat, i) => {
    const x = PAD + i * (statW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: statY, w: statW, h: statH,
      fill: { color: stat.accent ? COLORS.brandOrangeTint : COLORS.bg },
      line: { color: stat.accent ? COLORS.brandOrangeRing : COLORS.borderSoft, width: 0.75 },
    });
    s.addText(stat.big, {
      x: x + 0.3, y: statY + 0.15, w: statW - 0.6, h: 0.85,
      fontFace: FONT.sans, fontSize: 64, bold: true,
      color: stat.accent ? COLORS.brandOrangeDark : COLORS.textStrong,
      charSpacing: -2, margin: 0,
    });
    s.addText(stat.label, {
      x: x + 0.3, y: statY + 1.05, w: statW - 0.6, h: 0.28,
      fontFace: FONT.mono, fontSize: 9.5, bold: true,
      color: stat.accent ? COLORS.brandOrangeDark : COLORS.textStrong,
      charSpacing: 2, margin: 0,
    });
    s.addText(stat.detail, {
      x: x + 0.3, y: statY + 1.35, w: statW - 0.6, h: 0.35,
      fontFace: FONT.sans, fontSize: 11.5,
      color: COLORS.textMid, lineSpacingMultiple: 1.35, margin: 0,
    });
    s.addText(stat.source, {
      x: x + 0.3, y: statY + statH - 0.3, w: statW - 0.6, h: 0.25,
      fontFace: FONT.mono, fontSize: 9, color: COLORS.textMuted, margin: 0,
    });
  });

  drawFooter(s, 4, TOTAL);
}

// ── Slide 5: What Aegis does ─────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'WHAT WE DO', PAD, 0.7);
  drawTitle(s, 'Branch protection rules.\nBut for AI agents.', { y: 1.05, h: 1.9, size: 36 });
  drawSubtitle(s, 'Aegis sits between AI agents (Claude Code, Cursor, Codex) and the production systems they touch. Every action is intercepted before it executes.', { y: 3.0, w: 11.0, h: 0.9 });

  // 4 verb cards in a horizontal strip
  const verbY = 4.25;
  const verbH = 1.85;
  const verbW = (SLIDE_W - 2 * PAD - 0.75) / 4;
  const gap = 0.25;

  const verbs = [
    { num: '01', title: 'MONITOR', detail: 'Every agent action logged with tool, args, context, decision, latency.' },
    { num: '02', title: 'CLASSIFY', detail: 'Deterministic semantic classifier emits semantic_type + blast_radius.' },
    { num: '03', title: 'GOVERN', detail: 'ALLOW · DENY · REWRITE · REQUIRE_APPROVAL, composed with policies.', accent: true },
    { num: '04', title: 'AUDIT', detail: 'Immutable trail of every decision. Exportable SOC 2 evidence.' },
  ];

  verbs.forEach((v, i) => {
    const x = PAD + i * (verbW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: verbY, w: verbW, h: verbH,
      fill: { color: COLORS.bg },
      line: { color: v.accent ? COLORS.brandOrangeRing : COLORS.borderSoft, width: 0.75 },
    });
    if (v.accent) {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: verbY, w: verbW, h: 0.05,
        fill: { color: COLORS.brandOrange }, line: { type: 'none' },
      });
    }
    s.addText(v.num, {
      x: x + 0.25, y: verbY + 0.2, w: verbW - 0.5, h: 0.3,
      fontFace: FONT.mono, fontSize: 10, color: COLORS.textMuted, margin: 0,
    });
    s.addText(v.title, {
      x: x + 0.25, y: verbY + 0.55, w: verbW - 0.5, h: 0.4,
      fontFace: FONT.sans, fontSize: 18, bold: true,
      color: v.accent ? COLORS.brandOrangeDark : COLORS.textStrong,
      charSpacing: 4, margin: 0,
    });
    s.addText(v.detail, {
      x: x + 0.25, y: verbY + 1.0, w: verbW - 0.5, h: 0.8,
      fontFace: FONT.sans, fontSize: 11.5,
      color: COLORS.textMid, lineSpacingMultiple: 1.4, margin: 0,
    });
  });

  // Bottom strip
  s.addText([
    { text: '15-minute install', options: { fontFace: FONT.sans, fontSize: 12, bold: true, color: COLORS.textStrong } },
    { text: '   ·   Zero agent migration   ·   ', options: { fontFace: FONT.sans, fontSize: 12, color: COLORS.textMid } },
    { text: 'Wraps every agent wherever it already runs', options: { fontFace: FONT.sans, fontSize: 12, color: COLORS.textStrong, bold: true } },
  ], { x: PAD, y: 6.4, w: SLIDE_W - 2 * PAD, h: 0.3, align: 'center', margin: 0 });

  drawFooter(s, 5, TOTAL);
}

// ── Slide 6: How it works (architecture) ─────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'ARCHITECTURE', PAD, 0.7);
  drawTitle(s, 'Three layers. One thin wrapper.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'Live in production today. semantic_classifier.py is shipping. The intelligence layer is the unfair advantage.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // Vertical architecture stack
  const archX = 3.5;
  const archW = 6.3;
  const startY = 2.85;
  const blockH = 0.62;
  const gap = 0.12;

  const blocks = [
    { label: 'AGENT', detail: 'Claude Code · Cursor · Codex · Devin · Windsurf', color: COLORS.textStrong, bg: COLORS.monoBg },
    { label: 'LAYER 1', detail: 'Interception · normalize to canonical_action_type', color: COLORS.textStrong, bg: COLORS.bg, border: true },
    { label: 'LAYER 2', detail: 'Contextual Intelligence Layer · deterministic classifier', color: COLORS.brandOrangeDark, bg: COLORS.brandOrangeTint, border: true, moat: true },
    { label: 'LAYER 3', detail: 'Governance · ALLOW · DENY · REWRITE · REQUIRE_APPROVAL', color: COLORS.textStrong, bg: COLORS.bg, border: true },
    { label: 'DOWNSTREAM MCP', detail: 'GitHub · Linear · AWS · Slack · custom', color: COLORS.textStrong, bg: COLORS.monoBg },
  ];

  blocks.forEach((b, i) => {
    const y = startY + i * (blockH + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: archX, y, w: archW, h: blockH,
      fill: { color: b.bg },
      line: { color: b.moat ? COLORS.brandOrangeRing : (b.border ? COLORS.borderSoft : COLORS.borderSoft), width: b.moat ? 1.25 : 0.75 },
    });
    s.addText(b.label, {
      x: archX + 0.2, y, w: 1.8, h: blockH,
      fontFace: FONT.mono, fontSize: 11, bold: true,
      color: b.color, charSpacing: 6, valign: 'middle', margin: 0,
    });
    s.addText(b.detail, {
      x: archX + 2.0, y, w: archW - 2.2, h: blockH,
      fontFace: FONT.sans, fontSize: 12,
      color: b.moat ? COLORS.brandOrangeDark : COLORS.textMid,
      valign: 'middle', margin: 0,
    });
    // Moat badge intentionally removed — the orange tint + ring on Layer 2
    // already carries the signal, and overlaying the text on the block
    // collides with the block's own description.
    // Arrows between blocks (except after last)
    if (i < blocks.length - 1) {
      const arrowY = y + blockH + 0.005;
      s.addShape(pres.shapes.LINE, {
        x: archX + archW / 2, y: arrowY, w: 0, h: gap - 0.01,
        line: { color: COLORS.textMuted, width: 1, endArrowType: 'triangle' },
      });
    }
  });

  // Left-side annotation strip
  s.addText([
    { text: 'AUDIT TRAIL', options: { fontFace: FONT.mono, fontSize: 10, bold: true, color: COLORS.textMuted, charSpacing: 8, breakLine: true } },
    { text: ' ', options: { fontFace: FONT.sans, fontSize: 10, breakLine: true } },
    { text: 'Every (action, contexts,', options: { fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, breakLine: true } },
    { text: 'semantic_type, decision)', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textStrong, breakLine: true } },
    { text: 'tuple stored as immutable', options: { fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, breakLine: true } },
    { text: 'evidence. Exportable to', options: { fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, breakLine: true } },
    { text: 'SOC 2 reviewers.', options: { fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid } },
  ], { x: PAD, y: 3.4, w: 2.5, h: 3.0, lineSpacingMultiple: 1.4, margin: 0 });

  drawFooter(s, 6, TOTAL);
}

// ── Slide 7: The moat — CIL ──────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'THE MOAT', PAD, 0.7);
  drawTitle(s, 'The Contextual Intelligence Layer.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'A deterministic semantic classifier. No LLM in the decision path. The action-level intelligence no competitor has.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // Left column — context structs
  const leftX = PAD;
  const leftW = 5.8;
  const contextY = 2.85;

  s.addText('FOUR CONTEXTS', {
    x: leftX, y: contextY, w: leftW, h: 0.3,
    fontFace: FONT.mono, fontSize: 10, bold: true,
    color: COLORS.textMuted, charSpacing: 8, margin: 0,
  });
  s.addText('Assembled at decision time from immediate + cached state.', {
    x: leftX, y: contextY + 0.3, w: leftW, h: 0.3,
    fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, margin: 0,
  });

  const contexts = [
    ['SessionContext', 'agent identity · session id · push_count · denial_count · ci_failure_streak'],
    ['RepoContext', 'protected_branches · freeze_window_active · ci_passing · sensitivity_level'],
    ['BranchContext', 'is_aegis_managed · has_open_pr · branch_age · last_pushed_by'],
    ['EnvContext', 'environment_tier · active_incident · within_business_hours · deploy_locked'],
  ];

  contexts.forEach((c, i) => {
    const y = contextY + 0.75 + i * 0.62;
    s.addShape(pres.shapes.RECTANGLE, {
      x: leftX, y, w: leftW, h: 0.55,
      fill: { color: COLORS.bg },
      line: { color: COLORS.borderSoft, width: 0.5 },
    });
    s.addText(c[0], {
      x: leftX + 0.2, y, w: 1.9, h: 0.55,
      fontFace: FONT.mono, fontSize: 11.5, bold: true,
      color: COLORS.textStrong, valign: 'middle', margin: 0,
    });
    s.addText(c[1], {
      x: leftX + 2.15, y, w: leftW - 2.35, h: 0.55,
      fontFace: FONT.mono, fontSize: 9.5,
      color: COLORS.textMid, valign: 'middle', margin: 0,
    });
  });

  // Right column — semantic types
  const rightX = leftX + leftW + 0.5;
  const rightW = SLIDE_W - PAD - rightX;

  s.addText('10 CANONICAL SEMANTIC_TYPES', {
    x: rightX, y: contextY, w: rightW, h: 0.3,
    fontFace: FONT.mono, fontSize: 10, bold: true,
    color: COLORS.textMuted, charSpacing: 8, margin: 0,
  });
  s.addText('Every action classifies to exactly one. Policies fire deterministically.', {
    x: rightX, y: contextY + 0.3, w: rightW, h: 0.3,
    fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, margin: 0,
  });

  const semanticTypes = [
    ['working_commit', 'ALLOW', 'success'],
    ['ephemeral_force_push', 'ALLOW', 'success'],
    ['test_only_change', 'ALLOW', 'success'],
    ['protected_branch_write', 'REWRITE', 'brand'],
    ['freeze_window_violation', 'DENY', 'error'],
    ['credential_exposure', 'DENY', 'error'],
    ['autonomous_merge_attempt', 'DENY', 'error'],
    ['large_blast_radius_change', 'APPROVAL', 'warning'],
    ['sensitive_path_change', 'APPROVAL', 'warning'],
    ['sequence_anomaly', 'APPROVAL', 'warning'],
  ];

  const stRowH = 0.285;
  const stStartY = contextY + 0.75;
  semanticTypes.forEach((st, i) => {
    const y = stStartY + i * stRowH;
    const isAlt = i % 2 === 1;
    s.addShape(pres.shapes.RECTANGLE, {
      x: rightX, y, w: rightW, h: stRowH,
      fill: { color: isAlt ? COLORS.monoBg : COLORS.bg },
      line: { type: 'none' },
    });
    s.addText(st[0], {
      x: rightX + 0.15, y, w: rightW - 1.6, h: stRowH,
      fontFace: FONT.mono, fontSize: 11,
      color: st[2] === 'brand' ? COLORS.brandOrangeDark : COLORS.textStrong,
      bold: st[2] === 'brand',
      valign: 'middle', margin: 0,
    });
    const decisionColor = st[2] === 'success' ? COLORS.success : st[2] === 'brand' ? COLORS.brandOrangeDark : st[2] === 'error' ? COLORS.error : COLORS.warning;
    s.addText(st[1], {
      x: rightX + rightW - 1.5, y, w: 1.35, h: stRowH,
      fontFace: FONT.mono, fontSize: 10, bold: true,
      color: decisionColor, charSpacing: 4,
      align: 'right', valign: 'middle', margin: 0,
    });
  });

  // Bottom mono diagnostic
  s.addText([
    { text: 'latency ', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textMuted } },
    { text: '<10ms', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textStrong, bold: true } },
    { text: '   ·   auditability ', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textMuted } },
    { text: '100%', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textStrong, bold: true } },
    { text: '   ·   portability ', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textMuted } },
    { text: 'every MCP server', options: { fontFace: FONT.mono, fontSize: 10.5, color: COLORS.textStrong, bold: true } },
  ], { x: PAD, y: SLIDE_H - 0.85, w: SLIDE_W - 2 * PAD, h: 0.3, align: 'center', margin: 0 });

  drawFooter(s, 7, TOTAL);
}

// ── Slide 8: REWRITE ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'THE DIFFERENTIATOR', PAD, 0.7);
  drawTitle(s, 'REWRITE. The decision no one else has.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'Guild blocks. Aegis fixes. The agent\'s work survives. The protected branch stays clean.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // Three-step trace card (matches the dashboard REWRITE hero)
  const cardX = PAD;
  const cardW = SLIDE_W - 2 * PAD;
  const cardY = 2.85;
  const cardH = 3.4;

  s.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: { color: COLORS.bg },
    line: { color: COLORS.borderSoft, width: 0.75 },
  });
  // Card header
  s.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: cardW, h: 0.5,
    fill: { color: COLORS.monoBg },
    line: { color: COLORS.borderSoft, width: 0.5 },
  });
  s.addText('REWRITE TRACE', {
    x: cardX + 0.25, y: cardY, w: 3, h: 0.5,
    fontFace: FONT.mono, fontSize: 10, bold: true,
    color: COLORS.textMuted, charSpacing: 8, valign: 'middle', margin: 0,
  });
  s.addText('decision_path: classify → rewrite → execute', {
    x: cardX + cardW - 4.5, y: cardY, w: 4.25, h: 0.5,
    fontFace: FONT.mono, fontSize: 10, color: COLORS.textMid,
    valign: 'middle', align: 'right', margin: 0,
  });

  // Three steps as rows
  const steps = [
    {
      num: '01',
      label: 'agent_intent',
      action: 'push_files',
      target: 'origin/main',
      note: 'protected branch · direct write attempted',
      color: COLORS.error,
      bgTint: COLORS.errorTint,
      ringColor: 'F5BCC1',
    },
    {
      num: '02',
      label: 'aegis_classify',
      action: 'protected_branch_write',
      target: 'decision: REWRITE',
      note: 'CIL: blast_radius=high, classifier_confidence=1.0',
      color: COLORS.brandOrangeDark,
      bgTint: COLORS.brandOrangeTint,
      ringColor: COLORS.brandOrangeRing,
    },
    {
      num: '03',
      label: 'safe_outcome',
      action: 'push_files',
      target: 'origin/aegis_workstation + auto_pr → main',
      note: 'agent\'s work survives; main stays clean; PR opened for review',
      color: COLORS.success,
      bgTint: COLORS.successTint,
      ringColor: '9DCBAD',
    },
  ];

  const stepStartY = cardY + 0.65;
  const stepH = 0.85;
  const stepGap = 0.08;

  steps.forEach((step, i) => {
    const y = stepStartY + i * (stepH + stepGap);
    // Step row background
    s.addShape(pres.shapes.RECTANGLE, {
      x: cardX + 0.25, y, w: cardW - 0.5, h: stepH,
      fill: { color: step.bgTint },
      line: { color: step.ringColor, width: 0.5 },
    });
    // Step number
    s.addText(step.num, {
      x: cardX + 0.45, y, w: 0.5, h: stepH,
      fontFace: FONT.mono, fontSize: 16, bold: true,
      color: step.color, valign: 'middle', margin: 0,
    });
    // Step label
    s.addText(step.label, {
      x: cardX + 1.05, y, w: 2.0, h: stepH,
      fontFace: FONT.mono, fontSize: 12, bold: true,
      color: step.color, valign: 'middle', margin: 0,
    });
    // Action + target
    s.addText([
      { text: step.action, options: { fontFace: FONT.mono, fontSize: 13, bold: true, color: COLORS.textStrong } },
      { text: '   ' + step.target, options: { fontFace: FONT.mono, fontSize: 12, color: step.color } },
      { text: '   ' + step.note, options: { fontFace: FONT.sans, fontSize: 11, color: COLORS.textMid, italic: true } },
    ], { x: cardX + 3.15, y, w: cardW - 3.4, h: stepH, valign: 'middle', margin: 0 });
  });

  // Bottom: positioning quote
  s.addText([
    { text: 'Okta tells you who the agent is. Aegis governs what the agent does.', options: { fontFace: FONT.sans, fontSize: 13, italic: true, color: COLORS.textStrong } },
  ], { x: PAD, y: cardY + cardH + 0.2, w: SLIDE_W - 2 * PAD, h: 0.3, align: 'center', margin: 0 });
  s.addText('Guild requires migration. Anthropic auto-mode only works in sandboxes. Aegis is the only retrofit governance layer.', {
    x: PAD, y: cardY + cardH + 0.55, w: SLIDE_W - 2 * PAD, h: 0.25,
    fontFace: FONT.sans, fontSize: 11, color: COLORS.textMuted,
    align: 'center', margin: 0,
  });

  drawFooter(s, 8, TOTAL);
}

// ── Slide 9: Product ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'PRODUCT', PAD, 0.7);
  drawTitle(s, 'Live in production today.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'Four surfaces customers see. Every decision traceable to the four contexts that fired it.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // 4 product tiles in a 2x2 grid (each represents a screenshot placeholder)
  const tileX = PAD;
  const tileW = (SLIDE_W - 2 * PAD - 0.3) / 2;
  const tileH = 1.85;
  const tileY = 2.85;
  const gap = 0.3;

  const tiles = [
    {
      eyebrow: 'DASHBOARD',
      title: 'REWRITE in action',
      detail: 'Three-step trace renders the moment the moat fires. Brand-orange classify step is the customer-facing proof.',
      mono: 'app/dashboard/page.tsx',
      accent: true,
    },
    {
      eyebrow: 'RUNS',
      title: 'semantic_type chip on every row',
      detail: 'Every agent action ships with its canonical semantic_type and blast_radius. Customer reads the moat at a glance.',
      mono: 'semantic_type · protected_branch_write',
    },
    {
      eyebrow: 'APPROVAL DETAIL',
      title: 'Four-context evidence panel',
      detail: 'SessionContext · RepoContext · BranchContext · EnvContext rendered as 2×2 grid of key=value rows. Audit-grade reasoning trace.',
      mono: 'classifier_confidence: 1.00',
    },
    {
      eyebrow: 'CIL INSIGHTS',
      title: 'Distribution + canonical example',
      detail: 'Side-by-side same-action-different-decision diff proves the classifier is context-aware.',
      mono: 'distribution(by semantic_type)',
    },
  ];

  tiles.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = tileX + col * (tileW + gap);
    const y = tileY + row * (tileH + gap);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: tileW, h: tileH,
      fill: { color: tile.accent ? COLORS.brandOrangeTint : COLORS.bg },
      line: { color: tile.accent ? COLORS.brandOrangeRing : COLORS.borderSoft, width: 0.75 },
    });
    if (tile.accent) {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: tileW, h: 0.05,
        fill: { color: COLORS.brandOrange }, line: { type: 'none' },
      });
    }
    s.addText(tile.eyebrow, {
      x: x + 0.25, y: y + 0.2, w: tileW - 0.5, h: 0.3,
      fontFace: FONT.mono, fontSize: 9.5, bold: true,
      color: tile.accent ? COLORS.brandOrange : COLORS.textMuted,
      charSpacing: 8, margin: 0,
    });
    s.addText(tile.title, {
      x: x + 0.25, y: y + 0.5, w: tileW - 0.5, h: 0.5,
      fontFace: FONT.sans, fontSize: 16, bold: true,
      color: tile.accent ? COLORS.brandOrangeDark : COLORS.textStrong,
      charSpacing: 0, lineSpacingMultiple: 1.15, margin: 0,
    });
    s.addText(tile.detail, {
      x: x + 0.25, y: y + 1.0, w: tileW - 0.5, h: 0.55,
      fontFace: FONT.sans, fontSize: 11.5,
      color: COLORS.textMid, lineSpacingMultiple: 1.4, margin: 0,
    });
    s.addText(tile.mono, {
      x: x + 0.25, y: y + tileH - 0.35, w: tileW - 0.5, h: 0.3,
      fontFace: FONT.mono, fontSize: 9.5,
      color: COLORS.textMuted, margin: 0,
    });
  });

  drawFooter(s, 9, TOTAL);
}

// ── Slide 10: Market + Competition ───────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'MARKET & COMPETITION', PAD, 0.7);
  drawTitle(s, 'The category is forming.\nFunded. Aegis is the missing layer.', { y: 1.05, h: 1.7, size: 32 });

  // Left column: funded competitors signal
  const leftX = PAD;
  const leftW = 5.8;
  const fundY = 2.9;

  s.addText('ADJACENT FUNDING (LAST 12 MONTHS)', {
    x: leftX, y: fundY, w: leftW, h: 0.3,
    fontFace: FONT.mono, fontSize: 9.5, bold: true,
    color: COLORS.textMuted, charSpacing: 2, margin: 0,
  });

  const funded = [
    { name: 'Guild.ai', amount: '$44M', backers: 'GV · Khosla', note: 'requires agent migration · binary allow/deny' },
    { name: 'RunLayer', amount: '$11M', backers: 'Khosla · Felicis', note: 'sandbox-bound · no production governance' },
    { name: 'Gumstack', amount: '$50M', backers: 'Benchmark', note: 'post-hoc evaluation · not pre-action' },
  ];

  funded.forEach((f, i) => {
    const y = fundY + 0.45 + i * 0.85;
    s.addShape(pres.shapes.RECTANGLE, {
      x: leftX, y, w: leftW, h: 0.75,
      fill: { color: COLORS.bg },
      line: { color: COLORS.borderSoft, width: 0.5 },
    });
    // Row 1: name (left) · amount (center) · backers (right)
    s.addText(f.name, {
      x: leftX + 0.2, y: y + 0.08, w: 2.0, h: 0.3,
      fontFace: FONT.sans, fontSize: 14, bold: true,
      color: COLORS.textStrong, margin: 0,
    });
    s.addText(f.amount, {
      x: leftX + 2.25, y: y + 0.08, w: 1.2, h: 0.3,
      fontFace: FONT.mono, fontSize: 13, bold: true,
      color: COLORS.brandOrangeDark, margin: 0,
    });
    s.addText(f.backers, {
      x: leftX + 3.5, y: y + 0.08, w: leftW - 3.7, h: 0.3,
      fontFace: FONT.mono, fontSize: 10,
      color: COLORS.textMuted, align: 'right', margin: 0,
    });
    // Row 2: note (full width below)
    s.addText(f.note, {
      x: leftX + 0.2, y: y + 0.42, w: leftW - 0.4, h: 0.3,
      fontFace: FONT.sans, fontSize: 11,
      color: COLORS.textMid, italic: true, margin: 0,
    });
  });

  // Right column: positioning
  const rightX = leftX + leftW + 0.5;
  const rightW = SLIDE_W - PAD - rightX;

  s.addText('POSITIONING', {
    x: rightX, y: fundY, w: rightW, h: 0.3,
    fontFace: FONT.mono, fontSize: 9.5, bold: true,
    color: COLORS.textMuted, charSpacing: 2, margin: 0,
  });

  const positions = [
    { label: 'Okta', detail: 'identity layer · knows who the agent is, not what it does', match: false },
    { label: 'Anthropic auto-mode', detail: 'sandbox-bound · doesn\'t run against production systems', match: false },
    { label: 'Guild.ai', detail: 'requires migrating agents into their runtime', match: false },
    { label: 'Aegis', detail: 'action-level · REWRITE · no migration · audit-grade evidence', match: true },
  ];

  positions.forEach((p, i) => {
    const y = fundY + 0.45 + i * 0.65;
    s.addShape(pres.shapes.RECTANGLE, {
      x: rightX, y, w: rightW, h: 0.55,
      fill: { color: p.match ? COLORS.brandOrangeTint : COLORS.bg },
      line: { color: p.match ? COLORS.brandOrangeRing : COLORS.borderSoft, width: p.match ? 1 : 0.5 },
    });
    s.addText(p.label, {
      x: rightX + 0.2, y, w: 2.0, h: 0.55,
      fontFace: FONT.sans, fontSize: 13, bold: true,
      color: p.match ? COLORS.brandOrangeDark : COLORS.textStrong,
      valign: 'middle', margin: 0,
    });
    s.addText(p.detail, {
      x: rightX + 2.25, y, w: rightW - 2.45, h: 0.55,
      fontFace: FONT.sans, fontSize: 11,
      color: p.match ? COLORS.brandOrangeDark : COLORS.textMid,
      valign: 'middle', margin: 0,
    });
  });

  // Bottom centered tagline
  s.addText('"Guild governs agents by moving them. Aegis governs them wherever they already run."', {
    x: PAD, y: SLIDE_H - 0.95, w: SLIDE_W - 2 * PAD, h: 0.4,
    fontFace: FONT.sans, fontSize: 13, italic: true,
    color: COLORS.textStrong, align: 'center', margin: 0,
  });

  drawFooter(s, 10, TOTAL);
}

// ── Slide 11: GTM ────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'GO-TO-MARKET', PAD, 0.7);
  drawTitle(s, 'Bottom-up adoption.\nTop-down expansion.', { y: 1.05, h: 1.7, size: 32 });
  drawSubtitle(s, 'Same shape as Linear and Vercel. Tech Lead installs in 15 min. Sec/Platform turns it into the standard.', { y: 2.75, w: 11.0, h: 0.6, size: 13 });

  // Two-phase visual
  const phaseY = 3.6;
  const phaseH = 2.4;
  const phaseW = (SLIDE_W - 2 * PAD - 0.4) / 2;
  const gap = 0.4;

  const phases = [
    {
      num: 'PHASE 1',
      title: 'LAND',
      who: 'Tech Lead · Engineering Manager',
      what: 'Shadow Mode install · 15 min · zero migration',
      offer: '7-day Agent Risk Report shows what the agent would have done',
      price: 'Free · forever during pilot',
      bgTint: COLORS.monoBg,
      ringColor: COLORS.borderSoft,
    },
    {
      num: 'PHASE 2',
      title: 'EXPAND',
      who: 'Security · Platform · DevSecOps Engineer',
      what: 'Enforcement mode · per-role tool allowlists · custom policies',
      offer: 'SOC 2 evidence package · audit export · freeze windows',
      price: '$X per agent · per month (placeholder)',
      bgTint: COLORS.brandOrangeTint,
      ringColor: COLORS.brandOrangeRing,
      accent: true,
    },
  ];

  phases.forEach((p, i) => {
    const x = PAD + i * (phaseW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: phaseY, w: phaseW, h: phaseH,
      fill: { color: p.bgTint },
      line: { color: p.ringColor, width: p.accent ? 1.25 : 0.75 },
    });
    s.addText(p.num, {
      x: x + 0.3, y: phaseY + 0.2, w: phaseW - 0.6, h: 0.3,
      fontFace: FONT.mono, fontSize: 10, bold: true,
      color: p.accent ? COLORS.brandOrangeDark : COLORS.textMuted,
      charSpacing: 8, margin: 0,
    });
    s.addText(p.title, {
      x: x + 0.3, y: phaseY + 0.5, w: phaseW - 0.6, h: 0.5,
      fontFace: FONT.sans, fontSize: 28, bold: true,
      color: p.accent ? COLORS.brandOrangeDark : COLORS.textStrong,
      charSpacing: 0, margin: 0,
    });

    const rows = [
      ['BUYER', p.who],
      ['WHAT', p.what],
      ['VALUE', p.offer],
      ['PRICE', p.price],
    ];
    rows.forEach((r, j) => {
      const ry = phaseY + 1.1 + j * 0.3;
      s.addText(r[0], {
        x: x + 0.3, y: ry, w: 0.8, h: 0.28,
        fontFace: FONT.mono, fontSize: 9, bold: true,
        color: COLORS.textMuted, charSpacing: 6, margin: 0,
      });
      s.addText(r[1], {
        x: x + 1.15, y: ry, w: phaseW - 1.45, h: 0.28,
        fontFace: FONT.sans, fontSize: 11,
        color: COLORS.textStrong, margin: 0,
      });
    });
  });

  // Flow arrow between phases
  s.addShape(pres.shapes.LINE, {
    x: PAD + phaseW + 0.05, y: phaseY + phaseH / 2,
    w: gap - 0.1, h: 0,
    line: { color: COLORS.textMuted, width: 1.5, endArrowType: 'triangle' },
  });

  // Bottom strip
  s.addText('Identical pattern to Linear (engineers adopt) and Vercel (platforms standardize). Aegis lands via incident curiosity, expands via SOC 2 pressure.', {
    x: PAD, y: SLIDE_H - 0.85, w: SLIDE_W - 2 * PAD, h: 0.3,
    fontFace: FONT.sans, fontSize: 11.5, color: COLORS.textMuted,
    align: 'center', italic: true, margin: 0,
  });

  drawFooter(s, 11, TOTAL);
}

// ── Slide 12: Traction ───────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'TRACTION', PAD, 0.7);
  drawTitle(s, 'Live product. Real signal.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'Backend shipping. Frontend deployed. Accelerator presence. First design partner in flight.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // Big stat callout (left)
  const statY = 2.85;
  const bigStatW = 4.5;
  s.addShape(pres.shapes.RECTANGLE, {
    x: PAD, y: statY, w: bigStatW, h: 3.5,
    fill: { color: COLORS.brandOrangeTint },
    line: { color: COLORS.brandOrangeRing, width: 1 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: PAD, y: statY, w: bigStatW, h: 0.05,
    fill: { color: COLORS.brandOrange }, line: { type: 'none' },
  });
  s.addText('68%', {
    x: PAD + 0.3, y: statY + 0.3, w: bigStatW - 0.6, h: 1.4,
    fontFace: FONT.sans, fontSize: 108, bold: true,
    color: COLORS.brandOrangeDark, charSpacing: -3, margin: 0,
  });
  s.addText('TOKEN REDUCTION PER SESSION', {
    x: PAD + 0.3, y: statY + 1.65, w: bigStatW - 0.6, h: 0.3,
    fontFace: FONT.mono, fontSize: 10.5, bold: true,
    color: COLORS.brandOrangeDark, charSpacing: 2, margin: 0,
  });
  drawMonoChip(s, PAD + 0.3, statY + 2.05, 'before', '4,537 tokens', { w: 1.85, bg: COLORS.bg });
  drawMonoChip(s, PAD + 2.25, statY + 2.05, 'after', '1,471 tokens', { w: 1.85, bg: COLORS.bg, valueColor: COLORS.brandOrangeDark });
  s.addText('Aegis token optimization shipped in production. Same governance signal at 1/3 the LLM cost.', {
    x: PAD + 0.3, y: statY + 2.55, w: bigStatW - 0.6, h: 0.7,
    fontFace: FONT.sans, fontSize: 11.5,
    color: COLORS.brandOrangeDark, lineSpacingMultiple: 1.4, margin: 0,
  });

  // Right column: proof points
  const proofX = PAD + bigStatW + 0.3;
  const proofW = SLIDE_W - PAD - proofX;
  const proofPoints = [
    { eyebrow: 'LIVE', title: 'Product running in production', detail: 'dashboard.runaegis.co · app.runaegis.co · custom domain' },
    { eyebrow: 'SHIPPING', title: 'Backend classifier in production', detail: 'semantic_classifier.py · 12 semantic_types · 10 policies' },
    { eyebrow: 'VALIDATED', title: 'DevLabs Momentum demo day', detail: 'a16z · SPC · Antler · Kickstart attended' },
    { eyebrow: 'ACCELERATOR', title: 'Founders Inc Canopy + a16z Speed Run', detail: 'application submitted · interview pipeline open' },
    { eyebrow: 'PIPELINE', title: 'First conversation in flight', detail: 'Alexey Grigorev (DataTalksClub) outreach active' },
  ];

  proofPoints.forEach((p, i) => {
    const rowH = 0.7;
    const y = statY + i * rowH;
    s.addText(p.eyebrow, {
      x: proofX, y: y + 0.02, w: 2.6, h: 0.22,
      fontFace: FONT.mono, fontSize: 9, bold: true,
      color: COLORS.brandOrange, charSpacing: 3, margin: 0,
    });
    s.addText(p.title, {
      x: proofX, y: y + 0.24, w: proofW, h: 0.26,
      fontFace: FONT.sans, fontSize: 13.5, bold: true,
      color: COLORS.textStrong, margin: 0,
    });
    s.addText(p.detail, {
      x: proofX, y: y + 0.48, w: proofW, h: 0.18,
      fontFace: FONT.mono, fontSize: 9.5,
      color: COLORS.textMid, margin: 0,
    });
    if (i < 4) {
      s.addShape(pres.shapes.LINE, {
        x: proofX, y: y + rowH - 0.02, w: proofW, h: 0,
        line: { color: COLORS.borderSoft, width: 0.5 },
      });
    }
  });

  drawFooter(s, 12, TOTAL);
}

// ── Slide 13: Team ───────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };

  drawEyebrow(s, 'TEAM', PAD, 0.7);
  drawTitle(s, 'Building Aegis full-time.', { y: 1.05, h: 0.9, size: 32 });
  drawSubtitle(s, 'Founder + engineering team shipping the live product, the canonical CIL, and the v3 demo.', { y: 2.0, w: 11.0, h: 0.6, size: 13 });

  // 4-up team cards
  const tx = PAD;
  const tw = (SLIDE_W - 2 * PAD - 0.6) / 4;
  const th = 3.5;
  const ty = 2.85;
  const tg = 0.2;

  const team = [
    {
      name: 'Ahaan Iqbal',
      role: 'Founder / CEO',
      detail: 'Built dashboard.runaegis.co · led canonical CIL design · runs GTM, fundraise, design',
      placeholder: '[Prior: company / role / shipped product · school]',
    },
    {
      name: 'Jenil Parmar',
      role: 'Engineering lead',
      detail: 'Owns lib/semantic_classifier.py · 12 semantic_types live in production · 10 policies shipping',
      placeholder: '[Prior: company / role / shipped product · school]',
    },
    {
      name: 'Kartik Gupta',
      role: 'Engineer',
      detail: 'Owns API + auth + room logic · GitHub OAuth shipped · routing layer architect',
      placeholder: '[Prior: company / role / shipped product · school]',
    },
    {
      name: 'Mujtaba',
      role: 'Engineer',
      detail: 'Sub-agent governance design · MCP shim design · policy research lead',
      placeholder: '[Prior: company / role / shipped product · school]',
    },
  ];

  team.forEach((p, i) => {
    const x = tx + i * (tw + tg);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: ty, w: tw, h: th,
      fill: { color: COLORS.bg },
      line: { color: COLORS.borderSoft, width: 0.75 },
    });
    // Initials avatar
    const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    s.addShape(pres.shapes.OVAL, {
      x: x + tw / 2 - 0.6, y: ty + 0.35, w: 1.2, h: 1.2,
      fill: { color: COLORS.brandOrangeTint },
      line: { color: COLORS.brandOrangeRing, width: 1 },
    });
    s.addText(initials, {
      x: x + tw / 2 - 0.6, y: ty + 0.35, w: 1.2, h: 1.2,
      fontFace: FONT.sans, fontSize: 26, bold: true,
      color: COLORS.brandOrangeDark, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(p.name, {
      x: x + 0.2, y: ty + 1.7, w: tw - 0.4, h: 0.4,
      fontFace: FONT.sans, fontSize: 15, bold: true,
      color: COLORS.textStrong, align: 'center', margin: 0,
    });
    s.addText(p.role, {
      x: x + 0.2, y: ty + 2.05, w: tw - 0.4, h: 0.3,
      fontFace: FONT.mono, fontSize: 10,
      color: COLORS.brandOrangeDark, charSpacing: 4, align: 'center', margin: 0,
    });
    s.addText(p.detail, {
      x: x + 0.2, y: ty + 2.4, w: tw - 0.4, h: 0.7,
      fontFace: FONT.sans, fontSize: 10.5,
      color: COLORS.textMid, lineSpacingMultiple: 1.35,
      align: 'center', margin: 0,
    });
    s.addText(p.placeholder, {
      x: x + 0.2, y: ty + 3.1, w: tw - 0.4, h: 0.35,
      fontFace: FONT.mono, fontSize: 9,
      color: COLORS.textMuted, italic: true,
      align: 'center', margin: 0,
    });
  });

  drawFooter(s, 13, TOTAL);
}

// ── Slide 14: Ask + 18-month plan ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: COLORS.bgDark };

  drawEyebrow(s, 'THE ASK', PAD, 0.7, COLORS.brandOrange);
  s.addText('$2.5M seed.', {
    x: PAD, y: 1.05, w: SLIDE_W - 2 * PAD, h: 1.0,
    fontFace: FONT.sans, fontSize: 72, bold: true,
    color: COLORS.textInvert, charSpacing: -2, margin: 0,
  });
  s.addText('$10-15M post. Building the AI agent control plane.', {
    x: PAD, y: 2.15, w: SLIDE_W - 2 * PAD, h: 0.5,
    fontFace: FONT.sans, fontSize: 20,
    color: COLORS.textInvertMuted, margin: 0,
  });

  // Timeline of milestones
  const tlY = 3.3;
  const tlH = 2.0;
  const tlX = PAD;
  const tlW = SLIDE_W - 2 * PAD;
  const colW = (tlW - 0.6) / 4;
  const colGap = 0.2;

  const milestones = [
    { q: 'Q3 2026', goal: 'Ship CIL surfacing · 3 paying design partners · multi-MCP foundation' },
    { q: 'Q4 2026', goal: '10 customers · Slack + Linear connectors live · SOC 2 Type I' },
    { q: 'Q1 2027', goal: '$1M ARR · enterprise tier · Series A readiness' },
    { q: 'Q2 2027', goal: 'Series A · multi-org · audit & compliance suite' },
  ];

  milestones.forEach((m, i) => {
    const x = tlX + i * (colW + colGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: tlY, w: colW, h: tlH,
      fill: { color: '12161C' },
      line: { color: '1F2329', width: 0.75 },
    });
    s.addText(m.q, {
      x: x + 0.25, y: tlY + 0.2, w: colW - 0.5, h: 0.35,
      fontFace: FONT.mono, fontSize: 11, bold: true,
      color: COLORS.brandOrange, charSpacing: 8, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.25, y: tlY + 0.6, w: 0.5, h: 0.04,
      fill: { color: COLORS.brandOrange }, line: { type: 'none' },
    });
    s.addText(m.goal, {
      x: x + 0.25, y: tlY + 0.75, w: colW - 0.5, h: 1.15,
      fontFace: FONT.sans, fontSize: 12,
      color: COLORS.textInvert, lineSpacingMultiple: 1.45, margin: 0,
    });
  });

  // Bottom contact strip
  s.addShape(pres.shapes.RECTANGLE, {
    x: PAD, y: 6.1, w: SLIDE_W - 2 * PAD, h: 0.5,
    fill: { color: '12161C' },
    line: { color: COLORS.brandOrange, width: 1 },
  });
  s.addText([
    { text: 'ahaan@runaegis.co', options: { fontFace: FONT.mono, fontSize: 13, color: COLORS.brandOrange, bold: true } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 13, color: COLORS.textInvertMuted } },
    { text: 'dashboard.runaegis.co', options: { fontFace: FONT.mono, fontSize: 13, color: COLORS.textInvert } },
    { text: '   ·   ', options: { fontFace: FONT.mono, fontSize: 13, color: COLORS.textInvertMuted } },
    { text: 'Live demo: [Loom link]', options: { fontFace: FONT.mono, fontSize: 13, color: COLORS.textInvert } },
  ], { x: PAD, y: 6.1, w: SLIDE_W - 2 * PAD, h: 0.5, valign: 'middle', align: 'center', margin: 0 });

  drawFooter(s, 14, TOTAL, true);
}

// ─── Save ───────────────────────────────────────────────────────────────────

const OUT = path.resolve(__dirname, '..', 'Aegis-Pitch-Deck.pptx');
pres.writeFile({ fileName: OUT }).then(() => {
  console.log('Saved:', OUT);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
