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
repos. Every agent action flows through the **Contextual Intelligence
Layer** (the moat — see next section) before any policy evaluation. The
product does four things:

1. **Monitor** — every agent action gets logged with the tool, args, repo,
   `semantic_type`, `blast_radius`, decision, `decision_path`, latency.
2. **Classify + decide** — the Contextual Intelligence Layer assembles
   four context structs (Session / Repo / Branch / Env) and runs a
   deterministic classifier that emits `semantic_type` + `blast_radius`,
   which map to one of four decisions: ALLOW / DENY / **REWRITE** /
   REQUIRE_APPROVAL. Per-role tool allowlists + freeze windows compose
   with the classifier output.
3. **Approve** — REQUIRE_APPROVAL decisions gate through a human
   reviewer queue before executing.
4. **Audit** — immutable trail of every (action, four contexts,
   `semantic_type`, decision) tuple, exportable for compliance.

The unit of scope is a **Room** (currently — naming under review; see
"Naming tensions" below): one GitHub repo + a small team with roles +
a tool allowlist per role + a unique MCP endpoint URL.

## The Contextual Intelligence Layer (the moat)

Aegis's differentiator is the **Contextual Intelligence Layer (CIL)** —
a deterministic semantic classifier that lives between the agent and the
policy engine. It's the reason policies become portable across MCP
servers and why the product can REWRITE unsafe actions instead of just
allow/deny. Without the CIL, Aegis would be a binary firewall. With it,
Aegis is a context-aware governance engine.

### How it works

1. Agent calls a tool (e.g. `git push origin main`).
2. CIL assembles **four context structs** from immediate + cached data:
   - **`SessionContext`** — agent identity, session id, recent action history.
   - **`RepoContext`** — repo metadata, protected branches, freeze windows.
   - **`BranchContext`** — target branch, open PRs, recent CI status.
   - **`EnvContext`** — time of day, active freeze window state, role of the caller.
3. CIL runs a **deterministic classifier** (no LLM in the decision path)
   that emits two outputs:
   - `semantic_type` — *what kind of action this is* in policy terms.
   - `blast_radius` — *how much surface area it touches* (minimal → critical).
4. The (`semantic_type`, `blast_radius`, contexts) tuple maps to one of
   four **decisions**:
   - **ALLOW** — proceed unchanged.
   - **DENY** — block before the payload reaches the downstream MCP.
   - **REWRITE** — rewrite the action into a safe form (e.g. push to main
     becomes push to a feature branch + auto-opened PR). *This is the
     decision no competitor has — surface it prominently anywhere
     decisions are shown.*
   - **REQUIRE_APPROVAL** — pause, route to the human reviewer queue.

### The 10 canonical semantic_types (current shipping set)

| `semantic_type` | typical decision |
|---|---|
| `working_commit` | ALLOW |
| `ephemeral_force_push` | ALLOW |
| `test_only_change` | ALLOW |
| `protected_branch_write` | **REWRITE** |
| `freeze_window_violation` | DENY |
| `credential_exposure` | DENY |
| `autonomous_merge_attempt` | DENY |
| `large_blast_radius_change` | REQUIRE_APPROVAL |
| `sensitive_path_change` | REQUIRE_APPROVAL |
| `sequence_anomaly` | REQUIRE_APPROVAL |

### Why deterministic, not LLM

- **Latency** — every agent call goes through CIL; LLM calls in the hot
  path would add 200ms+ per action.
- **Auditability** — compliance teams need explainable decisions, not
  "the model thought…"
- **Policy portability** — deterministic mapping is consistent across
  repos and MCP servers, so policies written once apply to GitHub today
  and Linear / Slack / future MCPs tomorrow.

### The canonical action model

CIL normalizes every incoming tool call into a `canonical_action_type`
(e.g. `git_commit_to_branch`, `merge_pull_request`, `delete_branch`).
That's how a "push to main" via the GitHub MCP and a "force push to main"
via Claude Code's MCP both classify as the same `protected_branch_write`
and get the same REWRITE treatment. **Policies are written against
canonical actions, not against MCP-specific tool names.** This is what
makes the product expandable beyond GitHub without rewriting the policy
engine.

### Adjacent concept: `aegis_workstation`

The REWRITE decision relies on a per-room **persistent ephemeral working
branch** named `aegis_workstation`. When an agent tries to push to a
protected branch, Aegis rewrites the push onto `aegis_workstation` and
opens a PR back into the intended branch. The agent's working state
survives; the protected branch stays clean. Surface this name in
demo/audit copy when the rewrite path is relevant.

### Layer boundaries (so future sessions don't conflate them)

- **Layer 1 — Interception/Normalization.** MCP shim that captures every
  tool call and normalizes it into a `canonical_action_type`.
- **Layer 2 — Contextual Intelligence (CIL).** Everything above. *This is
  the moat.* What's shipping today.
- **Layer 3 — Governance/Execution.** Policy evaluation, tool allowlists,
  freeze windows, human-in-the-loop queue, audit log writer.
- **Layer 4 — Behavioral baselines / amplifier signals.** Series-A
  roadmap. *Not shipping.* Don't describe Aegis as "behavioral anomaly
  detection" — that frames us into the wrong category. The classifier is
  rule-based and deterministic; behavioral baselines come later.

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
| Policy, allowlist, deny, **REWRITE** | "Channel" (Slack-coded) | "Magic" / "smart" copy |
| `semantic_type`, classification, classifier | "AI-powered" / "ML-driven" framing (we are deterministic) | "Behavioral anomaly detection" (wrong layer — roadmap, not shipping) |
| `blast_radius`, `canonical_action_type` | "Team" (suggests people > permissions; we're more about permissions) | "Binary firewall" (undersells the CIL) |
| Context-aware, deterministic, four contexts | | Cute personification of agents |
| Audit trail, freeze window | | |
| `aegis_workstation`, working branch | | |
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

7. **Surface `semantic_type` everywhere actions appear.** Runs rows,
   approval rows, audit rows, sessions, room logs — every action should
   show its semantic_type chip. That chip is the customer-facing proof
   that Aegis does semantic work, not byte-level firewalling. Treat
   REWRITE as visually distinct (brand orange in the demo) — it's the
   only decision no competitor has. Never describe Aegis as a "binary
   firewall" or a "policy gateway" alone; the classifier is the moat.

8. **When showing an Approval or Audit row, show the four contexts that
   classified it.** `SessionContext` / `RepoContext` / `BranchContext` /
   `EnvContext` are first-class audit artifacts — not implementation
   detail. Customers expecting "explainable AI governance" should see
   the inputs to every decision in the same surface as the decision
   itself.
