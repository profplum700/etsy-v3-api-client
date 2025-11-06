# Order Fulfillment App Example

Automated order fulfillment system using webhooks.

## Features

- Webhook-based order notifications
- Automated fulfillment workflow
- Tracking number management
- Integration points for fulfillment centers
- Manual fulfillment endpoints

## Setup

```bash
npm install
```

Environment variables:
```bash
ETSY_API_KEY=your_api_key
ETSY_SHOP_ID=your_shop_id
WEBHOOK_SECRET=your_webhook_secret
```

## Endpoints

- `POST /webhooks/etsy` - Etsy webhook handler
- `POST /fulfill/:receiptId` - Manual fulfillment
- `GET /orders/pending` - Get pending orders

## Webhook Events

Handles:
- `receipt.created` - New order notification
- `receipt.paid` - Payment received

## Integration Points

Replace placeholders with actual integrations:

```typescript
// Send to your fulfillment center
await sendToFulfillmentCenter(orderData);

// Get tracking from fulfillment center
const tracking = await getTrackingFromFulfillmentCenter(receiptId);
```

## Usage

1. Start server: `npm start`
2. Configure webhook in Etsy Developer Portal
3. Orders are automatically processed
4. Tracking is added when available

## Learning Points

- Webhook security and verification
- Asynchronous order processing
- Fulfillment workflow automation
- Error handling and retries
