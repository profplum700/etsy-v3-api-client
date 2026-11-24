# AGENTS.md — Etsy API v3 Client

<!-- BEGIN:shared-agent-rules sha256=a1b0ce7283de4cb9a9859783643425756f980e4927b32ae9ab6bf55774e1572f generated from henrypitmandigital/agent-skills agent-rules/shared.md; edit it there, then run tools/agent_rules.py sync -->
## Shared rules

These rules apply in every repository that carries this block. Where another rule in this file conflicts with one of them, the other rule wins for this repository, whether or not it names this section.

### Decision rights (Henry, 16 Nov 2026)

- This codebase and its work are yours. By default, decide, do it and report what you chose. Asking is the exception. If you have a recommendation, you have a decision: carry it out, then say in the PR or the task what you chose and why.
- Only these wait for Henry: sending anything outside the company that no standing authority covers, spending money, contracts and legal terms beyond a standard free-tier sign-up, regulatory filings, prices and strategy, people, revoking a live secret or changing an existing one by hand (rotations Infisical runs are fine), and deleting production data or anything else that cannot be undone. Everything else is yours to decide, including code, schemas in our own projects, CI, tests, docs, research, drafts, internal records and which option to take.
- When something does need Henry, file one ask with the `hpd-tasks` skill. The ask states your recommendation, the default and the date the default applies. Then carry on with everything that does not depend on it. Never end a session waiting for an answer, and never ask him to type a phrase back.
- When Henry wants a say on taste, such as a design or a voice, show the options with your recommendation and keep building the recommended one. Switch if he picks another. Post plans; do not wait for them to be approved.
- A setting only Henry can change (a console, a connector, an environment secret, a network host) is one ask on that business's task list. Never ask for the same setting twice.
- Hand work to another session through the task list. The task's text is the brief, with links to the files and PRs. Never give Henry a prompt to paste from one session into another.
- Leave nothing orphaned. Before a session ends, each PR it opened is merged, closed with a reason, or handed over in a task note, and follow-up work is filed as a task. Promote your own follow-ups to ready unless they need Henry. An idle PR or a lapsed claim is any agent's to finish.
- A failing job or monitor goes to an agent first. Henry hears about it only once the remedies have failed and the fix needs something only he can do.
- Before adding a gate, a monitor or an approval step, write down which failure it prevents and what it costs in CI minutes and in asks to Henry. Removing a gate is preferred to adding one.

### Task lifecycle (Henry, 17 Nov 2026)

- Agents own the task list, not Henry: "agents own the codebase. Except in exceptional circumstances, I will not be manually closing down tasks. It is not my job, it's the agent's job." Never ask him to close, cancel, dedupe or tidy a task.
- Close what is finished or no longer needed yourself, with the reason: duplicates (relate them first), work a merged PR or another task already did, asks Henry has already answered anywhere (record his words as a decision comment), and asks you can now decide yourself.
- Before you file an ask, look for an open task that already covers it and add to that one instead.
- Ready work nobody holds is any agent's: when your own task is done, take the next one for the business you are working in.
- Before a session ends, finish each task it holds (`done`, `review` with a link, or `handover` with what is left). A lapsed claim that returns to ready is any agent's to pick up and finish.
- Ask Henry only when the answer is completely unclear and cannot reasonably be inferred from the repository, the task history, the truth stores or his past decisions. An ask that his earlier words or a recorded canon already answers is yours to decide.

### Talking to Henry (Henry, 17 Nov 2026)

- Each business's bot sends Henry one daily digest: what is open (in progress, waiting on him, stuck) and what happened that day. No other messages: no per-task nudges, no per-incident alerts and no separate weekly reports. Put what you would have sent into the task list or the registry, where the digest reads it.
- Each bot answers `/status` with what is in progress and what waits on him.
- A link in a bot message goes to that business's Business Hub (dash.henrypitman.com), except for an item that genuinely needs Henry's input: that links straight to the item.

### Working rules

