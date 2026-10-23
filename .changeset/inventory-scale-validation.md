---
"@profplum700/etsy-v3-api-client": minor
---

Add an `enableScaleValidation` option to `updateListingInventory`, sent as Etsy's temporary `enable_scale_validation` query parameter. Etsy makes scale validation mandatory on 1 January 2027; opting in now surfaces payloads whose scaled properties lack a valid, consistent `scale_id`.
