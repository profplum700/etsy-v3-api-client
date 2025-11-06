# Order Fulfillment Guide

This guide covers how to manage orders (receipts) and fulfill them using the Etsy v3 API client.

## Table of Contents

- [Overview](#overview)
- [Getting Orders](#getting-orders)
- [Order Details](#order-details)
- [Shipping & Tracking](#shipping--tracking)
- [Fulfillment Workflow](#fulfillment-workflow)
- [Best Practices](#best-practices)

## Overview

In Etsy's terminology:
- **Receipt**: An order containing one or more items
- **Transaction**: Individual items within a receipt
- **Shipment**: Shipping information for a receipt

## Getting Orders

### Get All Shop Receipts

```typescript
const shopId = '12345';

// Get all paid receipts
const receipts = await client.getShopReceipts(shopId, {
  was_paid: true,
  limit: 100
});

console.log(`Found ${receipts.count} paid orders`);
receipts.results.forEach(receipt => {
  console.log(`Order #${receipt.receipt_id}: ${receipt.buyer_email}`);
  console.log(`  Total: $${receipt.grandtotal.amount}`);
  console.log(`  Status: ${receipt.status}`);
});
```

### Filter by Status

```typescript
// Get open/unfulfilled orders
const openOrders = await client.getShopReceipts(shopId, {
  was_paid: true,
  was_shipped: false,
  limit: 100
});

// Get shipped orders
const shippedOrders = await client.getShopReceipts(shopId, {
  was_shipped: true,
  limit: 100
});
```

### Get Single Receipt

```typescript
const receiptId = '1234567890';

const receipt = await client.getShopReceipt(shopId, receiptId);
console.log('Order details:', {
  id: receipt.receipt_id,
  buyer: receipt.name,
  email: receipt.buyer_email,
  total: receipt.grandtotal.amount,
  items: receipt.transactions?.length || 0,
  shipped: receipt.was_shipped
});
```

## Order Details

### Get Transaction Details

```typescript
const transactions = await client.getShopReceiptTransactionsByReceipt(
  shopId,
  receiptId
);

transactions.results.forEach(tx => {
  console.log(`Item: ${tx.title}`);
  console.log(`  Quantity: ${tx.quantity}`);
  console.log(`  Price: $${tx.price.amount}`);
  console.log(`  SKU: ${tx.product_data?.sku || 'N/A'}`);
});
```

### Get Shipping Address

```typescript
const receipt = await client.getShopReceipt(shopId, receiptId);

const shipping = {
  name: receipt.name,
  address1: receipt.first_line,
  address2: receipt.second_line,
  city: receipt.city,
  state: receipt.state,
  zip: receipt.zip,
  country: receipt.country_iso
};

console.log('Ship to:', shipping);
```

## Shipping & Tracking

### Add Tracking Information

```typescript
// Add tracking to a receipt
await client.createShopReceiptShipment(shopId, receiptId, {
  tracking_code: '1Z999AA10123456784',
  carrier_name: 'ups',
  send_bcc: true // Send notification to buyer
});

console.log('Tracking information added');
```

### Supported Carriers

Common carrier names:
- `usps`
- `ups`
- `fedex`
- `dhl`
- `canadapost`
- `royal-mail`
- `other`

### Update Shipment

```typescript
const shipments = await client.getShopShipments(shopId, receiptId);
const shipmentId = shipments.results[0].receipt_shipping_id;

await client.updateShopShipment(shopId, shipmentId, {
  tracking_code: '1Z999AA10123456785', // Updated tracking
  carrier_name: 'ups'
});
```

### Mark as Shipped Without Tracking

```typescript
await client.createShopReceiptShipment(shopId, receiptId, {
  carrier_name: 'other',
  send_bcc: false
});
```

## Fulfillment Workflow

### Complete Fulfillment Example

```typescript
async function fulfillOrder(
  shopId: string,
  receiptId: string,
  trackingCode: string,
  carrier: string
) {
  try {
    // 1. Get order details
    const receipt = await client.getShopReceipt(shopId, receiptId);

    console.log(`Processing order #${receipt.receipt_id}`);
    console.log(`Customer: ${receipt.name}`);

    // 2. Get items in order
    const transactions = await client.getShopReceiptTransactionsByReceipt(
      shopId,
      receiptId
    );

    console.log(`Items to ship: ${transactions.results.length}`);

    // 3. Verify payment
    if (!receipt.was_paid) {
      throw new Error('Order not paid');
    }

    // 4. Check if already shipped
    if (receipt.was_shipped) {
      console.log('Order already shipped');
      return;
    }

    // 5. Add tracking information
    await client.createShopReceiptShipment(shopId, receiptId, {
      tracking_code: trackingCode,
      carrier_name: carrier,
      send_bcc: true // Notify customer
    });

    console.log('Order fulfilled successfully');

    return { success: true };
  } catch (error) {
    console.error('Fulfillment failed:', error);
    return { success: false, error: error.message };
  }
}

// Usage
await fulfillOrder(shopId, '1234567890', '1Z999AA10123456784', 'ups');
```

### Batch Fulfillment

```typescript
interface OrderToFulfill {
  receiptId: string;
  trackingCode: string;
  carrier: string;
}

async function batchFulfillOrders(
  shopId: string,
  orders: OrderToFulfill[]
) {
  const results = [];

  for (const order of orders) {
    const result = await fulfillOrder(
      shopId,
      order.receiptId,
      order.trackingCode,
      order.carrier
    );

    results.push({
      receiptId: order.receiptId,
      ...result
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Fulfilled: ${successful}, Failed: ${failed}`);

  return results;
}

// Usage
const orders = [
  { receiptId: '123', trackingCode: 'TRACK1', carrier: 'usps' },
  { receiptId: '456', trackingCode: 'TRACK2', carrier: 'ups' },
  { receiptId: '789', trackingCode: 'TRACK3', carrier: 'fedex' }
];

await batchFulfillOrders(shopId, orders);
```

### Webhook-Based Fulfillment

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Webhook endpoint for new orders
app.post('/webhooks/etsy/order-created', async (req, res) => {
  try {
    // Verify webhook signature (if configured)
    const signature = req.headers['x-etsy-signature'];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const { shop_id, receipt_id } = req.body;

    // Get full order details
    const receipt = await client.getShopReceipt(shop_id, receipt_id);

    // Process order (e.g., send to fulfillment center)
    await processOrder(receipt);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

function verifyWebhookSignature(payload: any, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## Best Practices

### 1. Verify Payment Status

```typescript
async function canFulfillOrder(shopId: string, receiptId: string): Promise<boolean> {
  const receipt = await client.getShopReceipt(shopId, receiptId);

  if (!receipt.was_paid) {
    console.log('Order not paid yet');
    return false;
  }

  if (receipt.was_shipped) {
    console.log('Order already shipped');
    return false;
  }

  return true;
}
```

### 2. Handle Cancellations

```typescript
async function checkForCancellations(shopId: string) {
  const receipts = await client.getShopReceipts(shopId, {
    was_canceled: true,
    limit: 100
  });

  for (const receipt of receipts.results) {
    console.log(`Order #${receipt.receipt_id} was canceled`);
    // Handle cancellation (refund, update inventory, etc.)
  }
}
```

### 3. Track Fulfillment Metrics

```typescript
async function getFulfillmentMetrics(shopId: string) {
  const [paid, shipped, open] = await Promise.all([
    client.getShopReceipts(shopId, { was_paid: true, limit: 1 }),
    client.getShopReceipts(shopId, { was_shipped: true, limit: 1 }),
    client.getShopReceipts(shopId, { was_paid: true, was_shipped: false, limit: 100 })
  ]);

  return {
    totalOrders: paid.count,
    shippedOrders: shipped.count,
    pendingOrders: open.count,
    fulfillmentRate: (shipped.count / paid.count) * 100
  };
}

const metrics = await getFulfillmentMetrics(shopId);
console.log('Fulfillment Rate:', metrics.fulfillmentRate.toFixed(2) + '%');
console.log('Pending Orders:', metrics.pendingOrders);
```

### 4. Error Handling

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';

async function safeFulfillOrder(
  shopId: string,
  receiptId: string,
  trackingInfo: any
) {
  try {
    await client.createShopReceiptShipment(shopId, receiptId, trackingInfo);
    return { success: true };
  } catch (error) {
    if (error instanceof EtsyApiError) {
      if (error.statusCode === 404) {
        return { success: false, error: 'Order not found' };
      } else if (error.statusCode === 400) {
        return { success: false, error: 'Invalid tracking information' };
      } else if (error.statusCode === 409) {
        return { success: false, error: 'Order already shipped' };
      }
    }
    return { success: false, error: error.message };
  }
}
```

### 5. Automated Fulfillment System

```typescript
class FulfillmentSystem {
  private client: EtsyClient;
  private shopId: string;

  constructor(client: EtsyClient, shopId: string) {
    this.client = client;
    this.shopId = shopId;
  }

  async processPendingOrders() {
    const orders = await this.getPendingOrders();

    for (const order of orders) {
      await this.fulfillOrder(order);
      await new Promise(r => setTimeout(r, 500)); // Rate limiting
    }
  }

  private async getPendingOrders() {
    const receipts = await this.client.getShopReceipts(this.shopId, {
      was_paid: true,
      was_shipped: false,
      limit: 100
    });

    return receipts.results;
  }

  private async fulfillOrder(receipt: any) {
    // Get tracking from your fulfillment system
    const tracking = await this.getTrackingFromFulfillmentCenter(
      receipt.receipt_id
    );

    if (tracking) {
      await this.client.createShopReceiptShipment(
        this.shopId,
        receipt.receipt_id.toString(),
        {
          tracking_code: tracking.code,
          carrier_name: tracking.carrier,
          send_bcc: true
        }
      );

      console.log(`Fulfilled order #${receipt.receipt_id}`);
    }
  }

  private async getTrackingFromFulfillmentCenter(receiptId: number) {
    // Integration with your fulfillment center
    // Return tracking information
    return null;
  }

  // Run every 15 minutes
  startAutoFulfillment(intervalMs = 15 * 60 * 1000) {
    setInterval(() => {
      this.processPendingOrders().catch(console.error);
    }, intervalMs);
  }
}

// Usage
const fulfillment = new FulfillmentSystem(client, shopId);
fulfillment.startAutoFulfillment();
```

## Next Steps

- [Shipping Profiles](./shipping-profiles.md)
- [Webhooks](./webhooks.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