- Claude Code and Codex both read this AGENTS.md. Do not add a CLAUDE.md.
- Merge (squash) without asking once all CI checks pass and every review comment and review thread has been answered, including ones that arrive after later pushes, unless another rule in this file says a merge needs a person's approval or must not be done by an agent; then follow that rule. Answer each comment (fix it, or reply why not) before merging. Never merge red or conflicted PRs.
- Every secret lives in Infisical EU (eu.infisical.com); the `hpd-secrets` skill says how to store and read one. Never print, log or commit secrets: API keys, tokens, passwords, private keys or `.env*` values.
- Keep CI artifacts briefly (profplum700, 17 Nov 2026: storage that "doesnt use up github or only temporarily"). Every `actions/upload-artifact` step sets `retention-days` of 7 or less; test evidence (traces, screenshots, reports) uploads only when the job fails and keeps 2 days. A report a later run reads belongs in the business's own storage or database, not in an artifact; until it moves, mark the step `# artifact-read-by: <the reader>`. The organisation's artifact storage is counted hour by hour across the month, so one runaway upload blocks every repository's uploads until the month ends. `check --sealed` enforces the retention.
- After a restart or a long gap, re-read durable state (git log, remote branches, open PRs, the task) before you report progress. Do not report from memory.
- On a public or shared surface, name the acting agent and refer to the user as `profplum700`. Never use a personal first name in an attribution footer.
<!-- END:shared-agent-rules -->

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Purpose

This repository is a TypeScript/JavaScript client library for the Etsy Open API v3. It provides OAuth 2.0 PKCE helpers, a universal Etsy client for browser/Node/Web Worker environments, package integrations under `packages/*`, examples, and documentation generated around the Etsy v3 API surface.

## Canon Block

- **Mode:** `pull-request` (Henry, 10 Nov 2026: PRs are gated).
- **Default branch:** `master` is the current remote default and is the shared canon branch for this repo until it is renamed.
- **Merge-gate command:** `pnpm run gate` (lint, type-check, tests with coverage), then `scripts/merge.sh <pr>`.
- **Standing deviations:** legacy default branch name is `master`; publishing is tag-driven through the release scripts/CI, not a side effect of every default-branch push; `fhah-tools-*` branches may exist only as parked integration work and must not be landed from this repo without explicit owner scope.

## Repository Rules

- Read this file before work; stricter user or repo-local instructions win.
- Work on a branch and open a pull request against `master`; run `pnpm run gate` before you push. Do not commit directly to `master`.
- Do not commit Etsy credentials, OAuth tokens, generated secret files, `.env`, or local API test credentials. The existing `.gitignore` excludes `etsy-tokens.json`; keep token material out of Git.
- Treat publishing as release-managed: add a Changeset for published package changes and follow `PUBLISHING.md`. Agents may publish releases by following it (Henry, 10 Nov 2026); the MCP package stays private until its initial release gate in `PUBLISHING.md` is met.
- OpenAPI maintenance is an explicit exception to direct default-branch commits: the scheduled workflow owns `automation/etsy-openapi` and proposes reviewed draft PRs. It may change only the pinned specification, provenance, internal generated declarations and reports. It must use standard GitHub-hosted runners in the public repository, with no paid services or AI subscriptions. See `docs/OPENAPI_MAINTENANCE.md`.

## Pull Requests and Merging

- Every change goes through a PR, including Dependabot's and the `automation/etsy-openapi` ones. Draft PRs are not merged until marked ready for review.
- Merge only with `scripts/merge.sh <pr>` (`--dry-run` first). It squash-merges through the REST API pinned to the head commit, and only if every CI check on that commit succeeded. Never `gh pr merge`. Answer every review comment and thread (fix it, or reply why not) before you run it.
- Codex review is advisory (Henry, 10 Nov 2026): use it when it is available, otherwise comment `/review`. Answer its findings before the PR is ready.
- CodeRabbit is on the free open-source plan, which does not review this repo automatically (fewer than 10 stars). Request a review yourself by posting a PR comment containing exactly `@coderabbitai review` right after opening a PR, and again after each later push that changes code. Do this before merging any PR you open or handle, Dependabot ones included. Wait for CodeRabbit's review to post, then answer its comments like any other review before merging.

## Common Commands

```bash
pnpm install --frozen-lockfile
pnpm run gate
pnpm run test
pnpm run build
pnpm run test:packages
```
