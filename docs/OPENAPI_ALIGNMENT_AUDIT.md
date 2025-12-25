OPENAPI Alignment Audit
=======================

Scope
-----
- Spec source: `docs/specs/3.0.0.json`
- Spec version: 3.0.0
- Client surface reviewed: all Etsy API methods in `src/client.ts`
- Note: This audit only covers functions that exist in the client. The spec
  includes additional operations not implemented by this project.

Status legend
-------------
- Aligned: matches spec path, params, and request content-type.
- Partial: mostly aligned, but missing optional params or minor differences.
- Mismatch: incorrect path, unsupported required behavior, or wrong content-type.
- Off-spec: client method does not exist in the spec.

Per-method alignment
--------------------

User and Shops
--------------
- getUser -> getUser (GET /v3/application/users/me): Aligned.
- getShop -> getShop (GET /v3/application/shops/{shop_id}): Aligned.
- getShopByOwnerUserId -> getShopByOwnerUserId (GET /v3/application/users/{user_id}/shops): Aligned.
- getUserShops -> uses /v3/application/users/{user_id}/shops: Aligned.
  - Note: JSDoc still says /users/me/shops but spec has no /users/me/shops.

Shop Sections
-------------
- getShopSections -> getShopSections (GET /shops/{shop_id}/sections): Aligned.
- getShopSection -> getShopSection (GET /shops/{shop_id}/sections/{shop_section_id}): Aligned.
- createShopSection -> createShopSection (POST /shops/{shop_id}/sections): Aligned
  only if body is application/x-www-form-urlencoded.
- updateShopSection -> updateShopSection (PUT /shops/{shop_id}/sections/{shop_section_id}):
  Aligned only if body is application/x-www-form-urlencoded.
- deleteShopSection -> deleteShopSection (DELETE /shops/{shop_id}/sections/{shop_section_id}): Aligned.

Listings (read/search)
----------------------
- getListingsByShop -> getListingsByShop (GET /shops/{shop_id}/listings): Aligned.
  - Params: state, limit, offset, sort_on, sort_order, includes, legacy.
- getListing -> getListing (GET /listings/{listing_id}): Partial.
  - Spec params: includes, language, legacy, allow_suggested_title.
  - Client must support all four to be fully aligned.
- findAllListingsActive -> findAllListingsActive (GET /listings/active): Partial.
  - Spec params: keywords, limit, offset, sort_on, sort_order, min_price,
    max_price, taxonomy_id, shop_location, legacy.
  - Any support for category/tags/location is off-spec.
- getListingImages -> getListingImages (GET /listings/{listing_id}/images): Aligned.
- getListingInventory -> getListingInventory (GET /listings/{listing_id}/inventory): Partial.
  - Spec params: show_deleted, includes=Listing, legacy.
  - Client must support legacy to be fully aligned.

Reviews
-------
- getReviewsByListing -> getReviewsByListing (GET /listings/{listing_id}/reviews): Aligned.
- getReviewsByShop -> getReviewsByShop (GET /shops/{shop_id}/reviews): Aligned.

Taxonomy
--------
- getSellerTaxonomyNodes -> getSellerTaxonomyNodes (GET /seller-taxonomy/nodes): Aligned.
- getBuyerTaxonomyNodes -> getBuyerTaxonomyNodes (GET /buyer-taxonomy/nodes): Aligned.
- getPropertiesByTaxonomyId -> getPropertiesByTaxonomyId
  (GET /seller-taxonomy/nodes/{taxonomy_id}/properties): Aligned.

Listings (write)
----------------
- createDraftListing -> createDraftListing (POST /shops/{shop_id}/listings): Mismatch
  if JSON body is used. Spec requires application/x-www-form-urlencoded.
  - Optional query param: legacy.
- updateListing -> updateListing (PATCH /shops/{shop_id}/listings/{listing_id}): Mismatch
  if JSON body is used. Spec requires application/x-www-form-urlencoded.
  - Optional query param: legacy.
- deleteListing -> deleteListing (DELETE /listings/{listing_id}): Aligned.
- updateListingInventory -> updateListingInventory (PUT /listings/{listing_id}/inventory): Partial.
  - Body is JSON (allowed).
  - Spec supports legacy query param; client must implement.
- updateListingProperty -> updateListingProperty
  (PUT /shops/{shop_id}/listings/{listing_id}/properties/{property_id}): Partial.
  - Spec fields: value_ids, values (array fields), scale_id optional.
  - Client currently uses value_ids[] and values[] field names (param naming mismatch).

Listing Images
--------------
- uploadListingImage -> uploadListingImage (POST /shops/{shop_id}/listings/{listing_id}/images): Aligned.
- getListingImage -> getListingImage (GET /listings/{listing_id}/images/{listing_image_id}): Mismatch
  if implemented on /shops/{shop_id}/listings/... or requires shop_id.
- deleteListingImage -> deleteListingImage (DELETE /shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}): Aligned.

Receipts / Transactions
-----------------------
- getShopReceipts -> getShopReceipts (GET /shops/{shop_id}/receipts): Partial.
  - Spec params include was_canceled and legacy.
  - sort_on values are created|updated|receipt_id.
- getShopReceipt -> getShopReceipt (GET /shops/{shop_id}/receipts/{receipt_id}): Partial.
  - Spec supports legacy.
- updateShopReceipt -> updateShopReceipt (PUT /shops/{shop_id}/receipts/{receipt_id}): Mismatch
  if JSON body is used. Spec requires application/x-www-form-urlencoded, legacy optional.
