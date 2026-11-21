# Skills, plugins, hooks and settings audit (2026-10-31)

This audit lists the agent configuration that applies when an agent works on this repository. It covers the repository's own files and the `~/.claude` folder of the Claude Code cloud environment. The inventory started on 2026-10-30 and finished on 2026-10-31. The audit is read-only. It changes no configuration.

## Summary

- The repository has one agent instruction file, `AGENTS.md`. It has no `.claude/` folder and no `CLAUDE.md`, as `AGENTS.md` requires. Claude Code loaded `AGENTS.md` in the audit session through its built-in AGENTS.md support.
- The cloud environment syncs 8 plugins (about 140 skills and 37 MCP servers) and 13 standalone skills. Only pstack, the built-in review skills and `AGENTS.md` apply to a TypeScript client library. Most of the rest (small-business, Supabase, Cloudflare, Inngest) is unrelated to this repository. The Inngest plugin also injects a SessionStart message into every session.
- The cloud environment runs Node 22.22.0. `package.json` requires Node 24 or later, and CI uses Node 24. On Node 22, the `AGENTS.md` merge gate fails 8 tests in `packages/etsy-mcp-server/test/doctor.test.ts`. Each failure reports `NODE_UNSUPPORTED`. Lint and type-check pass.
- Three items are stale or inconsistent. The `.beads/` tracker has one open issue ("Adopt canon workflow") that `AGENTS.md` already satisfies, and the `bd` CLI is not installed. The codex-review plugin needs a `codex` CLI that is not installed. `.coderabbit.yaml` turns on automatic reviews, but `AGENTS.md` says CodeRabbit does not review this repository automatically.

## Inventory

Status values: **used** means the audit session saw the item load or run. **available** means it is installed but nothing in this repository calls for it. **unused** means it is present but never loads in this environment.

| Item | What it is | Where it lives | Used? | Stale, duplicated or missing |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | Project rules, canon block, merge gate, PR and CodeRabbit rules | Repository root | Used. Loaded as project instructions | Current (last change 2026-10-12). The commands it names exist in `package.json`. |
| `CLAUDE.md` (repository) | Claude-specific instructions | Not present | Not applicable | Missing on purpose. `AGENTS.md` forbids adding one. |
| `.claude/` (repository) | Project skills, settings, hooks | Not present | Not applicable | Missing. No project skills, no project `verify` skill, no project permissions. |
| `.agents/playbooks/` | pstack project playbooks | Not present | Not applicable | Missing. pstack uses its bundled playbooks only. |
| `.coderabbit.yaml` | CodeRabbit config: inherit org settings, auto-review on, drafts on | Repository root | Used by CodeRabbit if the plan honours it | Inconsistent with `AGENTS.md`, which says the free plan does not review automatically and tells agents to post `@coderabbitai review`. |
| `.beads/` | Beads issue tracker data (`config.yaml`, `issues.jsonl`, `metadata.json`) | Repository root | Unused. `bd` is not installed and no doc refers to it | Stale. The one open issue, "Adopt canon workflow" (2026-07-24), is done: `AGENTS.md` has a canon block. |
| `.github/dependabot.yml` | Dependabot update config | `.github/` | Used by GitHub | Current. |
| `.github/workflows/*` | `ci.yml`, `publish.yml`, `spec-candidate.yml`, `spec-update.yml` | `.github/workflows/` | Used by GitHub | Not audited in depth. Out of scope (no agent hooks). |
| `~/.claude/CLAUDE.md` | User instructions. One line that imports `pstack-models.md` | `~/.claude/` | Used | Current. |
| `~/.claude/pstack-models.md` | Per-role model overrides for pstack | `~/.claude/` | Used. Loaded through the import | Current. |
| Managed `claudeMd` | Org policy: give connector, secret or host steps when blocked on access | `~/.claude/remote-settings.json` | Used | Current. |
| `~/.claude/settings.json` | SessionStart hook `/usr/local/bin/vps-access-up`. Allows `create_session` and `add_repo` | `~/.claude/` | Used. The hook ran at session start | Not related to this repository. The hook sets up SSH to VPS hosts. |
| `~/.claude/launcher-settings.json` | Environment-managed settings: Stop hook, `Skill` allow rule, deny rules, auto-mode rules | `~/.claude/` | Used | Managed by the environment. Do not edit. |
| Stop hook `stop-hook-git-check.sh` | Checks for uncommitted or unpushed work when a turn ends | `~/.claude/` | Used. Registered in `launcher-settings.json` | Current. |
| `user-prompt-submit-reply-reminder.py` | UserPromptSubmit hook for Slack-originated sessions | `~/.claude/` | Unused. Not registered in any settings file | Present but inactive. The environment registers it only for Slack sessions. |
| `~/.claude/skills/session-start-hook` | Built-in skill for SessionStart hooks | `~/.claude/skills/` | Available | Not needed here. |
| `~/.claude/skills/synced/…` (13 skills) | anthropic-skills: browser, computer-use, deep-research, docs, docx, google-workspace, import-memory, morning, pdf, pptx, skill-creator, xlsx | `~/.claude/skills/synced/<org>/` | Available | Not related to this repository. |
| Plugin `pstack` 0.9.102 | 65 skills (poteto-mode, tdd, architect, 24 `principle-*`, review skills), 4 agents, SessionStart hook | `~/.claude/plugins/synced/<org>/pstack`, org marketplace `henrypitmandigital/agent-skills`, auto-install | Used. The hook injected the poteto-mode mandate and this audit ran under poteto-mode | Current. Data folder `~/.claude/plugins/data/pstack-synced` is empty. |
| Plugin `archify` 3.2.0 | Architecture skill | `~/.claude/plugins/synced/<org>/archify`, org marketplace, auto-install | Available | Not used in this repository so far. |
| Plugin `typesafe-ai` 0.6.2 | Typed AI-call skill | `~/.claude/plugins/synced/<org>/typesafe-ai`, org marketplace, auto-install | Available | Not related. The repository makes no LLM calls. |
| Plugin `codex-review` | Sends diffs or plans to the OpenAI Codex CLI for review | `~/.claude/plugins/synced/<org>/410d87b9-…`, Anthropic directory, available | Unusable | Missing dependency. `codex` is not installed in the cloud environment. |
| Plugin `supabase` 0.1.17 | 2 skills, 6 agents, Supabase MCP (needs sign-in) | `~/.claude/plugins/synced/<org>/3f17d0d5-…`, Anthropic directory, auto-install | Available | Not related. The repository does not use Supabase. |
| Plugin `cloudflare` | 14 skills, Cloudflare MCP (needs sign-in) | `~/.claude/plugins/synced/<org>/a512755b-…`, Anthropic directory, available | Available | Not related. |
| Plugin `inngest` 0.4.2 | 15 skills, Inngest Cloud MCP (needs sign-in), SessionStart hook | `~/.claude/plugins/synced/<org>/41f4eed9-…`, Anthropic directory, available | Hook used. Skills not used | Not related. The SessionStart hook adds Inngest instructions to every session in this repository. |
| Plugin `small-business` 1.35.1 | 44 skills, 35 MCP servers (QuickBooks, Shopify, Gmail and others) | `~/.claude/plugins/synced/<org>/small-business`, Anthropic catalog, available | Available. Most servers need sign-in; HubSpot, Xero and Zoom failed to connect | Not related. Adds the largest share of skill names and deferred tools to each session. |
| Built-in skills | `code-review`, `security-review`, `simplify`, `run`, `init`, `update-config` and others | Claude Code | Available | `code-review` and `security-review` fit this repository's PR flow. |
| `~/.claude/plugins/marketplaces`, `~/.claude/plugins/cache` | Locally added marketplaces and plugin cache | Not present | Not applicable | Missing. All plugins come from org sync, none were added locally. |
| Cloud environment Node.js | Node runtime for agent sessions (`/opt/node22/bin/node`, v22.22.0) | Container image | Used | Mismatch. The repository and CI need Node 24 or later, so the merge gate cannot pass in the cloud environment. |
| `~/.claude/plugins/store/` | Built-in AGENTS.md plugin state | `~/.claude/plugins/store/` | Used | Current. |

