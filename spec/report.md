# Etsy specification change report

5 differences. All require review; categories are advisory.

## changed

<pre>{
  "pointer": "/paths/~1v3~1application~1listings~1{listing_id}~1inventory/get/description",
  "category": "prose",
  "operation": "getListingInventory",
  "sdkMethod": "getListingInventory"
}</pre>

Before:
<pre>"&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;span class=\"wt-badge wt-badge--notificationPrimary wt-bg-slime-tint wt-mr-xs-2\"&gt;General Release&lt;/span&gt;&lt;a class=\"wt-text-link\" href=\"https://github.com/etsy/open-api/discussions\" target=\"_blank\" rel=\"noopener noreferrer\"&gt;Report bug&lt;/a&gt;&lt;/div&gt;&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;p class=\"wt-text-body-01 banner-text\"&gt;This endpoint is ready for production use.&lt;/p&gt;&lt;/div&gt;\n\nRetrieves the inventory record for a listing. Listings you did not edit using the Etsy.com inventory tools have no inventory records. This endpoint returns SKU data if you are the owner of the inventory records being fetched."</pre>

After:
<pre>"&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;span class=\"wt-badge wt-badge--notificationPrimary wt-bg-slime-tint wt-mr-xs-2\"&gt;General Release&lt;/span&gt;&lt;a class=\"wt-text-link\" href=\"https://github.com/etsy/open-api/discussions\" target=\"_blank\" rel=\"noopener noreferrer\"&gt;Report bug&lt;/a&gt;&lt;/div&gt;&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;p class=\"wt-text-body-01 banner-text\"&gt;This endpoint is ready for production use.&lt;/p&gt;&lt;/div&gt;\n\nRetrieves the inventory record for a listing. Listings you did not edit using the Etsy.com inventory tools have no inventory records. Only the owner of the listing may retrieve its inventory record."</pre>

## added

<pre>{
  "pointer": "/paths/~1v3~1application~1listings~1{listing_id}~1inventory/get/responses/403",
  "category": "structural",
  "operation": "getListingInventory",
  "sdkMethod": "getListingInventory"
}</pre>

Before:
<pre>null</pre>

After:
<pre>{
  "description": "The request attempted to perform an operation it is not allowed to. See the error message for details.",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorSchema"
      }
    }
  }
}</pre>

## removed

<pre>{
  "pointer": "/paths/~1v3~1application~1listings~1{listing_id}~1products~1{product_id}~1offerings~1{product_offering_id}/get",
  "category": "structural",
  "operation": "getListingOffering",
  "sdkMethod": null
}</pre>

Before:
<pre>{
  "operationId": "getListingOffering",
  "description": "&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;span class=\"wt-badge wt-badge--notificationPrimary wt-bg-slime-tint wt-mr-xs-2\"&gt;General Release&lt;/span&gt;&lt;a class=\"wt-text-link\" href=\"https://github.com/etsy/open-api/discussions\" target=\"_blank\" rel=\"noopener noreferrer\"&gt;Report bug&lt;/a&gt;&lt;/div&gt;&lt;div class=\"wt-display-flex-xs wt-align-items-center wt-mt-xs-2 wt-mb-xs-3\"&gt;&lt;p class=\"wt-text-body-01 banner-text\"&gt;This endpoint is ready for production use.&lt;/p&gt;&lt;/div&gt;\n\nGet an Offering for a Listing",
  "tags": [
    "ShopListing Offering"
  ],
  "parameters": [
    {
      "name": "listing_id",
      "in": "path",
      "description": "",
      "required": true,
      "schema": {
        "type": "integer",
        "format": "int64",
        "minimum": 1
      }
    },
    {
      "name": "product_id",
      "in": "path",
      "description": "",
      "required": true,
      "schema": {
        "type": "integer",
        "format": "int64",
        "minimum": 1
      }
    },
    {
      "name": "product_offering_id",
      "in": "path",
      "description": "",
      "required": true,
      "schema": {
        "type": "integer",
        "format": "int64",
        "minimum": 1
      }
    },
    {
      "name": "legacy",
      "in": "query",
      "description": "This parameter is needed to enable new parameters and response values related to processing profiles.",
      "required": false,
      "schema": {
        "type": "boolean",
        "description": "This parameter is needed to enable new parameters and response values related to processing profiles."
      }
    }
  ],
  "responses": {
    "200": {
      "description": "A single ListingInventoryProductOffering",
      "content": {
        "application/json": {
          "schema": {
            "$ref": "#/components/schemas/ListingInventoryProductOffering"
          }
        }
      }
    },
    "400": {
      "description": "There was a problem with the request data. See the error message for details.",
      "content": {
        "application/json": {
          "schema": {
            "$ref": "#/components/schemas/ErrorSchema"
          }
        }
      }
    },
    "404": {
      "description": "A resource could not be found. See the error message for details.",
      "content": {
        "application/json": {
          "schema": {
            "$ref": "#/components/schemas/ErrorSchema"
          }
        }
      }
    },
    "500": {
      "description": "The server encountered an internal error. See the error message for details.",
      "content": {
        "application/json": {
          "schema": {
            "$ref": "#/components/schemas/ErrorSchema"
          }
        }
      }
    }
  }
}</pre>

After:
<pre>null</pre>

## changed

<pre>{
  "pointer": "/tags",
  "category": "structural",
  "operation": null,
  "sdkMethod": null
}</pre>

