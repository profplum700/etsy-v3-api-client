# Etsy specification change report

1 differences. All require review; categories are advisory.

## changed

<pre>{
  "pointer": "/info/description",
  "category": "prose",
  "operation": null,
  "sdkMethod": null
}</pre>

Before:
<pre>"&lt;div class=\"wt-text-body-01\"&gt;&lt;p class=\"wt-pt-xs-2 wt-pb-xs-2\"&gt;Etsy's Open API provides a simple RESTful interface for various Etsy.com features.&lt;/p&gt;&lt;p class=\"wt-pb-xs-2\"&gt;If you'd like to report an issue or provide feedback on the API design, &lt;a target=\"_blank\" class=\"wt-text-link wt-p-xs-0\" href=\"https://github.com/etsy/open-api/discussions\"&gt;please add an issue in Github&lt;/a&gt;.&lt;/p&gt;&lt;/div&gt;&amp;copy; 2021-2026 Etsy, Inc. All Rights Reserved. Use of this code is subject to Etsy's &lt;a class='wt-text-link wt-p-xs-0' target='_blank' href='https://www.etsy.com/legal/api'&gt;API Developer Terms of Use&lt;/a&gt;."</pre>

After:
<pre>"&lt;div class=\"wt-text-body-01\"&gt;&lt;p class=\"wt-pt-xs-2 wt-pb-xs-2\"&gt;Etsy's Open API provides a simple RESTful interface for various Etsy.com features.&lt;/p&gt;&lt;p class=\"wt-pb-xs-2\"&gt;If you'd like to report an issue or provide feedback on the API design, &lt;a target=\"_blank\" class=\"wt-text-link wt-p-xs-0\" href=\"https://github.com/etsy/open-api/discussions\"&gt;please add an issue in Github&lt;/a&gt;.&lt;/p&gt;&lt;/div&gt;&amp;copy; 2021-2026 Etsy, Inc. All Rights Reserved. Use of this code is subject to Etsy's &lt;a class='wt-text-link wt-p-xs-0' target='_blank' href='https://www.etsy.com/legal/api'&gt;API Developer Terms of Use&lt;/a&gt;.\nSYNTHETIC MAINTENANCE REHEARSAL; NOT AN ETSY UPDATE."</pre>

## Unmapped operations

