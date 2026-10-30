# MCP usability implementation and validation

This change adds an offline diagnostic, six-client onboarding, one listing-detail tool, and installed-package checks to the existing OS matrix. It starts from `74a2e52320fdac156b8524a3d9a7309bd60452be`. Package versions remain unchanged; a minor Changeset applies only to the MCP package through the existing release process.

## Acceptance and priorities

| Priority | Acceptance criterion | Implementation and proof |
| --- | --- | --- |
| P0 | Preserve local stdio, keyring storage, exact read scopes, and process-start shop binding. | Existing credential, OAuth, token-refresh, and multi-shop regression tests remain. Two duplicated-scope pairs now fail credential parsing. No new Etsy scopes or mutation endpoints. |
| P0 | Diagnose local failures without exposing credentials or changing them. | `doctor` and `doctor --json` share one result model. Fixed messages cover runtime, native import, saved profiles, and token expiry. Tests cover secret sentinels, malformed records, duplicate scopes, offline behavior, and absence of credential operations. Installed-package testing removes the disposable installation's native module and verifies safe JSON failure. |
| P0 | Prove package installation and protocol behavior outside the workspace. | `scripts/smoke-package.mjs` packs the candidate, checks the archive allowlist and dependency resolution, installs production dependencies with npm in a temporary directory, invokes its executable, and exchanges initialize, tools/list, and ping messages. It checks exactly four read-only tools and protocol-only stdout. |
| P1 | Make onboarding usable in the six requested clients. | The package README has Windows, macOS, and Linux instructions for Claude Desktop, Claude Code, Codex, Cursor, VS Code/GitHub Copilot, and Gemini CLI, with official sources. Examples are documented formats, not six-client execution proof. |
| P1 | Add only a justified seller read tool. | `etsy_get_listing` supports copy and tag review through the existing GET endpoint. It verifies shop ownership before returning an explicit field allowlist. Tests reject foreign listings, wrong scopes, invalid inputs, oversize output, and disconnected startup profiles. |
| P2 | Ship MCPB only with demonstrated validity. | Deferred. [The feasibility assessment](mcpb-feasibility.md) records exact native-dependency, host-runtime, onboarding, packaging, and release requirements. No bundle is advertised or released. |

## Executed checks on 2026-10-24

The implementation was exercised on native Windows x64 with Node v24.12.0 and pnpm 10.26.2. GitHub CI results on the PR identify the tested commit and runner for each hosted OS. A green Windows result alone does not prove macOS, Linux, ARM, or a particular desktop client's behavior.

| Command or experiment | Observed result | Limit |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed without lockfile changes. | Does not prove an installed consumer package. |
| `pnpm run lint` | Passed. | Static checks only. |
| `pnpm run type-check` | Passed, including workspace builds. | Types do not prove runtime integration. |
| `pnpm run test:coverage` | 1,010 passed, one native integration test skipped by its opt-in predicate. | Most API tests use controlled fixtures. Native test ran separately below. |
| `ETSY_MCP_KEYRING_INTEGRATION=1 pnpm exec vitest run --project etsy-mcp-server test/credentials.native.integration.test.ts test/credentials.cross-process.test.ts` | Six tests passed on Windows. | Synthetic credentials use an isolated service namespace, with cleanup. This does not authorize a new live Etsy connection. |
| `node packages/etsy-mcp-server/scripts/smoke-package.mjs` | Installed candidate executable, stdio handshake, tool catalogue, doctor JSON/exit code, and missing-native failure passed on Windows. | No Etsy request is made by this test. Run under an unlocked Secret Service session on Linux. |
| Candidate stdio live read | Connected-shop identity, one active listing, and the new listing-detail response passed against Etsy. Ownership, expected fields, and base price were checked without printing seller content. | One representative listing on Windows. The existing client may refresh tokens; no Etsy mutation or profile selection was requested. Other states and shops are unverified. |
| Offline `doctor --json` | Reported local readiness with an expired-token warning and exit 0 under normal Windows access. Restricted credential access reported a fixed failure without exposing a path or raw error. | No token refresh or network call in doctor. It acquires the existing filesystem transaction lock. |

The first baseline cross-process run failed because only the core package had been built. Building the MCP package supplied its required `dist` workers and resolved that setup error. The first full type check found a test-table callback typing error, which was fixed before the passing run. Neither failed attempt counts as a pass. The first hosted matrix additionally exposed a Unix npm-bin symlink startup defect, Windows GNU tar interpreting a drive letter as a remote host, and the expected public-tool baseline mismatch. The CLI now resolves its executable path, archive checks use a relative filename, and the public baseline includes the independently tested fourth tool. Fresh CI results are recorded on the PR; failed initial jobs are not platform-verification evidence.

## Verification lanes and remaining gates

| Lane | Disposition and reason | Future trigger |
| --- | --- | --- |
| Static/build | Passed locally; also required by existing CI. | Every code change. |
| Unit/regression | Passed, including exact scopes, ownership, shop binding, and error sanitization. | Every behavior change. |
| Real-service integration | Windows OS keyring and one live Etsy read exercised. | Additional OS/client claims, new API responses or listing states. |
| OS/package/conformance | Windows installed-artifact check passed; three-OS execution is required by the extended CI matrix. | Each release candidate and dependency/platform change. |
| Browser/visual | Client instructions checked against current official docs; actual six-client setup flows remain unverified. | Advertising verified support for each client/OS pair. |
| Independent security review | A fresh read-only reviewer identified the scope-validation and native-import hazards before implementation. A separate ChatGPT review used the GitHub connector on the exact base and supported the design with offline semantics, lazy imports, allowlisting, and isolated tarball tests. Medium effort was explicitly selected and verified; the UI did not expose a separate Pro model label, so no Pro-model claim is made. Final diff review is recorded in the PR handover. | Final candidate changes affecting credentials, identity, or permissions. |
| Migration/recovery | No credential schema migration introduced. Existing legacy-read, concurrent refresh, disconnect, rollback, and cross-process tests remain. | Schema or persistence changes. |
| Golden/public contract | The public baseline adds the intentionally introduced fourth tool. Tool behavior is independently covered by ownership tests, a live read, and the installed MCP catalogue check; the baseline update alone is not proof. | Every public contract change. |
| Fuzz/property | No new parser or broad input grammar. Bounded input and negative cases are tested deterministically. | More complex input grammars or unbounded responses. |
| Metamorphic | Scope-order permutations and startup-profile changes are covered by regression tests. | New equivalent input forms or profile operations. |
| Performance | No performance claim or changed caching/concurrency mechanism. | Latency or throughput requirements, batching, or caching changes. |
| Release | Not requested. No merge, package/version publication, Registry publication, extension release, or production configuration change. | Explicit owner release authorization plus fresh required gates. |

The single implementation stays platform-agnostic. Doctor cannot test npm resolution when Node itself cannot start, cannot prove keyring write access, and cannot verify client registration or Etsy authorization. The installed smoke test uses the current Node runtime and published dependency range; it does not prove every architecture or future dependency version. No hosted MCP service, central OAuth, Etsy writes, buyer data, or new infrastructure was added.

The Model the Domain principle led to a shared typed doctor report for both output formats. Prove It Works led to installing and exercising the tarball outside the repository. The decision trail is in [mcp-usability-decisions.tsv](mcp-usability-decisions.tsv).
