# AGENTS.md — Etsy API v3 Client

## Scope

This file provides durable repository-level guidance for coding agents. Use judgment: explicit task instructions and any more-local `AGENTS.md` take precedence.

## Repository context

This is a TypeScript/JavaScript client for the Etsy Open API v3. The root contains the core client; `packages/*` contains integrations and related packages; examples and documentation live alongside them.

- Runtime: Node.js 24+
- Package manager: pnpm
- Default branch: `master` until the repository is renamed
- Release process: tag-driven; see `PUBLISHING.md`

## Working approach

- Start from the requested task and inspect the code, tests, and docs relevant to it. Do not read the whole repository or a fixed stack of documents by default.
- Prefer the smallest coherent change that fits existing patterns. Preserve public API and cross-environment behavior unless the task intentionally changes them.
- Resolve routine, reversible implementation details autonomously. Stop for clarification only when ambiguity materially affects product behavior, security, public API compatibility, external data, or release scope.
- Ground claims in repository evidence. When Etsy API semantics, scopes, or schemas matter and the repository is not authoritative, verify against Etsy's official API documentation/OpenAPI specification.
- Keep changes scoped. Do not introduce unrelated refactors, dependency upgrades, formatting churn, or process scaffolding unless they are needed for the requested outcome.

## Safety and external side effects

- Never commit Etsy credentials, OAuth tokens, `.env` files, generated secret material, or local API credentials. Keep token material out of Git; `.gitignore` already excludes `etsy-tokens.json`.
- Treat live Etsy mutations, permission/scope expansion, package publishing, release tags, and destructive Git operations as external or high-impact actions. Perform them only when the task explicitly requires them.
- Publishing is release-managed. Do not bump versions, create/push release tags, or publish packages as an incidental part of another change; follow `PUBLISHING.md` when release work is in scope.

## Verification

Use verification proportional to the change.

- During development, prefer the narrowest relevant tests/checks for fast feedback.
- For changes that can affect runtime behavior, package output, types, or the public API, run the relevant targeted checks and, when practical before finalizing, the repository merge gate:
  `pnpm run lint && pnpm run type-check && pnpm run test && pnpm run build`
- When integration packages are affected, include `pnpm run test:packages` when relevant.
- Documentation-only or other non-runtime changes do not require unrelated full-suite work.
- Fix failures caused by the change. Report unrelated pre-existing failures rather than weakening checks or hiding them.

## Keeping this file useful

Keep `AGENTS.md` concise and model-agnostic. Add only durable repository-specific context, invariants, decision boundaries, or verification guidance that a capable agent cannot reliably infer from the codebase. Avoid model-specific prompt hacks, mandatory file-reading sequences, and step-by-step procedures unless there is evidence they prevent a real recurring failure.
