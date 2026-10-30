# Webhooks Guide

This guide covers how to set up and handle webhooks for real-time Etsy event notifications.

## Table of Contents

- [Overview](#overview)
- [Setting Up Webhooks](#setting-up-webhooks)
- [Webhook Events](#webhook-events)
- [Handling Webhooks](#handling-webhooks)
- [Security](#security)
- [Best Practices](#best-practices)

## Overview

Webhooks allow Etsy to notify your application in real-time when events occur, such as:
- New orders placed
- Listings updated
- Items shipped
- Reviews received

Instead of polling the API for changes, webhooks push notifications to your server instantly.

## Setting Up Webhooks

1. In the [Etsy Developer Portal](https://developers.etsy.com), open **Manage your apps**, then **Go to Webhook portal** for your app.
2. Choose **+Add Endpoint**, enter your HTTPS callback URL and pick the events.
3. Copy the endpoint's signing secret (it starts with `whsec_`) into your server's environment.

Subscriptions are managed in the portal, not through the API. The portal also shows delivery history and has a **Testing** tab that sends test events.

## Webhook Events

| Event | Sent when |
|-------|-----------|
| `order.paid` | An order receives payment |
| `order.canceled` | The seller cancels an order |
| `order.shipped` | Shipping information is added to a receipt |
| `order.delivered` | An order is marked delivered |
| `listing.created` | A listing is created |
| `listing.updated` | A listing's title, description, personalization, taxonomy, images, attributes or state changes |
| `listing.deleted` | A listing is deleted |
| `inventory.created` | A product (variant) is created |
| `inventory.updated` | A product's price, readiness state, SKU or state changes |
| `inventory.deleted` | A product is deleted |
| `inventory.out_of_stock` | A product's quantity reaches 0 |

The type `EtsyWebhookEventType` also keeps `receipt.created`, `receipt.updated`, `listing.deactivated` and `shop.updated` for existing code. Etsy does not send them.

### Payload

A delivery carries no record data. It names the event and gives a `resource_url` to fetch:

```typescript
interface EtsyWebhookPayload {
  event_type: EtsyWebhookEventType;
  resource_url: string;            // getShopReceipt, getListing or getListingProduct URL
  shop_id: number | string;
  listing_id?: number | string;    // listing and inventory events
  product_id?: number | string;    // inventory events
}
```

## Handling Webhooks

`EtsyWebhookHandler` verifies the signature and calls your handlers with the payload:

```typescript
import express from 'express';
import { EtsyWebhookHandler, type EtsyWebhookPayload } from '@profplum700/etsy-v3-api-client';

const webhooks = new EtsyWebhookHandler({ secret: process.env.ETSY_WEBHOOK_SECRET! });

webhooks.on<EtsyWebhookPayload>('order.paid', async ({ resource_url }) => {
  // Fetch the receipt from resource_url with an authenticated request, then fulfil it
});

webhooks.on<EtsyWebhookPayload>('inventory.out_of_stock', async ({ listing_id, product_id }) => {
  // Mark the product sold out elsewhere
});

const app = express();

// The signature covers the exact bytes, so read the raw body
app.post('/webhooks/etsy', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  if (!webhooks.verifyRequest(rawBody, req.headers)) {
    return res.status(401).send('Unauthorized');
  }
  res.status(200).send('OK');   // acknowledge first; Etsy retries failures
  webhooks.parseEvent(rawBody); // runs the handlers for event_type
});
```

## Security

### 1. Verify Webhook Signatures

Etsy signs deliveries with [Standard Webhooks](https://www.standardwebhooks.com/) headers: `webhook-id`, `webhook-timestamp` and `webhook-signature`. `verifyRequest(rawBody, headers)` does the whole check:

1. It computes HMAC-SHA256 over `` `${webhook-id}.${webhook-timestamp}.${rawBody}` ``, keyed with the base64-decoded part of the secret after `whsec_`.
2. It base64-encodes the result and compares it, in constant time, against every `v1,<signature>` entry in `webhook-signature`. There can be several entries while the secret is rotating.
3. It rejects timestamps more than 300 seconds from now. Change this with `{ toleranceSeconds }`.

`verifySignature(payload, signature)`, the older hex HMAC of the body, is deprecated. Etsy never sends that format.

### 2. Use HTTPS

Webhooks must be delivered over HTTPS in production:

```typescript
// Development: use ngrok for testing
// ngrok http 3000

// Production: use proper SSL certificate
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('privkey.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

### 3. Validate Event Data

```typescript
function validateWebhookEvent(event: any): boolean {
  // Check required fields
  if (!event.event_type || !event.shop_id || !event.timestamp) {
    return false;
  }

  // Check timestamp is recent (within 5 minutes)
  const age = Date.now() - event.timestamp * 1000;
  if (age > 5 * 60 * 1000) {
    return false; // Too old, possible replay attack
  }

  return true;
}
```

### 4. Store Webhook Secret Securely

```bash
# .env
WEBHOOK_SECRET=your_webhook_secret_here
```

```typescript
const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  throw new Error('WEBHOOK_SECRET not configured');
}
```

## Best Practices

### 1. Respond Quickly

```typescript
app.post('/webhooks/etsy', async (req, res) => {
  // Verify and acknowledge IMMEDIATELY
  const rawBody = req.body.toString('utf8');
  if (!webhooks.verifyRequest(rawBody, req.headers)) {
    return res.status(401).send('Unauthorized');
  }

  // Return 200 ASAP
  res.status(200).send('OK');

  // Process in background
  setImmediate(() => webhooks.parseEvent(rawBody));
});
```

### 2. Handle Retries Idempotently

Etsy retries failed deliveries with the same `webhook-id` header, so key idempotency on it:

```typescript
const processedEvents = new Set<string>();

async function processWebhookEvent(event: EtsyWebhookPayload, webhookId: string) {
  // webhook-id stays the same across retries of one delivery
  const eventId = webhookId;

  // Skip if already processed
  if (processedEvents.has(eventId)) {
    console.log('Event already processed:', eventId);
    return;
  }

  try {
    // Process event
    await handleEvent(event);

    // Mark as processed
    processedEvents.add(eventId);

    // Clean old entries periodically
    if (processedEvents.size > 10000) {
      processedEvents.clear();
    }
  } catch (error) {
    console.error('Event processing error:', error);
    // Don't mark as processed so it can be retried
  }
}
```

### 3. Use Queue for Processing

For high-volume shops, use a message queue:

```typescript
import Queue from 'bull';

const webhookQueue = new Queue('etsy-webhooks', {
  redis: process.env.REDIS_URL
});

// Add to queue
app.post('/webhooks/etsy', async (req, res) => {
  const event = JSON.parse(req.body.toString());
  res.status(200).send('OK');

  await webhookQueue.add(event, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
});

// Process queue
webhookQueue.process(async (job) => {
  await processWebhookEvent(job.data);
});

webhookQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

### 4. Log Webhook Events

```typescript
async function logWebhookEvent(event: any) {
  await db.webhooks.insert({
    event_type: event.event_type,
    shop_id: event.shop_id,
    resource_url: event.resource_url,
    listing_id: event.listing_id,
    product_id: event.product_id,
    payload: event,
    processed_at: new Date()
  });
}

app.post('/webhooks/etsy', async (req, res) => {
  const event = JSON.parse(req.body.toString());
  res.status(200).send('OK');

  // Log event
  await logWebhookEvent(event);

  // Process event
  await processWebhookEvent(event);
});
```

### 5. Monitor Webhook Health

```typescript
class WebhookMonitor {
  private lastReceived: Map<string, number> = new Map();

  recordEvent(eventType: string) {
    this.lastReceived.set(eventType, Date.now());
  }

  checkHealth(): any {
    const now = Date.now();
    const alerts = [];

    // Expect at least one receipt.created per hour during business hours
    const lastOrder = this.lastReceived.get('receipt.created') || 0;
    const orderAge = now - lastOrder;

    if (orderAge > 60 * 60 * 1000) { // 1 hour
      alerts.push({
        type: 'warning',
        message: 'No orders received in last hour'
      });
    }

    return {
      healthy: alerts.length === 0,
      alerts,
      lastEvents: Object.fromEntries(this.lastReceived)
    };
  }
}

const monitor = new WebhookMonitor();

// Record events
app.post('/webhooks/etsy', async (req, res) => {
  const event = JSON.parse(req.body.toString());
  monitor.recordEvent(event.event_type);
  // ... rest of handling
});

// Health check endpoint
app.get('/webhooks/health', (req, res) => {
  res.json(monitor.checkHealth());
});
```

## Complete Example

See [Handling Webhooks](#handling-webhooks). Register one handler per event with `webhooks.on`, verify with `verifyRequest`, and dispatch with `parseEvent`.

## Next Steps

- [Order Fulfillment](./order-fulfillment.md)
- [Getting Started](./getting-started.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
