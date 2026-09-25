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
5. Wait for the full `CI` run on the merged `master` commit to pass. For each package being released, create and push its exact package/version tag at that verified commit. For example:

   ```bash
   git tag '@profplum700/etsy-mcp-server@1.0.0' <verified-commit-sha>
   git push origin '@profplum700/etsy-mcp-server@1.0.0'
   ```

   `publish.yml` runs only for these explicit package tags; tag deletions are ignored. It validates that the tag matches a public package name and version in that commit, that the commit is on `master`, and that the same commit passed CI. A prepare job builds and packs only that package, checks the tarball manifest against the tag, and hands the exact archive to the publish job. GitHub OIDC permission is limited to the npm and Registry publishing jobs. If the npm version already exists, a retry continues only when its published tarball integrity exactly matches the archive; for the MCP package, a Registry retry continues only when the existing version metadata matches `server.json`. Mismatches and indeterminate lookup results fail closed. Rerun the failed workflow after resolving the cause; no successful-run history is used as a release baseline. For the MCP package tag, the workflow also verifies npm publication and publishes the matching metadata to the MCP Registry using GitHub OIDC.

No lockstep version bump or all-packages publish command is used. Changesets manages independent package versions; maintainers create package-specific release tags deliberately after reviewing a verified release commit.

## One-time setup

- Keep npm Trusted Publishers configured for `.github/workflows/publish.yml` for each existing package.
- Before the first MCP release, create the npm package and configure its npm Trusted Publisher for this repository and workflow. npm may require a one-time initial publish before the package-specific Trusted Publisher can be configured.
- MCP Registry publication uses GitHub OIDC and requires no Registry token secret. The server namespace is `io.github.profplum700/etsy-mcp-server`.
- Ensure repository Actions allow maintainers to push package-specific release tags and allow the `publish.yml` workflow to request OIDC tokens.

## Initial MCP release gate

`packages/etsy-mcp-server` remains private until the owner completes live Etsy authorization, keyring integration on Windows/macOS/Linux Secret Service, MCP Inspector checks, and an independent credential/security review. After those checks pass, prepare a reviewed release commit that applies the major Changeset to set the initial version to `1.0.0` and removes the `private` flag. The publish workflow rejects a public MCP package that still has a `0.x` version. Merge only after the normal CI checks succeed; then push the exact `@profplum700/etsy-mcp-server@1.0.0` tag at that verified commit to authorize its npm and Registry publication.

## Checks

Pull requests run the release-tag validation cases, lint, type-check (which includes the build), and the complete Vitest workspace with coverage. The publish workflow independently checks for a successful `CI` run on the exact tagged master commit.