- getShopReceiptTransactions -> getShopReceiptTransactionsByReceipt
  (GET /shops/{shop_id}/receipts/{receipt_id}/transactions): Partial.
  - Spec supports legacy.
- getShopTransaction -> getShopReceiptTransaction
  (GET /shops/{shop_id}/transactions/{transaction_id}): Aligned.
- createReceiptShipment -> createReceiptShipment
  (POST /shops/{shop_id}/receipts/{receipt_id}/tracking): Mismatch
  if JSON body is used. Spec requires application/x-www-form-urlencoded, legacy optional.
- getShopReceiptShipments -> Off-spec.
  - No /shops/{shop_id}/receipts/{receipt_id}/shipments endpoint in spec.

Shipping Profiles
-----------------
- getShopShippingProfiles -> getShopShippingProfiles (GET /shops/{shop_id}/shipping-profiles): Aligned.
- createShopShippingProfile -> createShopShippingProfile (POST /shops/{shop_id}/shipping-profiles):
  Mismatch if JSON body is used. Spec requires application/x-www-form-urlencoded.
- getShopShippingProfile -> getShopShippingProfile (GET /shops/{shop_id}/shipping-profiles/{shipping_profile_id}): Aligned.
- updateShopShippingProfile -> updateShopShippingProfile (PUT /shops/{shop_id}/shipping-profiles/{shipping_profile_id}):
  Mismatch if JSON body is used. Spec requires application/x-www-form-urlencoded.
- deleteShopShippingProfile -> deleteShopShippingProfile (DELETE /shops/{shop_id}/shipping-profiles/{shipping_profile_id}): Aligned.
- getShopShippingProfileDestinations -> getShopShippingProfileDestinationsByShippingProfile
  (GET /shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations): Partial.
  - Spec supports limit and offset.
- createShopShippingProfileDestination -> createShopShippingProfileDestination
  (POST /shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations):
  Mismatch if JSON body is used. Spec requires application/x-www-form-urlencoded.
- updateShopShippingProfileDestination -> updateShopShippingProfileDestination
  (PUT /shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations/{shipping_profile_destination_id}):
  Mismatch if JSON body is used. Spec requires application/x-www-form-urlencoded.
- deleteShopShippingProfileDestination -> deleteShopShippingProfileDestination: Aligned.
- getShopShippingProfileUpgrades -> getShopShippingProfileUpgrades: Aligned.

Payments
--------
- getShopPaymentAccountLedgerEntries -> getShopPaymentAccountLedgerEntries: Aligned.
- getShopPaymentAccountLedgerEntry -> getShopPaymentAccountLedgerEntry: Aligned.
- getShopPayment -> Off-spec.
  - Spec defines:
    - GET /shops/{shop_id}/payments (payment_ids)
    - GET /shops/{shop_id}/receipts/{receipt_id}/payments
    - GET /shops/{shop_id}/payment-account/ledger-entries/payments
  - There is no /payment-account/payments/{payment_id} in the spec.

Shop Production Partners
------------------------
- getShopProductionPartners -> getShopProductionPartners (GET /shops/{shop_id}/production-partners): Aligned.

OperationId naming mismatches (non-functional)
----------------------------------------------
- getShopTransaction vs spec getShopReceiptTransaction.
- getShopReceiptTransactions vs spec getShopReceiptTransactionsByReceipt.
- getShopShippingProfileDestinations vs spec getShopShippingProfileDestinationsByShippingProfile.

Work done in current branch (code changes already applied)
----------------------------------------------------------
- Added support for listing includes enum and added ListingParams fields:
  state includes sold_out, sort_on updated, sort_order aliases, legacy.
- Added support for getListing extra params (includes, language, legacy, allow_suggested_title).
- Added getListingInventory params (show_deleted, includes, legacy).
- Adjusted SearchParams to spec (keywords, sort_on, sort_order, min_price,
  max_price, taxonomy_id, shop_location, legacy).
- Updated EtsyListing state union to include sold_out.
- Restricted UpdateListingParams state to active|inactive.
- Added readiness_state_id and should_auto_renew to CreateDraftListingParams.
- Added readiness_state_on_property to UpdateListingInventoryParams.
- Added policy_additional to UpdateShopParams.
- Updated GetShopReceiptsParams with was_canceled and legacy.
- Updated GetShopReceiptParams and GetShopReceiptTransactionsParams to include legacy.
- Added shipping profile parameter alignments and GetShippingProfileDestinationsParams.
- Updated getUserShops to use /users/{user_id}/shops.
- Switched updateShop, createShopSection, updateShopSection,
  createDraftListing, updateListing to form-encoded bodies with legacy query
  support where applicable.
- Updated getListingImage to use /listings/{listing_id}/images/{listing_image_id}.

Remaining gaps to address (implementation)
------------------------------------------
- updateListingInventory: add legacy query parameter support.
- updateListingProperty: use field names value_ids and values (not value_ids[]/values[]).
- getShopReceipts: include was_canceled and legacy in query serialization.
- getShopReceipt: support legacy query parameter.
- updateShopReceipt: send application/x-www-form-urlencoded body and legacy param.
- getShopReceiptTransactions: support legacy query parameter.
- createReceiptShipment: send application/x-www-form-urlencoded body and legacy param.
- getShopReceiptShipments: remove or re-scope; endpoint is off-spec.
- createShopShippingProfile/updateShopShippingProfile: use form-encoded bodies.
- getShopShippingProfileDestinations: add limit/offset support.
- createShopShippingProfileDestination/updateShopShippingProfileDestination: use form-encoded bodies.
- getShopPayment: rework to match spec (payments list, receipt payments, or ledger-entry payments).

