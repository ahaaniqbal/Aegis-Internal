/**
 * Apply the Decision Overview-style inset gradient to all 5
 * email templates.
 *
 * Structure transform per template:
 *
 *   BEFORE
 *   ──────
 *   <table class="...bg-card border-card" ...>
 *     <tr>...content row 1...</tr>
 *     <tr>...content row 2...</tr>
 *     ...
 *   </table>
 *
 *   AFTER
 *   ─────
 *   <table class="...bg-card border-card" ...>   (outer white frame, 14px radius)
 *     <tr>
 *       <td style="padding:4px;">                 (4px inset margin)
 *         <table class="bg-card-inner" ...>       (inner gradient panel, 10px radius)
 *           <tr>...content row 1...</tr>
 *           <tr>...content row 2...</tr>
 *           ...
 *         </table>
 *       </td>
 *     </tr>
 *   </table>
 *
 * Plus injects the `.bg-card-inner` CSS rule (light + dark mode)
 * into the existing <style> block.
 *
 * The gradient mirrors what the dashboard's Decision Overview
 * hero / freeze status banner / SetupChecklist use:
 *
 *   linear-gradient(180deg,
 *     rgba(250, 115, 25, 0.07)  0%,
 *     rgba(250, 115, 25, 0.03) 28%,
 *     rgba(255, 255, 255, 0)   60%
 *   )
 *
 * Outlook desktop strips background-image + border-radius and
 * falls back to a flat white card. Modern clients (Apple, iOS,
 * Gmail web, Yahoo) render the full inset effect.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES = [
  'verify-email.html',
  'reset-password.html',
  'welcome.html',
  'approval-request.html',
  'invite-room.html',
];

const CSS_INJECT = `
    /* Inset orange-tint gradient panel.
       Mirrors the Decision Overview hero / freeze status banner /
       SetupChecklist on the dashboard. Outer card stays white;
       this inner table sits inset 4px and carries the gradient
       so it reads as a soft inner panel wash. */
    .bg-card-inner {
      background-color: transparent;
      background-image: linear-gradient(180deg, rgba(250,115,25,0.07) 0%, rgba(250,115,25,0.03) 28%, rgba(255,255,255,0) 60%);
    }
    @media (prefers-color-scheme: dark) {
      .bg-card-inner {
        background-image: linear-gradient(180deg, rgba(250,115,25,0.10) 0%, rgba(250,115,25,0.04) 28%, rgba(22,22,22,0) 60%) !important;
      }
    }
    [data-ogsc] .bg-card-inner {
      background-image: linear-gradient(180deg, rgba(250,115,25,0.10) 0%, rgba(250,115,25,0.04) 28%, rgba(22,22,22,0) 60%) !important;
    }`;

const INNER_OPEN = `
          <tr>
            <td style="padding: 4px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="bg-card-inner" style="background-image: linear-gradient(180deg, rgba(250,115,25,0.07) 0%, rgba(250,115,25,0.03) 28%, rgba(255,255,255,0) 60%); border-radius: 10px;">`;

const INNER_CLOSE = `              </table>
            </td>
          </tr>`;

/**
 * Find the matching `</table>` for a given opening `<table>`
 * index. Returns the byte offset where the closing tag starts.
 *
 * Uses a depth counter so nested tables (the metadata grids,
 * button rows, etc.) don't confuse us.
 */
function findMatchingClose(html, openIdx) {
  // Scan from just after the opening `<table` past its `>`.
  let depth = 0;
  let i = openIdx;
  // Move past the first `>` so we're inside the element.
  const firstGt = html.indexOf('>', openIdx);
  i = firstGt + 1;
  depth = 1;

  const tableOpen = /<table\b[^>]*>/gi;
  const tableClose = /<\/table>/gi;

  while (depth > 0 && i < html.length) {
    tableOpen.lastIndex = i;
    tableClose.lastIndex = i;
    const o = tableOpen.exec(html);
    const c = tableClose.exec(html);
    if (!c) return -1;
    if (o && o.index < c.index) {
      depth++;
      i = o.index + o[0].length;
    } else {
      depth--;
      i = c.index + c[0].length;
      if (depth === 0) return c.index;
    }
  }
  return -1;
}

for (const file of TEMPLATES) {
  let html = readFileSync(join(__dirname, file), 'utf-8');

  // Skip if already applied (idempotent).
  if (html.includes('class="bg-card-inner"')) {
    console.log(`= ${file} (already wrapped, skipped)`);
    continue;
  }

  // 1. Inject CSS just before the closing </style>.
  html = html.replace('</style>', `${CSS_INJECT}\n  </style>`);

  // 2. Find the card's outer table opening. Matches the line
  //    that includes `class="...bg-card border-card..."`.
  const cardOpenRegex = /<table[^>]*\bclass="[^"]*\bbg-card\s+border-card[^"]*"[^>]*>/i;
  const m = cardOpenRegex.exec(html);
  if (!m) {
    console.error(`✗ ${file}: couldn't find card opening table - skipped`);
    continue;
  }
  const openIdx = m.index;
  const openEnd = openIdx + m[0].length;

  // 3. Find the matching closing </table> for the card.
  const closeIdx = findMatchingClose(html, openIdx);
  if (closeIdx < 0) {
    console.error(`✗ ${file}: couldn't find card closing - skipped`);
    continue;
  }

  // 4. Splice in the inner-table opening right after the card
  //    opening, and the inner-table closing right before the
  //    card closing.
  const before = html.slice(0, openEnd);
  const middle = html.slice(openEnd, closeIdx);
  const after = html.slice(closeIdx);
  html = before + INNER_OPEN + middle + INNER_CLOSE + '\n        ' + after;

  writeFileSync(join(__dirname, file), html, 'utf-8');
  console.log(`✓ ${file}`);
}

console.log('\nDone. Re-run _render-preview.mjs to refresh the .filled files.');
