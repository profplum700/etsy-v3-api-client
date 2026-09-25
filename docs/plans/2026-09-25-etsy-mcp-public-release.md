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

**PR #52 issue plan (reviewed at `354365f`):**

1. Fix the three-OS integration job setup first. The worker imports the built MCP package from `dist`; the first fix showed that building MCP alone also needs the SDK’s generated `dist` dependency on clean runners. Build the workspace in the matrix job (which builds the SDK and MCP in order) before running native/lock suites, then verify all three hosted OS jobs and the full repository gate. The failing matrix is not acceptable evidence for cross-platform support.
2. Resolve CodeQL's least-privilege finding by setting workflow-level `permissions: contents: read` in CI; verify CodeQL and CI pass.
3. Restore an explicit release authorization boundary. The repository canon requires tag-driven publication. Keep Changesets for independent package versions, but revise the plan and `PUBLISHING.md` so only a manually pushed package/version tag for the verified release commit can start publishing. The workflow must verify the tag matches exactly one public package name/version, the commit is on `master`, and CI passed for that exact commit. Publish only the named package; MCP Registry publication remains conditional on the MCP package tag.
4. Remove the successful-workflow history baseline from publishing. The exact package/version tag identifies the release and makes skipped or stale workflow runs unable to advance a baseline or suppress a version bump. A failed tag run is retried by rerunning that exact workflow run; validate tag mismatch, private/0.x package, missing CI, and non-master commit as rejected cases.
5. Preserve Etsy-rotated tokens across credential persistence failures without returning them to callers until durable save/callback succeeds. A subsequent refresh attempt must retry persistence of those rotated tokens without repeating the OAuth exchange. Add regression tests for failure then recovery and concurrent waiters.
6. Keep listing pagination internally consistent at the maximum accepted offset: do not report an actionable next offset above the schema bound, and define `has_more` as whether another accepted page can be requested. Add boundary tests for offsets 9,950 and 10,000 with full and short pages.
7. Answer the Codecov report with the resulting coverage status and rationale for any uncovered lines. Do not add tests solely to raise a percentage; cover the new edge behavior from items 4–6.
8. Restore quota-probe recovery through an explicit reservation-aware convenience method while keeping the original `waitForRateLimit(): Promise<void>` behavior source-compatible. Return the reservation ID from the new helper and require callers to pass it to `updateFromHeaders()`. Never reopen exhausted quota from an uncorrelated positive header because concurrent responses can arrive out of order. Test correlated recovery plus stale out-of-order positive responses.
9. Make final batch verification in `apply-approved-prices.mjs` account for all approved targets in each listing. Capture one non-target baseline fingerprint per listing before its first approved write, mask every approved product/offering target in that listing in that baseline, and separately verify every approved target has its proposed price after the batch. Add synthetic tests for two variation targets in one listing plus detection of an unrelated inventory change. Do not run write mode against Etsy as part of this fix.
10. Make package-tag publication safe to retry after partial success. Make npm publication idempotent: publish when the exact package version is absent; when present, compare its registry SRI integrity with the exact locally packed tarball and continue only on an exact match. Make Registry publication idempotent too: when the exact server name/version already exists, compare the published metadata with local `server.json` and skip only for an exact match; fail closed on mismatches and lookup errors. Pack to a fresh package-specific temporary directory, assert exactly one tarball, and validate the tarball manifest name/version against the parsed tag before npm publish. Ignore deleted tag push events and reject an all-zero release SHA before checkout/build/OIDC work. Test both already-published branches with deterministic synthetic archives/metadata; never publish in PR validation.
11. Fence refresh persistence against concurrent `updateTokens()` and `clearTokens()`. Capture a mutation generation before token exchange and re-check it after each awaited storage/callback boundary and immediately before committing current tokens. Make `clearTokens()` invalidate a refresh and wait for already-started persistence to settle before clearing durable storage. If a synchronous `updateTokens()` races a started storage save, restore the newer current token state after the stale save settles; prevent stale callbacks from committing and define a safe persistence repair path for callback-backed storage. Keep the public synchronous `updateTokens()` signature source-compatible unless evidence proves that impossible. Add deterministic tests with storage and async callbacks paused during update/clear, proving the old refresh cannot become current or remain durably stored when clear resolves.
12. Prevent the approved-price script from overwriting its proposal through the execution report path. Default reports must be distinct for both `.csv` and suffix-free proposal names; explicitly requested report paths that resolve to the proposal file must fail before keyring or Etsy access. Add path-helper tests for both defaults and explicit collision rejection; never use live credentials or issue Etsy requests in these tests.
13. Preserve single-target fingerprint semantics in the immediate write/readback paths after changing the helper to accept sets of approved targets. Convert both write-error recovery and immediate successful readback to pass a one-target set; add focused coverage proving a target price change is masked while unrelated fields remain compared. Search every call site and verify none passes the obsolete product/offering positional arguments.
14. Extend approved-price report collision detection to identify hard links to the proposal, not only matching/canonical paths. Compare filesystem identity for existing proposal/report files before credential or Etsy access; cover explicit and pre-existing default report hard-link aliases using temporary files. Keep the guard fail-closed if identity inspection errors.
15. Preserve quota ordering when callers use the legacy uncorrelated wait/header pair concurrently. Reproduce a newer zero-remaining observation arriving before an older positive response and ensure the stale positive cannot reopen quota. Add an explicit reservation-returning wait helper for safe probe recovery and require its ID at header reconciliation; retain stale-response protection for correlated observations.

