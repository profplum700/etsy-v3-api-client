# Etsy MCP public release: completion plan

## Goal

Finish the local, read-only Etsy MCP server so other developers can install it publicly, connect their own Etsy developer app and shop, and use it safely from an agent. Keep the server local; do not introduce a hosted endpoint. Do not publish until the final candidate passes the release gates and contains no personal or sensitive data.

## Current baseline

- Repository: `etsy-v3-api-client-mcp`, branch `codex/etsy-mcp-server`.
- Candidate commit at plan creation: `db0295eec25a5c893ec3613af2832c127231cb91`.
- The branch is clean and its CI and local lint, type-check, coverage, tarball-install, and CLI help checks passed at that commit.
- The MCP package is still private at version `0.0.0`; it is not published to npm or the MCP Registry.
- A cross-process race remains in credential refresh versus disconnect/profile updates.
- Windows, macOS, and Linux OS credential-store integration evidence is incomplete. Exact-candidate protocol and live read-only checks must be repeated after fixes.
- GitHub reported Dependabot alerts on the default branch; the current alert set and relevance to the release dependency graph need a fresh review.

## Preserved invariants

- Each user supplies and locally stores their own Etsy app credentials and authorizes their own shop.
- OAuth asks for exactly `shops_r` and `listings_r`.
- The MCP server exposes only the three read-only tools already specified; it cannot mutate Etsy data.
- OAuth tokens and app secrets remain in the OS credential store and never enter source control, command arguments, logs, tarballs, or test output.
- The MCP server runs over local stdio. No public HTTPS service is required.
- Do not disclose shop-specific data during public artifact verification; live verification reports only whether the requests succeeded and safe aggregate counts.
- Do not publish or claim release completion before every required gate has evidence tied to the final candidate.

## Work sequence and per-item plans

Complete these items in order. Before starting each item, re-check its assumptions against the then-current branch and record its concrete scope and acceptance check. Finish and verify that item before moving to the next.

### 1. Make credential transactions safe across processes

**Problem:** `persistRefreshedTokens` currently performs a read, credential comparison, and save as separate operations. CLI disconnect and profile changes use the same OS-keyring index and profile records without a shared cross-process transaction boundary. A refresh may therefore recreate a disconnected profile or overwrite a newer token; concurrent profile updates may lose index changes.

**Plan:**

1. Use a local atomic lock directory with PID and random ownership token metadata, under a private per-user config directory on a local filesystem. The lock guarantee assumes the OS protects that directory from other users and no external process manually changes a live lock. An owner still alive in the OS must never be displaced by a timed lease or heartbeat timeout. Acquire by preparing a uniquely named owner directory and atomically renaming it to the canonical lock path. Release by atomically renaming the canonical lock to a unique retired sibling, checking the owner token on that moved directory, and removing only that retired path; never recursively delete the canonical path after a separate ownership read. If a crashed process leaves a lock behind, fail closed and report the PID/path for manual recovery after confirming no Etsy MCP process is using it; do not guess and automatically steal a lock. This avoids stale-lease takeover races and avoids a native lock dependency. Test atomic directory claims, contention, release/acquire races, normal release, and fail-closed stale-lock handling on Windows, macOS, and Linux before release.
2. Convert MCP credential-store operations and their callers to async. Put every operation that reads or mutates the profile index and profile records behind one cross-process transaction boundary. Include refresh compare-and-save, setup/save, select, disconnect, and disconnect-all. Make lock acquisition failure/timeout fail closed; never fall back to an unlocked write. Refactor nested public methods into private unlocked helpers so a transaction does not deadlock itself. Preserve the SDK's existing synchronous `refreshSave` callback type; add a separate async persistence callback property and await it before exposing refreshed tokens. This keeps existing SDK callers source-compatible while allowing the MCP store to persist asynchronously.
3. Preserve current rollback behavior and legacy v1 migration semantics under the transaction boundary. Never place credentials or tokens in lock files or diagnostic output.
4. Add deterministic interleaving tests using separate processes/store instances for refresh versus disconnect, competing refreshes, and concurrent profile additions/removals. For refresh versus disconnect, pause after Etsy has returned new tokens but before persistence begins; let disconnect complete first, then resume persistence and verify it is rejected without recreating the profile. Also verify lock-held serialization, stale refresh rejection, profile-index consistency, and repeated release/acquire overlap stress. Test contention, stale-lock fail-closed behavior, process-exit recovery guidance, and acquisition timeout.

