---
"@profplum700/etsy-v3-api-client": minor
---

Webhooks now handle deliveries as Etsy sends them. `verifyRequest(rawBody, headers)` checks the Standard Webhooks signature (`webhook-id`, `webhook-timestamp`, `webhook-signature`, `whsec_` secret) and rejects timestamps more than 5 minutes off. `parseEvent` accepts Etsy's `{ event_type, resource_url, shop_id, listing_id?, product_id? }` body, and the event types now include `listing.deleted` and the `inventory.*` events. The old hex `verifySignature` and the `{ type, data }` event shape still work; `verifySignature` is deprecated.
