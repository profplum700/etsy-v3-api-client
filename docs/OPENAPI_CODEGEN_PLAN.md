# Incremental OpenAPI type generation plan

## Purpose and status

Reduce manual maintenance of Etsy request and response types while preserving the SDK public API and its existing runtime behavior. This is a future-work proposal, not a blocker for SDK 4.0.0 or local MCP 1.0.0. No generator or runtime migration is implemented by this draft.

The first deliverable is a bounded type-generation trial. Broader adoption depends on measured compatibility and maintenance benefit.

## Trial scope

1. Save Etsy's published OpenAPI document at `spec/etsy-openapi.json`. Record its source URL, retrieval date, and SHA-256 digest. Validate the snapshot before generating from it.
2. Evaluate an existing generator, starting with `openapi-typescript`, and pin the selected version. Avoid building a custom generator unless a demonstrated requirement cannot be met by existing tooling.
3. Generate request and response types into an isolated directory. Initially keep them internal and use them in comparisons and type checks, without replacing public exports or endpoint implementations.
4. Compare a small representative set of operations: authenticated shop lookup, active listing pagination, listing variation inventory, and one listing update request shape. Check optional and nullable fields, money, identifiers, enums, pagination, and request encoding.
5. Document every difference from the current SDK as an SDK mismatch, specification mismatch, intentional compatibility behavior, or unresolved question. Resolve consequential uncertainty with official documentation and focused integration evidence.

Sources:

- Etsy OpenAPI: https://www.etsy.com/openapi/generated/oas/3.0.0.json
- Etsy reference: https://developers.etsy.com/documentation/reference/
- Generator candidate: https://openapi-ts.dev/introduction

## Preserved behavior

Keep the current public methods and compatibility guarantees. OAuth, refresh-token persistence and synchronization, retries, rate limiting, pagination, caching, and bulk operations remain maintained runtime code.

Generated TypeScript types provide compile-time checks, not runtime validation or proof that Etsy's live API matches its specification. Any necessary local specification corrections must be explicit, documented, reproducible, and applied separately from the unmodified source snapshot.

## Phases and exit gates

### 1. Establish a reproducible baseline

Inspect current SDK source and consumers before starting; do not implement against this draft branch's historical SDK snapshot. Pin the specification and generator and add one documented generation command.

Exit gate: two runs from the same inputs produce identical output, the output compiles, and the public API and runtime dependency graph remain unchanged.

### 2. Prove representative compatibility

Compare generated types against current SDK types and representative fixtures. Add meaningful compile-time positive and negative examples for the selected operations. Verify any resulting request or response behavior changes against Etsy; do not mutate a live shop for this trial.

Exit gate: each discrepancy has a documented disposition, existing consumer usage remains compatible, and any claimed live behavior has appropriate real-service evidence. Record the final candidate commit, commands, and results.

### 3. Decide whether to adopt generated types

Review the trial's maintenance cost, spec correction burden, compatibility impact, and coverage benefit. If useful, migrate a small type surface while retaining adapters or aliases where needed. Apply normal review, tests, release notes, and semver rules to any public type changes.

Exit gate: independently reviewed evidence supports the specific migration. Otherwise stop at the trial and retain its findings.

### 4. Consider endpoint generation separately

Only after type generation demonstrates value, evaluate generating endpoint method definitions or implementations behind the existing runtime layer. Define a separate scope and compatibility gate before implementation.

Full client replacement, generated runtime validators and error classes, and custom generator infrastructure are deferred. They are not acceptance requirements for this trial.

## Specification updates

Update the pinned Etsy specification deliberately through reviewed changes. Show both the specification diff and regenerated output, identify affected consumers, and run the relevant checks. CI may verify that committed output matches pinned inputs; it must not silently pull a changing remote spec into releases.

## Trial acceptance checklist

- [ ] Specification source, retrieval date, digest, and generator version recorded.
- [ ] Generation is deterministic and generated output compiles.
- [ ] Representative request and response differences are classified and reviewed.
- [ ] Existing SDK public exports, methods, and runtime behavior are preserved during the trial.
- [ ] No runtime dependency is added for type generation.
- [ ] Specification inaccuracies and intentional compatibility differences have an explicit handling policy.
- [ ] Evidence supports an adopt, revise, or stop decision before expanding scope.
