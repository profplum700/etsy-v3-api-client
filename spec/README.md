# Etsy OpenAPI spec snapshots

This directory stores local, dated snapshots of Etsy's public OpenAPI v3
schema. The current pin is:

- Source URL: `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Local file: `spec/etsy-openapi-3.0.0-2026-05-10.json`
- Captured: 2026-05-10
- SHA-256: `7e300352ce87c5e4a4e44bc2a46f9d7865cc2bd7e6be6b0d9c1fb29238cc283b`

The snapshot is intentionally committed so tests can validate SDK assumptions
without live network access and without silent upstream spec drift.

## Refresh procedure

1. Download a new dated copy from Etsy:

   ```bash
   curl -fsSL https://www.etsy.com/openapi/generated/oas/3.0.0.json \
     -o spec/etsy-openapi-3.0.0-YYYY-MM-DD.json
   ```

2. Update `__tests__/openapi-spec-contracts.test.ts` to point at the new dated
   file and adjust contract expectations only when the upstream spec changed on
   purpose.
3. Record the new capture date and `sha256sum` in this file.
4. Run:

   ```bash
   pnpm run test:spec-contracts
   ```

Do not regenerate generated client output as part of a spec pin refresh unless a
separate change explicitly calls for it.
