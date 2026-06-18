# Aegis — product, market, audience

This file is the durable answer to "who is this product for and what does it
do?" Loaded into every session so design + UX + copy decisions stay anchored.
Update when the target market evolves; don't update lightly.

## One-sentence positioning

**GitHub branch protection rules, but for AI agents.**
(Adjacent metaphors: "Datadog for the AI you let into your codebase,"
"Snyk for AI agent actions.")

## What the product is

Aegis is a **B2B developer-tools governance product** that sits between AI
coding agents (Cursor, Claude Code, VSCode Copilot) and a team's GitHub
repos. It does four things:

1. **Monitor** — every agent action gets logged with the tool, args, repo,
   decision, latency.
2. **Control** — policies + per-role tool allowlists + freeze windows
   decide what agents are allowed to do, when.
3. **Approve** — risky operations (REQUIRE_APPROVAL decisions) gate through
   a human reviewer queue before executing.
4. **Audit** — immutable trail of every decision, exportable for compliance.

The unit of scope is a **Room** (currently — naming under review; see
"Naming tensions" below): one GitHub repo + a small team with roles +
a tool allowlist per role + a unique MCP endpoint URL.

## Target audience

### Company shape
- **Stage**: Series A through pre-IPO. Sweet spot: **20–500 engineers**.
- **Vertical**: Skews regulated — fintech, healthtech, devtools, B2B SaaS
  handling sensitive data. Industries where "AI agent did X without
  permission" is a real incident.
- **SCM**: GitHub-only today. GitLab/Bitbucket teams are not addressable.
- **AI tool maturity**: Already using Cursor / Claude Code / VSCode Copilot
  at daily-use scale, not experimentation. AI spend is a real budget line.

### Personas (one person at small scale, three roles at larger)

**Tech Lead / Engineering Manager — daily user + champion.**
- Owns 5–50 engineers using agentic tools.
- Already had the "what is the agent doing in my codebase?" moment.
- Lives in `/dashboard/approvals` (review queue) and `/dashboard/audit`
  (incident investigation).
- Speaks code-review language fluently. Cares about velocity vs control.

**Security / Platform / DevSecOps Engineer — technical buyer.**
- Mid-stage company with SOC 2 / HIPAA / FedRAMP pressure.
- Has to demonstrate AI agent oversight to auditors.
- Lives in `/dashboard/policies`, `/dashboard/rooms`, `/dashboard/freeze-window`.
- Wires up tool allowlists + role hierarchies.

**VP Eng / Director — economic buyer, occasional viewer.**
- 50–500 engineers using AI tools.
- Wants two questions answered: "what's this costing?" and "what mistakes
  are agents making?"
- Lives in `/dashboard/token-spenditure` + `/dashboard` rollup.

### NOT the target market
- Solo devs / consultants (no team → no governance need).
- Vibe coders / hobbyists (no compliance pressure).
- Non-technical PMs, designers, marketers (vocabulary is too technical).
- GitLab/Bitbucket-only orgs (no integration yet).
- Companies using only chat assistants (ChatGPT) — Aegis is for AGENTIC
  coding tools, not chat.
- Sub-10-engineer startups (just review PRs manually).

### Adoption model
**Bottoms-up dev tool with top-down governance buy-in.** The empty-states
and integration flows are written for individual engineers ("Connect your
first agent"), but the governance features (policies, freeze windows,
audit export) are written for security/platform teams. Both surfaces
matter — never optimize only one.

## Vocabulary that lands with this audience

| ✅ Use freely | ⚠️ Use carefully | ❌ Avoid |
|---|---|---|
| Agent action, tool call, MCP | Workspace (already overloaded — see naming tensions) | "Bots" |
| Repo, branch, PR, commit | "Room" (current name, naming under review) | "Conversations" |
| Policy, allowlist, deny, rewrite | "Channel" (Slack-coded) | "Magic"/"smart" copy |
| Audit trail, freeze window | "Team" (suggests people > permissions; we're more about permissions) | Cute personification of agents |
| Token spend, cost per agent | | |
| Role hierarchy (OWNER > ADMIN > DEVELOPER) | | |
| Pre-action approval, human-in-the-loop | | |

**Tone**: Serious, precise, dev-tool-coded. Closer to Linear / Vercel /
Stripe Dashboard than Notion / Slack. The audience wants RIGOR + CLARITY
over FRIENDLINESS. Restrained motion, monospace for code/IDs/repos,
exact numbers over rounded marketing copy.

## Naming tensions (open product decisions)

### "Rooms" vs "Projects"
**Current**: `/dashboard/rooms`. **Recommendation**: rename to "Projects."

Reasoning: a Room in Aegis = (one repo + members with roles + tool
allowlist + MCP endpoint URL). The defining feature is **repo-scoped
permissions with an infrastructure endpoint** — same shape as Vercel
Projects. "Rooms" implies people-gather-in-space (Slack/Discord coded);
wrong metaphor for DevSecOps audience. "Workspace" already burned at
account level (demo/real workspace switcher). "Team" undersells the
repo+tool-allowlist part.

Status: discussed, not yet implemented. Cost of rename = URL paths,
docs, copy, customer comms. Worth doing if user base is still small.

## How this should shape decisions

When designing a new screen / writing copy / naming a feature:

1. **Picture the Tech Lead, Security Engineer, and VP Eng in a small room.**
   Would this copy / feature / interaction make them nod, or make them
   roll their eyes? Cute = roll. Vague = roll. Precise + governance-coded
   = nod.

2. **Default to GitHub vocabulary** when naming things. Users already speak
   "repo / branch / PR" — leverage that, don't reinvent.

3. **Show exact numbers, not rounded marketing copy.** "4 approvals
   waiting" not "a few approvals." Tabular-nums everywhere numeric.

4. **Audit + export is a first-class concern.** Anywhere there's data, ask
   "can the user get this OUT of the product into a compliance review?"

5. **Destructive operations need confirmation modals always.** This
   audience has been bitten by AI agents doing destructive things — they
   expect rigor on their own destructive actions too.

6. **Token spend and cost are real concerns, not vanity metrics.** Show
   them prominently when relevant; don't hide them in settings.
