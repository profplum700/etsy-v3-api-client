---
"@profplum700/etsy-v3-api-client": patch
---

API errors thrown by `EtsyClient` now carry the endpoint, so `EtsyApiError.suggestions` can name the right scopes. A 403 from `createReceiptShipment` now also explains Etsy's Preferred Partner restriction, which reaches Thailand on 7 December 2026 for new personal keys and new sellers on commercial applications (etsy/open-api#1820). The docs for `createReceiptShipment` and the receipt address fields say the same, and the order fulfillment guide now calls the method by its real name.
