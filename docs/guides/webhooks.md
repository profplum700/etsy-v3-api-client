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

### 1. Configure Endpoint in Etsy

1. Go to [Etsy Developer Portal](https://www.etsy.com/developers)
2. Select your app
3. Navigate to "Webhooks" section
4. Add your webhook URL: `https://yourdomain.com/webhooks/etsy`

**Important**: The endpoint must use HTTPS in production.

### 2. Subscribe to Events

Currently, webhook subscriptions are managed through the Etsy Developer Portal, not the API.

Select which events you want to receive:
- Shop events (receipt.created, receipt.updated, etc.)
- Listing events (listing.created, listing.updated, etc.)
- Transaction events

## Webhook Events

### Common Event Types

| Event | Description |
|-------|-------------|
| `receipt.created` | New order placed |
| `receipt.updated` | Order details changed |
| `receipt.paid` | Order payment received |
| `listing.created` | New listing created |
| `listing.updated` | Listing details changed |
| `listing.deactivated` | Listing deactivated |
| `transaction.created` | New transaction in an order |

### Event Payload Structure

```typescript
interface EtsyWebhookEvent {
  event_type: string;
  shop_id: number;
  listing_id?: number;
  receipt_id?: number;
  transaction_id?: number;
  user_id?: number;
  timestamp: number;
  data: any; // Event-specific data
}
```

## Handling Webhooks

### Express Server Example

```typescript
import express from 'express';
import crypto from 'crypto';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const app = express();

// Important: Use raw body for signature verification
app.use('/webhooks/etsy', express.raw({ type: 'application/json' }));

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['transactions_r', 'listings_r']
});

app.post('/webhooks/etsy', async (req, res) => {
  try {
    // 1. Verify signature
    const signature = req.headers['x-etsy-signature'] as string;
    const isValid = verifyWebhookSignature(
      req.body,
      signature,
      process.env.WEBHOOK_SECRET!
    );

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }

    // 2. Parse event
    const event = JSON.parse(req.body.toString());

    console.log(`Received event: ${event.event_type}`);

    // 3. Acknowledge receipt immediately
    res.status(200).send('OK');

    // 4. Process event asynchronously
    processWebhookEvent(event).catch(console.error);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function processWebhookEvent(event: any) {
  switch (event.event_type) {
    case 'receipt.created':
      await handleNewOrder(event);
      break;

    case 'receipt.paid':
      await handleOrderPaid(event);
      break;

    case 'listing.updated':
      await handleListingUpdated(event);
      break;

    default:
      console.log(`Unhandled event type: ${event.event_type}`);
  }
}

async function handleNewOrder(event: any) {
  const { shop_id, receipt_id } = event;

  console.log(`New order #${receipt_id} in shop ${shop_id}`);

  // Fetch full order details
  const receipt = await client.getShopReceipt(
    shop_id.toString(),
    receipt_id.toString()
  );

  // Process order (send notification, update database, etc.)
  console.log(`Order from: ${receipt.buyer_email}`);
  console.log(`Total: $${receipt.grandtotal.amount}`);

  // Send to fulfillment system
  await sendToFulfillment(receipt);
}

async function handleOrderPaid(event: any) {
  const { shop_id, receipt_id } = event;

  console.log(`Order #${receipt_id} paid`);

  // Trigger fulfillment process
  await startFulfillment(shop_id, receipt_id);
}

async function handleListingUpdated(event: any) {
  const { listing_id } = event;

  console.log(`Listing ${listing_id} updated`);

  // Sync with your database
  const listing = await client.getListing(listing_id.toString());
  await updateLocalDatabase(listing);
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Event Handler Pattern

```typescript
class WebhookHandler {
  private handlers: Map<string, Function[]> = new Map();

  on(eventType: string, handler: Function) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async handle(event: any) {
    const handlers = this.handlers.get(event.event_type) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Handler error for ${event.event_type}:`, error);
      }
    }
  }
}

// Usage
const webhooks = new WebhookHandler();

webhooks.on('receipt.created', async (event) => {
  console.log('New order:', event.receipt_id);
  // Handle new order
});

webhooks.on('receipt.paid', async (event) => {
  console.log('Order paid:', event.receipt_id);
  // Start fulfillment
});

webhooks.on('listing.updated', async (event) => {
  console.log('Listing updated:', event.listing_id);
  // Sync inventory
});

// In your endpoint
app.post('/webhooks/etsy', async (req, res) => {
  const event = JSON.parse(req.body.toString());
  res.status(200).send('OK');

  await webhooks.handle(event);
});
```

## Security

### 1. Verify Webhook Signatures

**Always** verify webhook signatures to ensure requests come from Etsy:

```typescript
function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');

  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

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
  const signature = req.headers['x-etsy-signature'] as string;

  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Unauthorized');
  }

  // Return 200 ASAP
  res.status(200).send('OK');

  // Process in background
  const event = JSON.parse(req.body.toString());
  setImmediate(() => {
    processWebhookEvent(event).catch(console.error);
  });
});
```

### 2. Handle Retries Idempotently

Etsy may send the same webhook multiple times. Make your handlers idempotent:

```typescript
const processedEvents = new Set<string>();

async function processWebhookEvent(event: any) {
  // Create unique ID for this event
  const eventId = `${event.event_type}-${event.receipt_id}-${event.timestamp}`;

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
    receipt_id: event.receipt_id,
    listing_id: event.listing_id,
    timestamp: event.timestamp,
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

```typescript
import express from 'express';
import crypto from 'crypto';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

class EtsyWebhookServer {
  private app: express.Application;
  private client: EtsyClient;
  private secret: string;
  private handlers: Map<string, Function[]>;

  constructor(client: EtsyClient, secret: string) {
    this.app = express();
    this.client = client;
    this.secret = secret;
    this.handlers = new Map();

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use('/webhooks', express.raw({ type: 'application/json' }));

    this.app.post('/webhooks/etsy', async (req, res) => {
      try {
        // Verify signature
        const signature = req.headers['x-etsy-signature'] as string;
        if (!this.verifySignature(req.body, signature)) {
          return res.status(401).send('Unauthorized');
        }

        // Parse and validate
        const event = JSON.parse(req.body.toString());
        if (!this.validateEvent(event)) {
          return res.status(400).send('Invalid event');
        }

        // Acknowledge
        res.status(200).send('OK');

        // Process asynchronously
        setImmediate(() => {
          this.processEvent(event).catch(console.error);
        });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
      }
    });
  }

  private verifySignature(payload: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  private validateEvent(event: any): boolean {
    return !!(event.event_type && event.shop_id && event.timestamp);
  }

  private async processEvent(event: any) {
    const handlers = this.handlers.get(event.event_type) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Handler error:`, error);
      }
    }
  }

  on(eventType: string, handler: Function) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    return this;
  }

  listen(port: number) {
    this.app.listen(port, () => {
      console.log(`Webhook server listening on port ${port}`);
    });
  }
}

// Usage
const client = new EtsyClient(config);
const server = new EtsyWebhookServer(client, process.env.WEBHOOK_SECRET!);

server
  .on('receipt.created', async (event) => {
    console.log('New order:', event.receipt_id);
  })
  .on('receipt.paid', async (event) => {
    console.log('Order paid:', event.receipt_id);
  })
  .listen(3000);
```

## Next Steps

- [Order Fulfillment](./order-fulfillment.md)
- [Getting Started](./getting-started.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