Before:
<pre>[
  {
    "name": "User"
  },
  {
    "name": "UserAddress"
  },
  {
    "name": "Shop Receipt Transactions"
  },
  {
    "name": "Other"
  },
  {
    "name": "Shop"
  },
  {
    "name": "Shop ShippingProfile"
  },
  {
    "name": "Shop Section"
  },
  {
    "name": "ShopListing"
  },
  {
    "name": "Shop ProcessingProfiles"
  },
  {
    "name": "Shop ProductionPartner"
  },
  {
    "name": "Shop Return Policy"
  },
  {
    "name": "Shop HolidayPreferences"
  },
  {
    "name": "Shop Economic Operators",
    "description": "Economic operators are used to identify the manufacturer and EU responsible person records that the EU General Product Safety Regulation (GPSR) asks sellers to attach to the products they sell to EU buyers. Create them with these endpoints, then reference them from [listings](/documentation/reference#tag/ShopListing) through the `gpsr_*` fields on [createDraftListing](/documentation/reference#operation/createDraftListing) and [updateListing](/documentation/reference#operation/updateListing). See the [GPSR Economic Operators Tutorial](/documentation/tutorials/gpsr-economic-operators) for eligibility, the enforcement timeline, validation rules, and examples."
  },
  {
    "name": "SellerTaxonomy"
  },
  {
    "name": "Review"
  },
  {
    "name": "Shop Receipt"
  },
  {
    "name": "Payment"
  },
  {
    "name": "Ledger Entry"
  },
  {
    "name": "ShopListing Video"
  },
  {
    "name": "ShopListing VariationImage"
  },
  {
    "name": "ShopListing Translation"
  },
  {
    "name": "ShopListing Personalization"
  },
  {
    "name": "ShopListing Inventory"
  },
  {
    "name": "ShopListing Offering"
  },
  {
    "name": "ShopListing Product"
  },
  {
    "name": "ShopListing Image"
  },
  {
    "name": "ShopListing File"
  },
  {
    "name": "BuyerTaxonomy"
  }
]</pre>

After:
<pre>[
  {
    "name": "User"
  },
  {
    "name": "UserAddress"
  },
  {
    "name": "Shop Receipt Transactions"
  },
  {
    "name": "Other"
  },
  {
    "name": "Shop"
  },
  {
    "name": "Shop ShippingProfile"
  },
  {
    "name": "Shop Section"
  },
  {
    "name": "ShopListing"
  },
  {
    "name": "Shop ProcessingProfiles"
  },
  {
    "name": "Shop ProductionPartner"
  },
  {
    "name": "Shop Return Policy"
  },
  {
    "name": "Shop HolidayPreferences"
  },
  {
    "name": "Shop Economic Operators",
    "description": "Economic operators are used to identify the manufacturer and EU responsible person records that the EU General Product Safety Regulation (GPSR) asks sellers to attach to the products they sell to EU buyers. Create them with these endpoints, then reference them from [listings](/documentation/reference#tag/ShopListing) through the `gpsr_*` fields on [createDraftListing](/documentation/reference#operation/createDraftListing) and [updateListing](/documentation/reference#operation/updateListing). See the [GPSR Economic Operators Tutorial](/documentation/tutorials/gpsr-economic-operators) for eligibility, the enforcement timeline, validation rules, and examples."
  },
  {
    "name": "SellerTaxonomy"
  },
  {
    "name": "Review"
  },
  {
    "name": "Shop Receipt"
  },
  {
    "name": "Payment"
  },
  {
    "name": "Ledger Entry"
  },
  {
    "name": "ShopListing Video"
  },
  {
    "name": "ShopListing VariationImage"
  },
  {
    "name": "ShopListing Translation"
  },
  {
    "name": "ShopListing Personalization"
  },
  {
    "name": "ShopListing Inventory"
  },
  {
    "name": "ShopListing Product"
  },
  {
    "name": "ShopListing Image"
  },
  {
    "name": "ShopListing File"
  },
  {
    "name": "BuyerTaxonomy"
  }
]</pre>

## changed

<pre>{
  "pointer": "/x-tagGroups/0/tags",
  "category": "structural",
  "operation": null,
  "sdkMethod": null
}</pre>

Before:
<pre>[
  "BuyerTaxonomy",
  "SellerTaxonomy",
  "ShopListing",
  "ShopListing File",
  "ShopListing Image",
  "ShopListing Inventory",
  "ShopListing Offering",
  "ShopListing Personalization",
  "ShopListing Product",
  "ShopListing Translation",
  "ShopListing VariationImage",
  "ShopListing Video"
]</pre>

After:
<pre>[
  "BuyerTaxonomy",
  "SellerTaxonomy",
  "ShopListing",
  "ShopListing File",
  "ShopListing Image",
  "ShopListing Inventory",
  "ShopListing Personalization",
  "ShopListing Product",
  "ShopListing Translation",
  "ShopListing VariationImage",
  "ShopListing Video"
]</pre>

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
    "path": "/v3/application/shops/{shop_id}/economic-operators",
    "method": "post",
    "operationId": "createShopEconomicOperator"
  },
  {
    "path": "/v3/application/shops/{shop_id}/economic-operators",
    "method": "get",
    "operationId": "getShopEconomicOperators"
  },
  {
    "path": "/v3/application/shops/{shop_id}/economic-operators/{economic_operator_id}",
    "method": "get",
    "operationId": "getShopEconomicOperator"
  },
  {
    "path": "/v3/application/shops/{shop_id}/economic-operators/{economic_operator_id}",
    "method": "patch",
    "operationId": "updateShopEconomicOperator"
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
