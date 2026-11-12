# AGENTS.md — Etsy API v3 Client

<!-- BEGIN:shared-agent-rules sha256=de8174f549587f30c9c6a13365047ab1eff4f415a3485303f45cfd905cacfc2a generated from henrypitmandigital/agent-skills agent-rules/shared.md; edit it there, then run tools/agent_rules.py sync -->
## Shared rules

These rules apply in every repository that carries this block. Where another rule in this file conflicts with one of them, the other rule wins for this repository, whether or not it names this section.

- Claude Code and Codex both read this AGENTS.md. Do not add a CLAUDE.md.
- Merge (squash) without asking once all CI checks pass and every review comment and review thread has been answered, including ones that arrive after later pushes, unless another rule in this file says a merge needs a person's approval or must not be done by an agent; then follow that rule. Answer each comment (fix it, or reply why not) before merging. Never merge red or conflicted PRs.
- Every secret lives in Infisical EU (eu.infisical.com); the `hpd-secrets` skill says how to store and read one. Never print, log or commit secrets: API keys, tokens, passwords, private keys or `.env*` values.
- The owner decides money, legal terms, people, strategy, and changing or deleting an existing live secret. Decide everything else yourself from the repository and the task, and say what you chose.
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
