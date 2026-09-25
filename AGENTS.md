# AGENTS.md — Etsy API v3 Client

## Repository invariants

- The default branch is `master` until the repository is renamed. Publishing is tag-driven; follow `PUBLISHING.md` when release work is in scope.
- Keep changes narrowly scoped and consistent with existing patterns. Preserve the public API and browser/Node/Web Worker behavior unless the task intentionally changes them.
- When Etsy API semantics, scopes, or schemas are not established by repository evidence, verify them against Etsy's official documentation or OpenAPI specification.

## Safety

- Never commit Etsy credentials, OAuth tokens, `.env` files, or other secret material.
- Live Etsy mutations, permission/scope expansion, package publishing, release tags, and destructive Git operations require explicit task scope.

## Verification

- Use the relevant package scripts and `.github/workflows/ci.yml` as the source of truth for checks. Run checks proportionate to the change, and avoid redundant local runs when one script already invokes another.
