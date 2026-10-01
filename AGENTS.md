# AGENTS.md — Etsy API v3 Client

## Purpose

This repository is a TypeScript/JavaScript client library for the Etsy Open API v3. It provides OAuth 2.0 PKCE helpers, a universal Etsy client for browser/Node/Web Worker environments, package integrations under `packages/*`, examples, and documentation generated around the Etsy v3 API surface.

## Canon Block

- **Mode:** `single-main`.
- **Default branch:** `master` is the current remote default and is the shared canon branch for this repo until it is renamed.
- **Merge-gate command:** `pnpm run lint && pnpm run type-check && pnpm run test:coverage`
- **Standing deviations:** legacy default branch name is `master`; publishing is tag-driven through the release scripts/CI, not a side effect of every default-branch push; `fhah-tools-*` branches may exist only as parked integration work and must not be landed from this repo without explicit owner scope.

## Repository Rules

- Read this file before work; stricter user or repo-local instructions win.
- Do not add a CLAUDE.md; Claude Code reads AGENTS.md directly.
- Work canon-style on the default branch: pull/rebase, run the merge gate, commit directly to the shared branch, and push.
- Never print, log or commit secrets. Do not commit Etsy credentials, OAuth tokens, generated secret files, `.env`, or local API test credentials. The existing `.gitignore` excludes `etsy-tokens.json`; keep token material out of Git.
- Treat publishing as release-managed: add a Changeset for published package changes and follow `PUBLISHING.md`.
- OpenAPI maintenance is an explicit exception to direct default-branch commits: the scheduled workflow owns `automation/etsy-openapi` and proposes reviewed draft PRs. It may change only the pinned specification, provenance, internal generated declarations and reports. It must use standard GitHub-hosted runners in the public repository, with no paid services or AI subscriptions. See `docs/OPENAPI_MAINTENANCE.md`.

## Pull Requests and Merging

- Direct default-branch commits (above) stay the norm. When a change does go through a PR (for example Dependabot, or a PR opened on request), the rule below applies on top of the merge gate and any explicit owner scope. Draft PRs, including the `automation/etsy-openapi` ones, are not merged until marked ready for review.
- Merge (squash) without asking once **all CI checks pass** and **every review comment and review thread has been answered**, including ones that arrive after later pushes. Answer each comment (fix it, or reply why not) before merging. Never merge red or conflicted PRs.

## Common Commands

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run build
pnpm run test:packages
```
