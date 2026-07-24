# AGENTS.md — Etsy API v3 Client

## Purpose

This repository is a TypeScript/JavaScript client library for the Etsy Open API v3. It provides OAuth 2.0 PKCE helpers, a universal Etsy client for browser/Node/Web Worker environments, package integrations under `packages/*`, examples, and documentation generated around the Etsy v3 API surface.

## Canon Block

- **Mode:** `single-main` per the Creator Canon in `/data/projects/AGENTS.md`.
- **Default branch:** `master` is the current remote default and is the shared canon branch for this repo until it is renamed.
- **Merge-gate command:** `pnpm run lint && pnpm run type-check && pnpm run test && pnpm run build`
- **Standing deviations:** legacy default branch name is `master`; publishing is tag-driven through the release scripts/CI, not a side effect of every default-branch push; `fhah-tools-*` branches may exist only as parked integration work and must not be landed from this repo without explicit owner scope.

## Repository Rules

- Read `/data/projects/AGENTS.md` before work; stricter user or repo-local instructions win.
- Work canon-style on the default branch: pull/rebase, reserve files with Agent Mail before edits, run the merge gate, commit directly to the shared branch, push, and release reservations.
- Do not commit Etsy credentials, OAuth tokens, generated secret files, `.env`, or local API test credentials. The existing `.gitignore` excludes `etsy-tokens.json`; keep token material out of Git.
- Treat publishing as release-managed: update versions/tags only when explicitly scoped and follow `PUBLISHING.md`.

## Common Commands

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run build
pnpm run test:packages
```
