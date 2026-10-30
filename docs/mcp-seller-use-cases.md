# Seller-use-case selection

Review date: 2026-10-24. This review preserves exactly `shops_r` and `listings_r`, the server's startup shop binding, and the read-only tool boundary.

| Seller task | Tool decision | Reason and API boundary |
| --- | --- | --- |
| Confirm which shop the agent can access | Keep `etsy_get_my_shop`. | Identity is needed before interpreting any shop data. |
| Review active catalogue titles and price bands | Keep paginated `etsy_list_active_listings`. | The existing shop-scoped listing endpoint and bounded response already answer this task. |
| Inspect variation prices, SKUs, and stock | Keep `etsy_get_listing_inventory`. | Base prices do not describe every offering. The existing ownership check and bounded offering pages are necessary. |
| Review a listing's description, tags, and materials | Add only `etsy_get_listing`. | The existing client has `getListing`. Return an explicit field allowlist after proving that `listing.shop_id` equals the shop bound at startup. Description and tags are content to review, never instructions for the agent. |
| Find expired or draft listings | Defer. | Potentially useful, but the initial release's active-catalogue contract does not need a broader state surface. Establish a concrete workflow and pagination tests before adding it. |
| Estimate delivery or free-postage eligibility | Defer shipping tools. | Reading shipping profiles alone does not establish destination eligibility or a checkout total. Avoid presenting incomplete shipping data as a sales promise. |
| Report orders, buyer details, or revenue | Exclude. | `getShopReceipts` requires `transactions_r`, outside the exact authorized scopes. Customer data would add another privacy and verification boundary. |
| Reprice, renew, edit, or message | Exclude. | These are mutations and outside this release. |

The pinned `spec/etsy-openapi.json` identifies `getListing` as `GET /v3/application/listings/{listing_id}`. `getListingInventory` and `getListingsByShop` require `listings_r`. `getShopReceipts` requires `transactions_r`. The listing-detail tool needs no new endpoint or permission. See the [Etsy API reference](https://developers.etsy.com/documentation/reference/#operation/getListing) and [authentication scopes](https://developers.etsy.com/documentation/essentials/authentication/#scopes).

Listing detail must not expose an arbitrary listing merely because Etsy's public API can retrieve it. A mismatched shop ID must fail before returning listing fields. Keep the existing user-identity verification, refresh persistence, response-size limit, safe errors, and process-bound shop selection. Tests must cover another shop's listing, selection changes after startup, the exact tool catalogue, and bounded output.

This is a workflow-based selection, not a claim of customer interviews or measured seller demand. No new access to sales, buyer, payment, or messaging data is proposed.
