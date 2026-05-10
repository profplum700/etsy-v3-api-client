# Etsy Trading Manager V1 endpoint coverage

This matrix documents the api-client surface needed by a generic Etsy Trading
Manager-style integration: a private snapshot ingester plus a self-hosted MCP
server that exposes a small V1 read-tool set and keeps write tools disabled for
recommendation-only runs.

Spec source: the pinned Etsy OpenAPI snapshot at
[`spec/etsy-openapi-3.0.0-2026-05-10.json`](../spec/etsy-openapi-3.0.0-2026-05-10.json),
captured from `https://www.etsy.com/openapi/generated/oas/3.0.0.json`. The pin
and refresh procedure are documented in [`spec/README.md`](../spec/README.md),
and the assumptions called out below are guarded by
`pnpm run test:spec-contracts`.

## Status legend

- **Supported**: api-client has a public method and local tests for the planned
  use.
- **Supported via composite**: all required Etsy endpoints are covered; the MCP
  server or private orchestrator composes them into a higher-level tool.
- **Deferred write**: api-client support exists, but the operation is not part of
  the unattended V1 recommendation flow and must stay off the V1 agent allow-list.
- **Follow-up owner**: downstream task that owns schema/tool wiring or additional
  harness coverage. No row below requires a new api-client endpoint before V1
  MCP implementation can start.

## Coverage matrix

