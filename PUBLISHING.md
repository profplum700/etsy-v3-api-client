# Publishing Guide

This repo publishes to npm from CI when a release tag is pushed.

## One-time setup

- Enable 2FA for publishing on your npm account.
- For each package (root and every `packages/*`), add a Trusted Publisher:
  - npm package settings -> Trusted publishers -> GitHub Actions
  - Allow this repo and `.github/workflows/publish.yml`
- If any package is not yet published, do a one-time token-based publish first,
  then switch it to Trusted Publishers.

## Release flow (recommended)

1. Ensure `CHANGELOG.md` is up to date and the working tree is clean.
2. Run one of:
   - `pnpm run release:patch`
   - `pnpm run release:minor`
   - `pnpm run release:major`

The release script bumps versions across the workspace, commits, tags `vX.Y.Z`,
and pushes. CI publishes to npm on the tag.

## Notes

- To prepare a tag without pushing, run:
  `node scripts/release.mjs <patch|minor|major>`
- CI uses `pnpm install --frozen-lockfile`, build and type checks, then runs
  `npm publish --access public` separately for the root package and each
  integration package listed in `.github/workflows/publish.yml`. That workflow
  uses Trusted Publisher OIDC with `id-token: write`; it is not a recursive
  pnpm publication command.
- For emergency rollback, deprecate the version on npm rather than unpublishing.