<pre>[
  {
    "path": "/v3/application/buyer-taxonomy/nodes",
    "method": "get",
    "operationId": "getBuyerTaxonomyNodes"
  },
  {
    "path": "/v3/application/buyer-taxonomy/nodes/{taxonomy_id}/properties",
    "method": "get",
    "operationId": "getPropertiesByBuyerTaxonomyId"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings",
    "method": "post",
    "operationId": "createDraftListing"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings",
    "method": "get",
    "operationId": "getListingsByShop"
  },
  {
    "path": "/v3/application/listings/{listing_id}",
    "method": "delete",
    "operationId": "deleteListing"
  },
  {
    "path": "/v3/application/listings/{listing_id}",
    "method": "get",
    "operationId": "getListing"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/files/{listing_file_id}",
    "method": "delete",
    "operationId": "deleteListingFile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/files/{listing_file_id}",
    "method": "get",
    "operationId": "getListingFile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/files",
    "method": "get",
    "operationId": "getAllListingFiles"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/files",
    "method": "post",
    "operationId": "uploadListingFile"
  },
  {
    "path": "/v3/application/listings/active",
    "method": "get",
    "operationId": "findAllListingsActive"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}",
    "method": "delete",
    "operationId": "deleteListingImage"
  },
  {
    "path": "/v3/application/listings/{listing_id}/images/{listing_image_id}",
    "method": "get",
    "operationId": "getListingImage"
  },
  {
    "path": "/v3/application/listings/{listing_id}/images",
    "method": "get",
    "operationId": "getListingImages"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/images",
    "method": "post",
    "operationId": "uploadListingImage"
  },
  {
    "path": "/v3/application/listings/{listing_id}/inventory",
    "method": "put",
    "operationId": "updateListingInventory"
  },
  {
    "path": "/v3/application/listings/batch/inventory",
    "method": "get",
    "operationId": "getListingsInventoryByListingIds"
  },
  {
    "path": "/v3/application/listings/{listing_id}/inventory/products/{product_id}",
    "method": "get",
    "operationId": "getListingProduct"
  },
  {
    "path": "/v3/application/listings/{listing_id}/products/{product_id}/offerings/{product_offering_id}",
    "method": "get",
    "operationId": "getListingOffering"
  },
  {
    "path": "/v3/application/listings/batch",
    "method": "get",
    "operationId": "getListingsByListingIds"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/featured",
    "method": "get",
    "operationId": "getFeaturedListingsByShop"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/personalization",
    "method": "delete",
    "operationId": "deleteListingPersonalization"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/personalization",
    "method": "post",
    "operationId": "updateListingPersonalization"
  },
  {
    "path": "/v3/application/listings/{listing_id}/personalization",
    "method": "get",
    "operationId": "getListingPersonalization"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/properties/{property_id}",
    "method": "delete",
    "operationId": "deleteListingProperty"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/properties/{property_id}",
    "method": "put",
    "operationId": "updateListingProperty"
  },
  {
    "path": "/v3/application/listings/{listing_id}/properties/{property_id}",
    "method": "get",
    "operationId": "getListingProperty"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/properties",
    "method": "get",
    "operationId": "getListingProperties"
  },
  {
    "path": "/v3/application/listings/batch/shipping",
    "method": "get",
    "operationId": "getListingsShippingByListingIds"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/transactions",
    "method": "get",
    "operationId": "getShopReceiptTransactionsByListing"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}",
    "method": "post",
    "operationId": "createListingTranslation"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}",
    "method": "get",
    "operationId": "getListingTranslation"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}",
    "method": "put",
    "operationId": "updateListingTranslation"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/variation-images",
    "method": "get",
    "operationId": "getListingVariationImages"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/variation-images",
    "method": "post",
    "operationId": "updateVariationImages"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/videos/{video_id}",
    "method": "delete",
    "operationId": "deleteListingVideo"
  },
  {
    "path": "/v3/application/listings/{listing_id}/videos/{video_id}",
    "method": "get",
    "operationId": "getListingVideo"
  },
  {
    "path": "/v3/application/listings/{listing_id}/videos",
    "method": "get",
    "operationId": "getListingVideos"
  },
  {
    "path": "/v3/application/shops/{shop_id}/listings/{listing_id}/videos",
    "method": "post",
    "operationId": "uploadListingVideo"
  },
  {
    "path": "/v3/application/shops/{shop_id}/payment-account/ledger-entries/{ledger_entry_id}",
    "method": "get",
    "operationId": "getShopPaymentAccountLedgerEntry"
  },
  {
    "path": "/v3/application/shops/{shop_id}/payment-account/ledger-entries",
    "method": "get",
    "operationId": "getShopPaymentAccountLedgerEntries"
  },
  {
    "path": "/v3/application/shops/{shop_id}/payment-account/ledger-entries/payments",
    "method": "get",
    "operationId": "getPaymentAccountLedgerEntryPayments"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}/payments",
    "method": "get",
    "operationId": "getShopPaymentByReceiptId"
  },
  {
    "path": "/v3/application/shops/{shop_id}/payments",
    "method": "get",
    "operationId": "getPayments"
  },
  {
    "path": "/v3/application/openapi-ping",
    "method": "get",
    "operationId": "ping"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}",
    "method": "get",
    "operationId": "getShopReceipt"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}",
    "method": "put",
    "operationId": "updateShopReceipt"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts",
    "method": "get",
    "operationId": "getShopReceipts"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}/listings",
    "method": "get",
    "operationId": "getListingsByShopReceipt"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}/tracking",
    "method": "post",
    "operationId": "createReceiptShipment"
  },
  {
    "path": "/v3/application/shops/{shop_id}/receipts/{receipt_id}/transactions",
    "method": "get",
    "operationId": "getShopReceiptTransactionsByReceipt"
  },
  {
    "path": "/v3/application/listings/{listing_id}/reviews",
    "method": "get",
    "operationId": "getReviewsByListing"
  },
  {
    "path": "/v3/application/shops/{shop_id}/reviews",
    "method": "get",
    "operationId": "getReviewsByShop"
  },
  {
    "path": "/v3/application/seller-taxonomy/nodes",
    "method": "get",
    "operationId": "getSellerTaxonomyNodes"
  },
  {
    "path": "/v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties",
    "method": "get",
    "operationId": "getPropertiesByTaxonomyId"
  },
  {
    "path": "/v3/application/shipping-carriers",
    "method": "get",
    "operationId": "getShippingCarriers"
  },
  {
    "path": "/v3/application/shops/{shop_id}",
    "method": "put",
    "operationId": "updateShop"
  },
  {
    "path": "/v3/application/shops/{shop_id}/holiday-preferences",
    "method": "get",
    "operationId": "getHolidayPreferences"
  },
  {
    "path": "/v3/application/shops/{shop_id}/holiday-preferences/{holiday_id}",
    "method": "put",
    "operationId": "updateHolidayPreferences"
  },
  {
    "path": "/v3/application/shops",
    "method": "get",
    "operationId": "findShops"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return/consolidate",
    "method": "post",
    "operationId": "consolidateShopReturnPolicies"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return",
    "method": "post",
    "operationId": "createShopReturnPolicy"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return",
    "method": "get",
    "operationId": "getShopReturnPolicies"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return/{return_policy_id}",
    "method": "delete",
    "operationId": "deleteShopReturnPolicy"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return/{return_policy_id}",
    "method": "get",
    "operationId": "getShopReturnPolicy"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return/{return_policy_id}",
    "method": "put",
    "operationId": "updateShopReturnPolicy"
  },
  {
    "path": "/v3/application/shops/{shop_id}/policies/return/{return_policy_id}/listings",
    "method": "get",
    "operationId": "getListingsByShopReturnPolicy"
  },
  {
    "path": "/v3/application/shops/{shop_id}/production-partners",
    "method": "get",
    "operationId": "getShopProductionPartners"
  },
  {
    "path": "/v3/application/shops/{shop_id}/readiness-state-definitions",
    "method": "post",
    "operationId": "createShopReadinessStateDefinition"
  },
  {
    "path": "/v3/application/shops/{shop_id}/readiness-state-definitions",
    "method": "get",
    "operationId": "getShopReadinessStateDefinitions"
  },
  {
    "path": "/v3/application/shops/{shop_id}/readiness-state-definitions/{readiness_state_definition_id}",
    "method": "delete",
    "operationId": "deleteShopReadinessStateDefinition"
  },
  {
    "path": "/v3/application/shops/{shop_id}/readiness-state-definitions/{readiness_state_definition_id}",
    "method": "get",
    "operationId": "getShopReadinessStateDefinition"
  },
  {
    "path": "/v3/application/shops/{shop_id}/readiness-state-definitions/{readiness_state_definition_id}",
    "method": "put",
    "operationId": "updateShopReadinessStateDefinition"
  },
  {
    "path": "/v3/application/shops/{shop_id}/sections",
    "method": "post",
    "operationId": "createShopSection"
  },
  {
    "path": "/v3/application/shops/{shop_id}/sections",
    "method": "get",
    "operationId": "getShopSections"
  },
  {
    "path": "/v3/application/shops/{shop_id}/sections/{shop_section_id}",
    "method": "delete",
    "operationId": "deleteShopSection"
  },
  {
    "path": "/v3/application/shops/{shop_id}/sections/{shop_section_id}",
    "method": "get",
    "operationId": "getShopSection"
  },
  {
    "path": "/v3/application/shops/{shop_id}/sections/{shop_section_id}",
    "method": "put",
    "operationId": "updateShopSection"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shop-sections/listings",
    "method": "get",
    "operationId": "getListingsByShopSectionId"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles",
    "method": "post",
    "operationId": "createShopShippingProfile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles",
    "method": "get",
    "operationId": "getShopShippingProfiles"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}",
    "method": "delete",
    "operationId": "deleteShopShippingProfile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}",
    "method": "get",
    "operationId": "getShopShippingProfile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}",
    "method": "put",
    "operationId": "updateShopShippingProfile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations",
    "method": "post",
    "operationId": "createShopShippingProfileDestination"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations",
    "method": "get",
    "operationId": "getShopShippingProfileDestinationsByShippingProfile"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations/{shipping_profile_destination_id}",
    "method": "delete",
    "operationId": "deleteShopShippingProfileDestination"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations/{shipping_profile_destination_id}",
    "method": "put",
    "operationId": "updateShopShippingProfileDestination"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades",
    "method": "post",
    "operationId": "createShopShippingProfileUpgrade"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades",
    "method": "get",
    "operationId": "getShopShippingProfileUpgrades"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades/{upgrade_id}",
    "method": "delete",
    "operationId": "deleteShopShippingProfileUpgrade"
  },
  {
    "path": "/v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades/{upgrade_id}",
    "method": "put",
    "operationId": "updateShopShippingProfileUpgrade"
  },
  {
    "path": "/v3/application/scopes",
    "method": "post",
    "operationId": "tokenScopes"
  },
  {
    "path": "/v3/application/shops/{shop_id}/transactions/{transaction_id}",
    "method": "get",
    "operationId": "getShopReceiptTransaction"
  },
  {
    "path": "/v3/application/shops/{shop_id}/transactions",
    "method": "get",
    "operationId": "getShopReceiptTransactionsByShop"
  },
  {
    "path": "/v3/application/user/addresses/{user_address_id}",
    "method": "delete",
    "operationId": "deleteUserAddress"
  },
  {
    "path": "/v3/application/user/addresses/{user_address_id}",
    "method": "get",
    "operationId": "getUserAddress"
  },
  {
    "path": "/v3/application/user/addresses",
    "method": "get",
    "operationId": "getUserAddresses"
  },
  {
    "path": "/v3/application/users/{user_id}",
    "method": "get",
    "operationId": "getUser"
  }
]</pre>