**Review-fix acceptance:** all eleven tracked inline review/CodeQL threads receive a direct response after their changes are present, including the already-resolved CodeQL finding; the Codecov conversation receives a direct response; every required thread is re-fetched and verified. CI, CodeQL, and all OS keyring/lock matrix jobs pass on the final PR head. Publication retry, tag deletion, archive validation, and tag parsing have deterministic tests but are not triggered against a real release tag during review-fix work; no npm/Registry publication occurs here. Initial npm Trusted Publisher creation/configuration remains a release-owner prerequisite, and release tags currently have no repo ruleset restricting who can create them; do not claim these account/repository settings are verified by local tests.

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

### 16. Bind release checkouts to the immutable event commit

**Finding:** PR review `4108326311` reports that `.github/workflows/publish.yml` checks out `github.ref` in the validation and OIDC publishing jobs. For tag-triggered workflows, a tag can move after the workflow event, making the checked-out source differ from the immutable `github.sha` used by ancestry and CI checks.

**Plan:** inspect every checkout in the package publish workflow and determine which jobs execute release source or scripts. Change each relevant checkout to the event's immutable `${{ github.sha }}`. Add or extend deterministic release-workflow validation so a future checkout by mutable tag ref is caught. Locally demonstrate the old source contains mutable refs and the revised source binds each applicable job to the event SHA; run the focused release tests and the full required PR gate after the change.

**Acceptance:** every release job that builds, validates, or executes publication code checks out exactly the immutable event SHA; deterministic tests fail against the old workflow and pass against the fix; fresh independent review and GitHub CI pass for the pushed commit. Reply to and resolve review thread `PRRT_kwDOPMgnhs6mJPSu` only after evidence is available. No release tag, npm publication, or Registry publication is performed as part of this fix.

### 17. Make the safe rate-limit recovery migration explicit

**Finding:** fresh-context review of `941af52fc9a8721c613cf4e5cdaf8a419c61818c` found that the source-compatible legacy pair `waitForRateLimit()` followed by `updateFromHeaders(headers)` cannot reopen QPD after exhaustion. It discards the reservation ID, so positive uncorrelated headers must remain ignored to prevent a stale concurrent response from reopening quota.

**Plan:** preserve fail-closed ordering safety, add an explicit regression test for the legacy pair after a zero response, and document that the legacy method is for dispatch pacing only. Show the migration to `waitForRateLimitWithReservation()` plus `updateFromHeaders(headers, reservationId)` (and `releaseRequestSlot` on transport failure) in the public README and method documentation. Update the changeset to describe this behavioral migration plainly. Do not accept uncorrelated positive headers after exhaustion.

**Acceptance:** the legacy regression test passes and demonstrates that it cannot reopen quota; the new reservation-aware path can reopen through its correlated probe; existing stale concurrent-response cases remain blocked; documentation and release note state the required migration. Reply to review thread `PRRT_kwDOPMgnhs6mJHbS` with this compatibility limitation and why uncorrelated recovery cannot be restored safely. Keep the issue visible as an intentional behavior change, not a claim of full behavioral compatibility.

### 18. Reverify every approved price target after batch writes