**Acceptance:** the race scenarios fail against the old implementation and pass with the fix, including a refresh persistence attempt after disconnect has already completed; all credential reads/writes participating in the index are coordinated; timeout/corrupt-lock errors are actionable and fail closed; no live or suspended owner can be displaced, and stale-lock recovery is documented and explicit; lock release cannot delete or displace a subsequent owner's canonical lock; the SDK waits for the new async refresh persistence callback while its existing synchronous callback contract remains unchanged; existing credential/OAuth/tool tests pass. Record chosen locking strategy and remaining filesystem/OS assumptions.

**Implementation evidence:** commit `c479d74b115bc1c4f1983bdc90c22685dbc6a354` passed Windows local build/lint/type-check and the full repository gate (`pnpm run lint && pnpm run type-check && pnpm run test:coverage`, 49 files / 945 tests). GitHub PR #52 Ubuntu CI and both CodeQL analyses passed for that commit. A fresh-context reviewer found no high-severity issue in the revised acquisition/release design for cooperating processes on a protected per-user directory on a local filesystem. macOS lock/keyring execution remains part of item 2; no release claim is made from this Windows+Linux evidence alone.

**Likely files:** `packages/etsy-mcp-server/src/credentials.ts`, `packages/etsy-mcp-server/src/tools.ts`, CLI/OAuth call sites only if the chosen contract requires it, credential/tool/OAuth/CLI tests, and package dependencies/lockfile only if a coordination dependency is justified.

### 2. Prove OS credential-store behavior on supported platforms

**Plan (revalidated after item 1):**

1. Add a dedicated opt-in native integration test that exercises `@napi-rs/keyring` through `CredentialStore` using a unique service namespace and synthetic credentials. Never touch the default Etsy MCP service/index or a user profile. Cover probe, save, read, token refresh persistence, clear, and cleanup in `finally`; assert safe errors and that synthetic sentinel values do not appear in captured output or child-process arguments.
2. Add a separate GitHub Actions matrix job on Windows, macOS, and Ubuntu with Node 24. Enable only the dedicated integration suite in that job; keep the ordinary PR gate deterministic and independent of the runner’s keyring state. Pin Linux `Entry` to `secret-service`, provision and unlock a disposable GNOME Keyring in a DBus session, and fail if the native store cannot be reached (the SDK must not silently fall back to kernel keyutils).
3. Run the lock acquisition/release and separate-process contention/race suite on all three native operating systems in the same matrix, including repeated release/acquire churn. Use temporary directories and synthetic data; ensure cleanup after both normal and failed runs.
4. Keep injected keyring failure tests for locked, denied, unavailable, and write-failure behavior. Do not try to force destructive failure modes against the hosted runner’s actual account keychain. Confirm that the Linux Secret Service job fails when that service is absent, rather than reporting an in-memory or keyutils pass.
5. Re-run the matrix after any change to credential locking, keyring provider construction, integration setup, or package native dependencies. Record exact runner image, Node version, workflow run, and results.

**Acceptance:** probe/save/read/refresh/clear/cleanup pass against Windows Credential Manager, macOS Keychain, and Linux Secret Service; separate-process lock race tests pass on all three; Linux explicitly uses Secret Service and fails closed when unavailable; injected failure cases fail closed with useful messages; no plaintext fallback or credential leakage is observed. Keep platform integration evidence separate from unit tests and bind it to the candidate SHA.

