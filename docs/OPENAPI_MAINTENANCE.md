# OpenAPI maintenance

The SDK and local MCP remain consumer tools. This maintenance workflow proposes
upstream specification updates; it never modifies SDK implementations, merges,
publishes, or changes shop data. TypeSafe/Jev evaluation is deferred: there are no
AI calls, AI credentials, or subscription dependencies in this workflow.

## Operation

Standard GitHub-hosted Ubuntu runners run every Monday at 08:00 UTC and on manual
dispatch. GitHub schedules are best effort, not an exact delivery-time guarantee.
The jobs require this repository to be public. There are no custom runners,
artifact uploads, persistent caches, external monitoring, or paid fallbacks.
The workflow uses only the repository's ephemeral GitHub token. Repository
settings must allow GitHub Actions to create pull requests; no personal token is
needed. The token cannot approve reviews through this implementation.

For an actual hosted PR-lifecycle check, manually dispatch the update workflow
with `rehearsal=true`. It uses a clearly labelled synthetic description change on
the separate `automation/etsy-openapi-rehearsal` branch. It creates one draft,
repeats without a new commit, injects a download failure, waits for two successful
exact-candidate validations, then closes the synthetic draft and removes that
branch. Failed rehearsals preserve the draft for diagnosis. This mode is never
selected by the weekly schedule and does not claim an upstream Etsy change.

Commands use Node 24 and the repository's pinned pnpm version:

| Command | Behavior |
| --- | --- |
| `pnpm spec:fetch [directory]` | Validates Etsy's document before writing a candidate; defaults to `.cache/spec-candidate` |
| `pnpm spec:diff [baseline] [candidate] [output-directory]` | JSON and Markdown reports; defaults to pinned baseline, cached candidate and `.cache/spec-report` |
| `pnpm spec:generate [input] [output]` | Generates internal types; defaults to pinned snapshot and `spec/generated/schema.d.ts` |
| `pnpm spec:check` | Offline digest/reproducibility checks, maintenance unit tests, public baseline check and strict compatibility examples |

These commands are also available for local development, but scheduled operation
does not depend on any maintainer machine. Consumer installs/builds do not fetch
the specification or run this tooling.

## Reviewing a proposal

The automation owns `automation/etsy-openapi` and maintains one draft PR. Review
the source digest/date, every structural change and the complete before/after
prose in `spec/report.md`. Categories indicate possible impact, not exhaustive
breaking-change analysis. Shared component changes can affect multiple methods;
unmapped operations must be investigated explicitly. Array order is preserved.
All unknown differences are retained.

Generated declarations are internal trial material, not public API replacements.
The automation branch may change only the snapshot, provenance, generated types
and reports. External references in the specification are rejected. Any future
local corrections must be explicit reproducible overlays, never edits hidden in
the unmodified snapshot.

The `spec-candidate` commit status links to a manually dispatched validation run
bound to the exact proposed SHA. Check the PR's current SHA against that status.
A green status establishes the offline checks, not live Etsy compatibility.
Normal review and repository protections still apply. A later SDK change needs
its own focused implementation, real-service evidence where applicable,
Changeset and semver review.

The automation commits use the GitHub Actions bot identity. Merge approved draft
updates with GitHub's signed squash merge to satisfy the default branch's verified
signature rule; do not weaken that protection or use an unsigned local merge.

## Ownership and recovery

- Unchanged parsed input produces no commit or PR. Formatting-only changes do
  not churn provenance. A repeated candidate reuses its SHA and reruns validation.
- Runs are serialized. Pushes use a lease to reject concurrent branch changes.
- Unexpected commits/paths or a PR taken out of draft stop branch updates. Do not
  hand-edit the automation branch: use a separate implementation branch.
- Fetch, validation or generation failures leave the remote state untouched.
  Inspect the failed Actions run and rerun after the cause is resolved.
- A push followed by a PR/dispatch API failure can be retried; the candidate SHA
  is reused. If Actions PR creation is disabled, enable that repository setting.
- If a maintainer intentionally takes ownership, finish or close that PR and
  remove its automation branch before resuming scheduled proposals.
- Disable the **Etsy specification updates** workflow in GitHub Actions to stop
  scheduling. GitHub may disable schedules in inactive public repositories;
  re-enable the workflow in GitHub when needed. No external keep-alive is added.

## Initial trial dispositions

Baseline source commit: `1f7cd4b` (SDK 4.0.0, MCP 1.0.0). The checked-in public
baseline records exports, representative signatures, tool names, runtime
dependencies and package file allowlists. Intentional future public changes must
update this baseline explicitly and undergo normal review.

| Observed difference | Disposition |
| --- | --- |
| Spec path identifiers are integers; SDK method parameters are strings | Intentional SDK transport interface; preserve current signatures |
| Spec response schemas omit required declarations for many fields, including shop and money | Unresolved spec/runtime guarantee; generated types are weaker than existing SDK types, so no wholesale migration |
| Spec update tags are nullable; SDK accepts arrays or omission | SDK/spec mismatch; negative compile-time example records it, no runtime change in this trial |
| Spec active-listings response is an envelope; SDK returns its results array | Intentional SDK response shaping; preserve it |
| SDK has compatibility options such as `legacy` beyond selected spec parameters | Intentional compatibility surface; retain it |
| Spec describes form-urlencoded listing updates | Encoding contract recorded; type generation does not prove runtime encoding |

Decision: retain internal generation and change reporting. Do not migrate public
types in this work. The sample already demonstrates optionality/nullability and
response-shaping differences requiring a separate migration review.

## Verification evidence

Record the final commit, exact check commands/results, hosted run URLs and
independent review outcome in the implementation handoff. Required lanes are
static/lint, generation, unit/regression, compile-time compatibility, package
contents, security review and hosted automation. Browser/visual and live-shop
mutation lanes are not applicable: this change has no UI or runtime Etsy request
changes. Runtime changes in a later PR require fresh real-service evidence.