| Consumer / owner | V1 need or MCP tool | Pinned spec operation | api-client surface | Support status | Auth / write risk | Test coverage | Follow-up / notes |
|---|---|---|---|---|---|---|---|
| MCP server | `etsy_search_public_listings` | `findAllListingsActive` — `GET /v3/application/listings/active` | `EtsyClient.findAllListingsActive(params)` | Supported | Read-only; root `x-api-key`; consumes public listing quota; no OAuth write scope. | `__tests__/client-listings.test.ts`; `__tests__/openapi-spec-contracts.test.ts` checks spec pin metadata. | Optional competitive-context tool; off critical snapshot path. |
| MCP server | `etsy_get_public_shop` | `getShop` — `GET /v3/application/shops/{shop_id}` | `EtsyClient.getShop(shopId)` | Supported | Read-only; root `x-api-key`; no write scope. Client instances with OAuth will still send bearer headers through common request plumbing. | `__tests__/client-user-shop.test.ts`. | Tool contract/schema owner: `ETM PR 2.5a`. |
| MCP server / snapshot ingester | authenticated user lookup | `getMe` — `GET /v3/application/users/me` | `EtsyClient.getUser()` / `EtsyClient.getMe()` | Supported | Read-only; `x-api-key` + OAuth `shops_r`; no write scope. | `__tests__/client-user-shop.test.ts`. | Used to resolve the authenticated shop when a shop ID is not supplied. |
| MCP server / snapshot ingester | shop context | Composite of `getMe`, `getShop`, and optionally `getShopByOwnerUserId` | `getUser()`/`getMe()` + `getShop(shopId?)` + `getShopByOwnerUserId(userId)` | Supported via composite | Read-only; `shops_r` for authenticated user-owned shop context; no write scope. | Component methods covered in `__tests__/client-user-shop.test.ts`. | No dedicated `getShopContext` helper is required for V1. MCP contract/composition owner: `ETM PR 2.5a`; shop/listing implementation owner: `ETM PR 2.5b`. |
| MCP server / snapshot ingester | `etsy_list_shop_listings` and snapshot listing page fetch | `getListingsByShop` — `GET /v3/application/shops/{shop_id}/listings` | `EtsyClient.getListingsByShop(shopId, { state, limit, offset, sort_on, sort_order, includes, legacy })` | Supported | Read-only; `x-api-key` + OAuth `listings_r`; paginated; no write scope. | `__tests__/client-listings.test.ts`; query-builder tests cover list composition. | Snapshot ingesters should page deterministically and store the raw response they consumed. |
| MCP server / snapshot ingester | `etsy_get_listing_full` / detail drill-in | `getListing` — `GET /v3/application/listings/{listing_id}` with `includes` | `EtsyClient.getListing(listingId, { includes })` | Supported | Read-only; root `x-api-key`; include choices may expose richer listing metadata but no write scope. | `__tests__/client-listings.test.ts` covers `Images`/`Inventory` includes. | Use includes such as `Images`, `Inventory`, `Translations`, `Shop`, `Shipping`, `Videos` as needed. The pinned spec also lists `Personalization` and `BuyerPrice`; those are not required by V1 and should be added deliberately if a later tool needs them. |
| Snapshot ingester | inventory detail fallback for quantity/price | `getListingInventory` — `GET /v3/application/listings/{listing_id}/inventory` | `EtsyClient.getListingInventory(listingId, params)` | Supported | Read-only; `x-api-key` + OAuth `listings_r`; no write scope. | Covered indirectly by listing-full inventory include tests; write-shape pin in `__tests__/openapi-spec-contracts.test.ts`. | Use when list/detail responses are insufficient for exact inventory capture. Add a dedicated unit test before extending this path beyond V1 snapshot fallback. |
| MCP server | `etsy_get_taxonomy_properties` | `getPropertiesByTaxonomyId` — `GET /v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties` | `EtsyClient.getPropertiesByTaxonomyId(taxonomyId)` | Supported | Read-only; root `x-api-key`; no write scope. | `__tests__/client-taxonomy.test.ts`. | Reference-tool implementation owner: `ETM PR 2.5c`. |
| MCP server | `etsy_get_shipping_profiles` | `getShopShippingProfiles` — `GET /v3/application/shops/{shop_id}/shipping-profiles` | `EtsyClient.getShopShippingProfiles(shopId)` | Supported | Read-only; `x-api-key` + OAuth `shops_r`; no write scope. | `__tests__/client-shipping.test.ts`. | Reference-tool implementation owner: `ETM PR 2.5c`. |
| MCP server | `etsy_get_receipts` | `getShopReceipts` — `GET /v3/application/shops/{shop_id}/receipts` | `EtsyClient.getShopReceipts(shopId, params)` | Supported, not enabled for V1 recommendation flow | Read-only but privacy-sensitive order data; `x-api-key` + OAuth `transactions_r`; no write scope. | `__tests__/client-receipts.test.ts`; query-builder receipt tests. | Tool exists in the 13-tool contract for V2+ performance context; keep out of V1 allow-list unless the prompt/tool policy changes. |
| MCP server | `etsy_get_receipt_full` | `getShopReceipt` — `GET /v3/application/shops/{shop_id}/receipts/{receipt_id}` | `EtsyClient.getShopReceipt(shopId, receiptId)` | Supported, not enabled for V1 recommendation flow | Read-only but privacy-sensitive order detail; `transactions_r`; no write scope. | `__tests__/client-receipts.test.ts`. | Same V2+ gating as receipt list. |
| MCP server (deferred write) | `etsy_update_listing_content` | `updateListing` — `PATCH /v3/application/shops/{shop_id}/listings/{listing_id}` | `EtsyClient.updateListing(shopId, listingId, params, options)` | Deferred write; api-client supported | Write operation; `x-api-key` + OAuth `listings_w`; high brand/catalog risk; must not run in V1 recommendation-only flow. | `__tests__/client-listings.test.ts`; `__tests__/openapi-spec-contracts.test.ts` pins PATCH + form-url-encoded shape. | Future execution/review flow only. V1 tool policy should omit or deny. |
| MCP server (deferred write) | inventory price update behavior behind listing recommendations | `updateListingInventory` — `PUT /v3/application/listings/{listing_id}/inventory` | `EtsyClient.updateListingInventory(listingId, params, options)` | Deferred write; api-client supported | Write operation; `listings_w`; high price/stock risk; must not run in V1 recommendation-only flow. | `__tests__/client-listings.test.ts`; `__tests__/openapi-spec-contracts.test.ts` pins JSON offering price shape. | Use only in future approved execution flow; V1 recommendation rows may describe price ideas but do not call this endpoint. |
| MCP server (deferred write) | `etsy_update_listing_personalization` | `updateListingPersonalization` — `POST /v3/application/shops/{shop_id}/listings/{listing_id}/personalization` | `EtsyClient.updateListingPersonalization(shopId, listingId, params)` | Deferred write; api-client supported | Write operation; `listings_w`; can replace seller-entered personalization; must not run in V1 recommendation-only flow. | `__tests__/client-personalization.test.ts`; `__tests__/openapi-spec-contracts.test.ts` pins multi-question shape. | V1 may reason about this only as a recommendation. Execution belongs to a later approval flow. |
| MCP server (deferred write) | `etsy_upload_listing_media` | `uploadListingImage` / `uploadListingFile` / `uploadListingVideo` — multipart media POSTs | `uploadListingImage`, `uploadListingFile`, `uploadListingVideo` | Deferred write; api-client supported and Worker-safe for Blob/File input | Write/upload operation; `listings_w`; high catalog risk; must not run in V1 recommendation-only flow. | `__tests__/client-listings.test.ts`; `__tests__/client-listing-files.test.ts`; `__tests__/client-listing-videos.test.ts`; `__tests__/worker-upload.test.ts`. | Worker-safe upload path was handled by the media-upload bead; keep tool off V1 allow-list. |
| MCP server Worker / snapshot ingester | OAuth token sourcing and refresh | Etsy OAuth token endpoint plus request-time token provider | `TokenProvider`, `TokenVaultClient`, `DurableObjectTokenVault`, existing `TokenManager` | Supported | Secret-bearing auth path; diagnostics must stay redacted; no Etsy write by itself. | `__tests__/auth/token-manager.test.ts`; `__tests__/auth/durable-object-token-vault.test.ts`; `__tests__/worker-entrypoint.test.ts`. | Handled by earlier token-provider and Durable Object vault beads. |
| MCP server Worker | Worker import/runtime hygiene | Not an Etsy endpoint | `/worker` entrypoint | Supported | Runtime-safety risk only; no Etsy write by itself. | `__tests__/worker-entrypoint.test.ts`; `__tests__/worker-upload.test.ts`. | Required before Worker-hosted MCP tools import the client. |

## Follow-up mapping

- `ETM PR 2.5a`: owns MCP V1 tool contract and must map tool schemas to the
  api-client surfaces above.
- `ETM PR 2.5b`: owns shop/listing read-tool implementation, including any
  `getShopContext` or `getListingFull` composition in the MCP server.
- `ETM PR 2.5c`: owns taxonomy and shipping/reference read tools.
- `ETM PR 2.5d`: owns MCP harness/auth/error logging contract tests and
  should assert that V1 write-capable tools are absent from the unattended
  allow-list.

No new api-client endpoint implementation bead is required by this matrix for
ETM V1. The intentional gaps are convenience composites and downstream MCP
schema/harness work, not missing Etsy endpoint coverage in the client.
