# Etsy API v3 client

Universal TypeScript/JavaScript Etsy client, OAuth PKCE helpers and workspace
integrations under `packages/`. Keep browser, Node and worker consumers in mind
when changing shared code. `CLAUDE.md` points here; keep one instruction source.

## Work and release boundaries

The default branch is `master`, not `main`. Use a verified, task-owned local or
provider-hosted checkout and an isolated branch; preserve unrelated changes
and coordinate overlapping paths in the existing issue. Do not revive shared-
branch editing, Agent Mail, `/data/projects/AGENTS.md`, ai-machine, RCH or
replacement infrastructure/monitoring requirements. Existing Beads records are
history to preserve, not a reason to create a parallel tracker.

Keep Etsy credentials, OAuth tokens, `.env`, generated secret files,
`etsy-tokens.json` and local API-test credentials out of Git and evidence.
Real shop actions require explicit task authority and an approved test target;
mocked tests are not proof of a live Etsy integration.

Do not land parked `fhah-tools-*` integration branches without explicit owner
scope. Version bumps, tags and npm publication are separately authorised
release work: read `PUBLISHING.md` and the actual release script before using
it. `release:*` scripts commit, tag and push; they are not validation commands.

## Development and verification

Use Node 24 and the pnpm version pinned in `package.json` (10.26.2).
`pnpm install --frozen-lockfile` installs the workspace.

The existing merge gate is `pnpm run lint && pnpm run type-check && pnpm run
test && pnpm run build`. `type-check` itself builds the workspace; use focused
existing tests while editing rather than repeatedly running the full gate.
For integration packages, `pnpm run test:packages` selects their Vitest projects.

Preserve `.github/workflows/ci.yml`: its GitHub-hosted job checks lint, types,
tests, coverage and build on PRs and pushes to `master`. Independent review and
current-revision CI precede an authorised merge; a local pass is not a release.
Tag-triggered publication in `.github/workflows/publish.yml` is separate from
ordinary branch CI. Do not weaken either workflow or bypass configured hooks.

Read `PACKAGES.md` for package-specific work, `MIGRATION.md` for consumer
migration and `SECURITY.md` for security-sensitive changes; unrelated edits do
not require a tour of these documents. Report the changed behaviour, exact
revision, checks actually run and any unverified environment or live scope.