## Recommended changes

These are proposals. This pull request makes none of them.

1. Install Node 24 in the cloud environment's setup script, for example through `nvm` or the Node 24 binary tarball. Agents can then run the full `AGENTS.md` merge gate before they commit. This is an environment setting, not a repository change.
2. Close or delete the `.beads/` tracker. Its only issue is done and nothing reads it. If Beads stays, add one line to `AGENTS.md` that says how agents should use it.
3. Make `.coderabbit.yaml` and `AGENTS.md` agree. Either remove the `auto_review` block, or confirm that CodeRabbit honours it on this plan and drop the manual `@coderabbitai review` rule.
4. Mark small-business, Supabase, Cloudflare and Inngest as available rather than installed for cloud sessions on this repository. Each session then loads fewer skill names and deferred tools, and the Inngest SessionStart message goes away. This is an org plugin setting on claude.ai, not a repository change.
5. Remove codex-review from cloud sessions, or add the `codex` CLI to the environment setup script. As it stands, the plugin cannot run.
6. Consider a project `verify` skill under `.claude/skills/verify/` (pstack `/create-verification-skill`) for the CLI and MCP server packages. pstack falls back to the built-in `run` skill without one. This would be the first `.claude/` content and must not include a `CLAUDE.md`.
7. Keep `AGENTS.md` as the only instruction file. It loads in Claude Code cloud sessions, so a `CLAUDE.md` would only duplicate it.

## Method

The audit listed `~/.claude` and its `skills`, `plugins`, `cache`, `store` and `backups` folders. It read the keys of each settings file without printing credential values. It mapped each synced plugin folder to its `plugin.json` name and `.meta.json` marketplace entry. It counted each plugin's skills, agents, hooks and MCP servers. It searched the repository for `.claude`, `CLAUDE.md`, `AGENTS.md`, `.agents`, `.mcp.json` and other agent config files. It checked `command -v` for `codex`, `bd`, `gh` and `pnpm`, and checked that the `AGENTS.md` merge-gate scripts exist in `package.json`.