**Current verification:** the opt-in native test passes locally on Windows using a random service namespace and synthetic values; the five separate-process lock tests, including 90 repeated acquisitions across three processes, also pass. The ordinary full gate passes (946 tests and one intentionally skipped native test). The new three-OS workflow has not yet run; item 2 remains open until Linux Secret Service, Windows, and macOS matrix results are read back.

**Acceptance:** all required operations pass on each supported OS; injected failure cases fail closed; CI names platform and result; Linux run explicitly exercises Secret Service rather than an in-memory provider. If a platform cannot be supported reliably, adjust the declared support contract and user-facing setup errors before release.

### 3. Verify the exact distributable and live read-only protocol

**Plan:** from the final source candidate, build the MCP and SDK tarballs and inspect their contents for private data, local paths, tokens, and workspace-only dependencies. Install the tarball in a clean Node 24 consumer with no `file:` resolution. Run CLI help and generic stdio startup, MCP initialization and all three tools through MCP Inspector, and protocol/stdout tests for success and failure paths. Perform a live read-only shop and active-listings smoke test with the authorized local shop; return only success/failure and aggregate counts in evidence.

**Acceptance:** exact final-candidate tarballs install cleanly; only the documented three read-only tools appear; MCP protocol output remains valid on stdout in normal and error paths; the live shop identity matches the selected local profile and read requests succeed. No mutations are issued. Re-run this item after any later change to the candidate.

### 4. Close privacy and dependency findings

**Plan:** scan the full repository history, current source, generated artifacts, and packed tarballs with a maintained secret scanner; manually inspect any matches, including test fixtures and examples. Refresh the GitHub Dependabot alert list and classify each current alert by affected package, reachable release dependency, fixed version, and action. Fix release-relevant vulnerabilities or document an evidence-based non-applicability decision. Verify repository visibility, package metadata, examples, workflow logs, and Registry metadata contain no personal data, shop identifiers, OAuth material, or local machine paths.

**Acceptance:** all scanner findings are resolved or explicitly identified as harmless fixtures with proof; no real credential or personal/shop-specific data is present; all dependency alerts that affect shipped runtime paths are fixed or block release; remaining alerts have a clear non-release rationale and follow-up owner.

### 5. Independently review and publish the final candidate

**Plan:** obtain a fresh-context review of the exact release candidate, with emphasis on OAuth scopes, keyring boundaries, transaction coordination, tool read-only behavior, packaging, and public metadata. Address findings and rerun all affected gates. Use Changesets to version only changed packages, make the MCP package publishable at `1.0.0`, and synchronize MCP Registry metadata. Verify npm and Registry OIDC publishing configuration before release; publish the SDK first if the MCP package requires a newly released SDK version, then publish the MCP package and registry record. Read back npm metadata, Registry metadata, and install/use the published package from a clean Node 24 consumer.

**Acceptance:** independent review is complete against the exact final SHA; lint, type-check, coverage, platform credential lane, artifact/protocol/live checks, privacy scan, and release metadata checks all pass on or are explicitly bound to that SHA; npm and Registry public readbacks match the intended version and metadata; clean consumer install and stdio launch work. If any publishing prerequisite is absent, keep the branch and PR unpublished and report the exact owner action needed.

## Evidence record

For each item, record the final commit or working-tree identity, commands and outcomes, platform/environment, and any inapplicable lane with its reason and future trigger. Recalculate the acceptance checks from the final diff after every later edit. Required lanes: lint, type-check/build, coverage/regression, native credential-store integration, exact tarball/stdio and Inspector conformance, authorized live read-only Etsy integration, secret/privacy scan, fresh-context independent review, npm/Registry publish and public readback.

## Explicitly out of scope

- A hosted public HTTPS MCP endpoint.
- Write-capable Etsy tools or automated listing changes.
- Publishing before the gates above pass.
- Deprecating existing public SDK packages as part of this release.
