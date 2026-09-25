# Publishing Guide

Packages use [Changesets](https://github.com/changesets/changesets) for independent versions and package changelogs. A normal package change does not bump or republish unrelated packages.

## Package change

1. Add a changeset to the feature PR with `pnpm changeset`, selecting only the packages whose public API or published contents changed and the appropriate bump level.
2. Merge after the PR checks pass.
3. Prepare a small release PR from current `master`:

   ```bash
   pnpm run version:packages
   ```

   This applies the changeset versions, updates package changelogs, and synchronizes the MCP Registry `server.json` version with `@profplum700/etsy-mcp-server`.
4. Review the generated versions, changelogs, dependency ranges, and `server.json`; run the normal PR checks; merge the release PR.
5. After the successful `CI` run for that `master` commit, `publish.yml` publishes only package versions changed since the previous successful main-branch CI run. npm Trusted Publishing uses GitHub OIDC. If the MCP package changed, the same workflow publishes its metadata to the MCP Registry using GitHub OIDC.

No lockstep version bump, manual tag creation, or all-packages publish command is used. Changesets creates package-specific tags for successfully published package versions.

## One-time setup

- Keep npm Trusted Publishers configured for `.github/workflows/publish.yml` for each existing package.
- Before the first MCP release, create the npm package and configure its npm Trusted Publisher for this repository and workflow. npm may require a one-time initial publish before the package-specific Trusted Publisher can be configured.
- MCP Registry publication uses GitHub OIDC and requires no Registry token secret. The server namespace is `io.github.profplum700/etsy-mcp-server`.
- Ensure repository Actions allow the `publish.yml` workflow to write release tags and request OIDC tokens.

## Initial MCP release gate

`packages/etsy-mcp-server` remains private until the owner completes live Etsy authorization, keyring integration on Windows/macOS/Linux Secret Service, MCP Inspector checks, and an independent credential/security review. After those checks pass, prepare a reviewed release commit that applies the major Changeset to set the initial version to `1.0.0` and removes the `private` flag. The publish workflow rejects a public MCP package that still has a `0.x` version. Merge only after the normal CI checks succeed; the resulting public package change triggers npm and Registry publication for the MCP server.

## Checks

Pull requests run lint, type-check (which includes the build), and the complete Vitest workspace with coverage. The publish workflow waits for the successful main-branch `CI` run and uses that exact commit before publishing.