**Finding:** PR review `4108425728` reports that preflight rows already at their approved target are marked `VERIFIED` and excluded from the final readback. A later write or external edit can change such a target while the batch still exits successfully.

**Plan:** add a regression with one already-at-target approved row and a second `READY` row whose write changes the first row before final verification. Confirm the current script incorrectly succeeds or fails to flag drift. Then include all approved rows in final target-price verification while keeping writes limited to `READY` rows. Preserve per-listing baseline masking and unrelated-inventory drift checks.

**Acceptance:** the regression fails before the fix and passes after; final readback verifies every approved row's target, but only preflight `READY` rows are written. Focused and full coverage tests pass, and the response to review thread `PRRT_kwDOPMgnhs6mJexU` includes exact evidence before resolution.

### 19. Accept listing IDs returned by the listings tool

**Finding:** PR review `4108495159` reports that `etsy_list_active_listings` returns numeric `listing_id` values while `etsy_get_listing_inventory` accepts only digit strings, so directly chaining tool output fails schema validation.

**Plan:** inspect both public MCP tool schemas and response serialization. Normalize the inventory tool's input to accept either a positive safe integer or digit string, converting to the SDK's string ID at the boundary. Test direct use of a returned numeric ID, equivalent string input, and invalid/non-integral/out-of-range values.

**Acceptance:** numeric IDs emitted by the listing tool can be passed unchanged to inventory; strings retain compatibility; invalid IDs are rejected before Etsy access. Focused MCP tests pass and thread `PRRT_kwDOPMgnhs6mJpno` is replied to and resolved with evidence.

### 20. Give oversized listing inventory a usable retrieval path

**Finding:** PR review `4108495170` reports that a variation-rich inventory result can exceed the shared 25,000-character MCP response limit, with no inventory-specific page argument or alternate retrieval mechanism.

**Plan:** inspect MCP output-size policy, Etsy inventory response shapes, and tool schema. Add deterministic inventory pagination/chunking with an input cursor/offset and bounded response, or another explicit complete retrieval contract. Preserve product/offering identity and do not silently drop rows. Test a synthetic inventory exceeding the response cap across the full retrieval sequence, exact reconstruction, repeated/invalid cursors, and ordinary small inventories.

**Acceptance:** every inventory product/offering can be retrieved exactly once across bounded calls; each tool response remains within the shared output cap; input bounds are enforced; tests cover a large variation-rich listing and normal behavior. Reply to and resolve thread `PRRT_kwDOPMgnhs6mJpnt` only with this evidence.

### 21. Validate custom OAuth callback URIs against the local listener

**Finding:** PR review `4108495175` reports that custom `--redirect-uri` values using HTTPS or omitting an explicit port do not match the local plaintext HTTP listener, which may bind an unintended port and leave OAuth waiting until timeout.

**Plan:** inspect redirect URI parsing, callback listener host/port binding, OAuth URL generation, and CLI option validation. Define the supported contract as loopback HTTP with an explicit valid port (unless inspection proves the listener correctly supports more). Reject unsupported scheme, non-loopback hosts, absent/invalid ports, and mismatched paths before opening a browser; test valid supported forms and each invalid class without network or browser side effects.

**Acceptance:** every accepted redirect URI exactly matches the listener's bound scheme/host/port/path; unsupported forms fail quickly with actionable errors and no listener/browser wait. Focused OAuth/CLI tests pass and thread `PRRT_kwDOPMgnhs6mJpnv` is replied to and resolved with evidence.

### 22. Preserve `clearTokens()` behavior for legacy refresh callbacks

**Finding:** PR review `4108545779` reports that the new missing-clear-callback error is applied to legacy synchronous `refreshSave` integrations, causing logout/reset to reject after in-memory state was already cleared.

**Plan:** inspect callback types and token persistence flows. Track whether persistence uses the new async durable callback contract or the legacy callback. Preserve the prior successful `clearTokens()` behavior for legacy `refreshSave`; continue requiring `refreshClearAsync` for `refreshSaveAsync`, whose contract explicitly represents durable asynchronous persistence. Add regressions for both cases, including ordering after an in-flight refresh.

**Acceptance:** legacy `refreshSave` clears memory/storage and resolves without a clear callback; `refreshSaveAsync` without `refreshClearAsync` retains the actionable failure; paired async callbacks still clear durable data. Focused token-manager tests and full coverage pass; reply to and resolve `PRRT_kwDOPMgnhs6mJxlr` with evidence.
