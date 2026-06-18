/**
 * Render preview HTML files from the source templates.
 *
 * Substitutes `{{var}}` placeholders with sample data so the
 * preview index can iframe each one. Run once whenever the
 * templates change:
 *
 *   node email-templates/_render-preview.mjs
 *
 * Output files (.filled.html) are gitignored - they're previews
 * only, the source-of-truth lives in the un-suffixed files.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single source of sample data - covers vars across all 5
// templates. Anything missing renders as the literal `{{var}}`
// so undefined vars surface during preview.
const SAMPLE = {
  // ─ Identity ─
  firstName: 'Ahaan',
  email: 'ahaan@runaegis.co',

  // ─ Verify / Reset ─
  verifyUrl: 'https://runaegis.co/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFlZ2lzIiwiaWF0IjoxNTE2MjM5MDIyfQ',
  resetUrl: 'https://runaegis.co/reset?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyc3QiOiJ0cnVlIiwibmFtZSI6IkFlZ2lzIn0',
  expiresIn: '24 hours',
  requestedAt: 'May 21, 2026 at 3:14 PM PT',
  requestedIp: '73.241.116.42',
  requestedDevice: 'Chrome on macOS',

  // ─ Welcome ─
  dashboardUrl: 'https://runaegis.co/dashboard',
  docsUrl: 'https://docs.runaegis.co',

  // ─ Approval ─
  agentName: 'claude-sonnet-4',
  toolName: 'create_or_update_file',
  actionSummary: 'Create file src/lib/auth.ts with OAuth callback handler and session validation.',
  repoName: 'acme/api-server',
  branchName: 'feat/oauth-flow',
  roomName: 'API Server',
  roomId: 'b947d954-c3be-73c5-9e7e-6b41a3f8',
  approvalId: 'appr_01HXQ9KZ4M2VR7N3PD8FYT6BS',
  approveUrl: 'https://runaegis.co/dashboard/approvals/appr_01HXQ/approve',
  denyUrl: 'https://runaegis.co/dashboard/approvals/appr_01HXQ/deny',
  reviewUrl: 'https://runaegis.co/dashboard/approvals/appr_01HXQ',
  roomToolsUrl: 'https://runaegis.co/dashboard/rooms/b947/tools',
  notificationSettingsUrl: 'https://runaegis.co/dashboard/settings#notifications',

  // ─ Invite ─
  inviterName: 'Jenil Parmar',
  inviterEmail: 'jenil@runaegis.co',
  roleName: 'ADMIN',
  roomInitials: 'AS',
  inviteCode: 'aeg-X4F2-8QR9',
  joinUrl: 'https://runaegis.co/join/aeg-X4F2-8QR9',
  maxUses: '10',
};

// Per-template overrides - some emails have different sensible
// defaults (e.g. reset expires in 1 hour, not 24).
const OVERRIDES = {
  'reset-password.html': { expiresIn: '1 hour' },
  'invite-room.html': { expiresIn: '7 days' },
};

const TEMPLATES = [
  'verify-email.html',
  'reset-password.html',
  'welcome.html',
  'approval-request.html',
  'invite-room.html',
];

// Very small {{var}} substitution. Also handles the {{#if x}}…{{/if}}
// conditional pattern used in the invite template (maxUses block).
// We keep it intentionally minimal - production rendering happens
// inside Autosend, not here.
function render(html, data) {
  // Strip {{#if name}}…{{/if}} blocks when name is falsy; keep
  // content otherwise.
  let out = html.replace(
    /\{\{#if\s+([\w]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, name, inner) => (data[name] ? inner : ''),
  );
  // Replace remaining `{{var}}` placeholders.
  out = out.replace(/\{\{([\w]+)\}\}/g, (_match, name) => {
    if (name in data) return String(data[name]);
    return `{{${name}}}`;
  });
  return out;
}

// Dark-mode overrides for the preview-only `.filled-dark.html`
// variant. Real emails trigger these via `@media (prefers-color-
// scheme: dark)` against the recipient's OS preference. For the
// in-browser preview we can't rely on that (the host iframe
// inherits the OS scheme; we want to show both side by side), so
// we hardcode an unconditional override that the iframe loads.
//
// Kept in sync with each template's @media block - when you add
// a new dark-mode class to a template, add the matching rule here.
const FORCE_DARK_CSS = `
  <style id="force-dark">
    html, body { background-color: #0a0a0a !important; color-scheme: dark; }
    .bg-page { background-color: #0a0a0a !important; }
    .bg-card { background-color: #161616 !important; }
    .bg-context { background-color: #1f1f1f !important; }
    .bg-meta { background-color: #1a1a1a !important; }
    .bg-avatar { background-color: rgba(250,115,25,0.16) !important; }
    .border-card { border-color: rgba(255,255,255,0.08) !important; }
    .border-meta { border-color: #262626 !important; }
    .border-divider { border-color: #262626 !important; }
    .text-strong { color: #fafafa !important; }
    .text-sub { color: #d4d4d4 !important; }
    .text-soft { color: #a3a3a3 !important; }
    .text-label { color: #a3a3a3 !important; }
    .code-chip { background-color: #1f1f1f !important; color: #fafafa !important; border-color: #2a2a2a !important; }
    .link-fallback { color: #a3a3a3 !important; }
    .btn-secondary { background-color: #1f1f1f !important; border-color: #2a2a2a !important; color: #fafafa !important; }
    .btn-deny { background-color: #1f1f1f !important; border-color: #2a2a2a !important; color: #fafafa !important; }
    .pill-pending-bg { background-color: rgba(250,115,25,0.16) !important; color: #fa7319 !important; }
    .logo-fill { fill: #fafafa !important; }
    /* Override inline-style bg-white on card */
    body[class*="bg-page"] { background-color: #0a0a0a !important; }
  </style>
`;

// Agentation widget injection — preview-only. Loads the
// agentation React component via esm.sh and mounts it inside
// each filled email so the user can leave visual feedback on
// the actual rendered email content (not just the picker chrome
// outside the iframe).
//
// Loaded as ESM from esm.sh so we don't need a build step in
// this tooling folder. Connects to the local agentation daemon
// on http://localhost:4747 — the same one Claude Code talks to
// via the MCP server. Annotations land in my session via
// `agentation_get_all_pending`.
//
// `sessionId` is set per-template-mode so annotations on the
// invite-light variant don't blur with annotations on the
// approval-dark variant. The MCP layer surfaces the session id
// alongside each annotation, so I can match feedback to the
// exact preview that was being viewed.
//
// IMPORTANT: this block is injected only into `.filled.html` /
// `.filled-dark.html`. The source-of-truth templates (un-suffixed
// .html files) stay clean and are what we eventually push to
// Autosend.
const buildAgentationSnippet = (sessionId) => `
  <!-- Agentation widget (preview only — NOT in production emails).
       Uses async import with explicit ?deps= so agentation sees the
       same React instance we import. Wrapped in try/catch so any
       module load failure surfaces in the iframe's console instead
       of silently failing. -->
  <div id="__agentation-mount" style="position: fixed; bottom: 0; right: 0; z-index: 99999;"></div>
  <script type="module">
    (async () => {
      console.log('[agentation] loading for session: ${sessionId}');
      try {
        const [React, ReactDOM, agentation] = await Promise.all([
          import('https://esm.sh/react@18.3.1'),
          import('https://esm.sh/react-dom@18.3.1/client'),
          import('https://esm.sh/agentation@3.0.2?deps=react@18.3.1,react-dom@18.3.1'),
        ]);
        const { Agentation } = agentation;
        const root = ReactDOM.createRoot(document.getElementById('__agentation-mount'));
        root.render(
          React.createElement(Agentation, {
            endpoint: 'http://localhost:4747',
            sessionId: ${JSON.stringify(sessionId)},
            onSessionCreated: (id) => console.log('[agentation] session ready:', id),
          })
        );
        console.log('[agentation] mounted ✓');
      } catch (err) {
        console.error('[agentation] failed to load:', err);
      }
    })();
  </script>
`;

for (const file of TEMPLATES) {
  const src = readFileSync(join(__dirname, file), 'utf-8');
  const data = { ...SAMPLE, ...(OVERRIDES[file] || {}) };
  const out = render(src, data);
  const baseName = file.replace(/\.html$/, '');

  // Default filled - respects the host's color scheme. Inject
  // agentation just before </body> so its portal mounts last.
  const lightSession = `aegis-email-${baseName}-light`;
  const filled = out.replace(
    '</body>',
    `${buildAgentationSnippet(lightSession)}\n</body>`,
  );
  const outFile = join(__dirname, `${baseName}.filled.html`);
  writeFileSync(outFile, filled, 'utf-8');
  console.log(`✓ ${baseName}.filled.html`);

  // Dark-forced filled — adds FORCE_DARK_CSS before </head> AND
  // a separately-tagged agentation session. Two sessions per
  // template keeps light/dark feedback distinct.
  const darkSession = `aegis-email-${baseName}-dark`;
  const dark = out
    .replace('</head>', `${FORCE_DARK_CSS}\n</head>`)
    .replace('</body>', `${buildAgentationSnippet(darkSession)}\n</body>`);
  const darkFile = join(__dirname, `${baseName}.filled-dark.html`);
  writeFileSync(darkFile, dark, 'utf-8');
  console.log(`✓ ${baseName}.filled-dark.html`);
}
console.log(`\nDone. Open _preview.html — the agentation toolbar appears bottom-right of each iframe.`);
