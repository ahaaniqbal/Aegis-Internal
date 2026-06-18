/**
 * Round 2 revisions to all 5 email templates. Idempotent.
 *
 * Addresses three pieces of feedback from the agentation pass:
 *
 *   1. Card border-radius wasn't clipping. Tables collapse cells,
 *      so border-radius on `<table>` paints the border-arc but the
 *      child cells still render rectangular against the gradient
 *      inside. Move the bg-color + border + radius to the wrapping
 *      `<td>` instead — that clips correctly in Apple Mail, iOS,
 *      Gmail web, Yahoo, Outlook 2019+. Outlook 2007-2016 strip
 *      border-radius entirely and fall back to sharp corners.
 *
 *   2. Switch the font stack to Geist + Geist Mono so the emails
 *      typographically match the dashboard. Web fonts in email:
 *      Apple Mail / iOS Mail / Outlook 2016+ load <link>'d Google
 *      Fonts cleanly; Gmail web strips the <link> and falls back
 *      to system fonts, which is fine. System fallback chain stays
 *      first-class.
 *
 *   3. Move the "Aegis · AI agent governance / runaegis.co" brand
 *      block from OUTSIDE the white card to INSIDE, just below the
 *      legal footnote, with a hairline divider between them. Keeps
 *      the whole email visually contained in one card.
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

// ── Google Fonts link — preconnect + stylesheet. Inserted right
// after the <title> in each template's <head>. ──
const FONTS_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">`;

// ── Font stack swaps. Keep the long system-font fallback so
// every email client lands somewhere acceptable. ──
const SANS_OLD = "font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SANS_NEW = "font-family:'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const MONO_OLD = "font-family:'SF Mono', Menlo, Monaco, Consolas, monospace";
const MONO_NEW = "font-family:'Geist Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace";

// ── Card restructure. Old: bg+border+radius on the outer <table>.
// New: those styles move to the wrapping <td> so the corners
// clip the inner gradient panel. ──
const CARD_OLD_RE = /<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" class="container bg-card border-card" style="width:560px; max-width:560px; background-color:#ffffff; border:1px solid #ececec; border-radius:14px;">/;
const CARD_NEW = '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" class="container" style="width:560px; max-width:560px;">';

// And the wrapping <td> inside the outer table — picks up the
// visual styling that used to live on the table.
const TD_OLD = '<td style="padding: 4px;">';
const TD_NEW = '<td class="bg-card border-card" style="padding: 4px; background-color:#ffffff; border:1px solid #ececec; border-radius:14px;">';

// ── Brand footer block to inject INSIDE the card. Uses the same
// font stack and color tokens as the rest of the templates. ──
const BRAND_FOOTER_ROWS = `
              <!-- Hairline separator + brand footer (moved inside the
                   card so the whole email reads as one contained
                   surface). -->
              <tr>
                <td class="px-mobile" style="padding: 0 40px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr><td class="border-divider" style="border-top:1px solid #ececec; line-height:1px; font-size:1px;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <tr><td height="16" style="height:16px; line-height:16px; font-size:16px;">&nbsp;</td></tr>
              <tr>
                <td align="center" class="px-mobile" style="padding: 0 40px 28px 40px;">
                  <p class="text-soft" style="margin:0 0 4px 0; font-family:'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:12px; line-height:1.5; color:#a3a3a3;">
                    Aegis &middot; AI agent governance
                  </p>
                  <p class="text-soft" style="margin:0; font-family:'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:12px; line-height:1.5; color:#a3a3a3;">
                    <a href="https://runaegis.co" target="_blank" style="color:#a3a3a3; text-decoration:underline;">runaegis.co</a>
                    &middot;
                    <a href="mailto:support@runaegis.co" style="color:#a3a3a3; text-decoration:underline;">support@runaegis.co</a>
                  </p>
                </td>
              </tr>`;

// ── Outside-card footer block to strip. Matches both the version
// with the "Footer outside the card" comment and the one without
// (some templates have the comment, some don't). The block always
// starts with a 560px container <table> that's NOT bg-card. ──
function stripOutsideFooter(html) {
  // Match optional comment + the footer container table + everything
  // up to its closing </table>. We anchor on the brand text inside
  // ("Aegis &middot; AI agent governance") to avoid false matches.
  const outsidePattern = /\n\s*(?:<!-- Footer outside the card[^>]*-->\s*)?<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" class="container" style="width:560px; max-width:560px;">[\s\S]*?Aegis &middot; AI agent governance[\s\S]*?<\/table>\s*\n/;
  return html.replace(outsidePattern, '\n\n');
}

// ── Reduce the existing legal-footnote row's bottom padding so
// the new brand block doesn't sit too far away from it. The
// footnote row is always the LAST content <tr> in the inner
// gradient table, with `padding: 0 40px 36px 40px;`. ──
function tightenFootnotePadding(html) {
  // Use a narrow capture so we only touch the actual footnote row,
  // which uniquely has `padding: 0 40px 36px 40px` followed by a
  // closing </tr> shortly after.
  return html.replace(
    /padding: 0 40px 36px 40px;">\s*<p class="text-soft"/g,
    'padding: 0 40px 20px 40px;">\n              <p class="text-soft"',
  );
}

// ── Insert brand footer rows right before the inner gradient
// table's closing </table>. The inner table's close is the FIRST
// </table> after a `<!-- Footer outside the card -->` comment WAS
// in the file, OR we can just find the INNER_CLOSE marker. To be
// reliable, we look for the unique pattern that closes the inner
// gradient table — a </table> immediately followed by `</td>` then
// `</tr>` then another `</table>`. That's the inner→outer transition. ──
function injectBrandFooter(html) {
  // Pattern: end of last inner row + start of inner table close.
  // We inject BRAND_FOOTER_ROWS right at the `              </table>` (inner gradient close)
  // which is followed by `            </td>` (outer td close) and `          </tr>` (outer tr close).
  const innerClosePattern = /(\n\s*<\/table>\s*\n\s*<\/td>\s*\n\s*<\/tr>\s*\n\s*<\/table>)/;
  return html.replace(innerClosePattern, `\n${BRAND_FOOTER_ROWS}$1`);
}

for (const file of TEMPLATES) {
  let html = readFileSync(join(__dirname, file), 'utf-8');

  // ── 1. Card restructure (idempotent — skip if already done) ──
  if (CARD_OLD_RE.test(html)) {
    html = html.replace(CARD_OLD_RE, CARD_NEW);
    html = html.replace(TD_OLD, TD_NEW);
  }

  // ── 2. Geist fonts (idempotent — skip if link already there) ──
  if (!html.includes('family=Geist')) {
    html = html.replace(/<\/title>/, `</title>${FONTS_LINK}`);
  }
  html = html.split(SANS_OLD).join(SANS_NEW);
  html = html.split(MONO_OLD).join(MONO_NEW);

  // ── 3. Move brand footer inside card (idempotent — only if
  //      outside block still exists) ──
  const hadOutsideFooter = /class="container" style="width:560px; max-width:560px;">\s*\n\s*<tr>\s*\n\s*<td align="center"[\s\S]*?Aegis &middot;/.test(html);
  if (hadOutsideFooter) {
    html = stripOutsideFooter(html);
    html = tightenFootnotePadding(html);
    html = injectBrandFooter(html);
  }

  writeFileSync(join(__dirname, file), html, 'utf-8');
  console.log(`✓ ${file}`);
}

console.log('\nDone. Re-run _render-preview.mjs to refresh the filled previews.');
