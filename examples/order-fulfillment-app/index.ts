/**
 * Order Fulfillment App Example
 *
 * Demonstrates:
 * - Webhook-based order processing
 * - Automated fulfillment workflow
 * - Tracking number management
 * - Email notifications
 */

import express from 'express';
import crypto from 'crypto';
import { EtsyClient, FileTokenStorage } from '@profplum700/etsy-v3-api-client';

interface OrderItem {
  listingId: string;
  title: string;
  quantity: number;
  sku: string;
}

class OrderFulfillmentApp {
  private app: express.Application;
  private client: EtsyClient;
  private shopId: string;
  private webhookSecret: string;

  constructor(shopId: string, webhookSecret: string) {
    this.app = express();
    this.shopId = shopId;
    this.webhookSecret = webhookSecret;

    const storage = new FileTokenStorage('./tokens.json');
    this.client = new EtsyClient(
      {
        apiKey: process.env.ETSY_API_KEY!,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['transactions_r', 'transactions_w', 'shops_r']
      },
      storage
    );

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use('/webhooks', express.raw({ type: 'application/json' }));
    this.app.use(express.json());

    // Webhook endpoint
    this.app.post('/webhooks/etsy', async (req, res) => {
      try {
        const signature = req.headers['x-etsy-signature'] as string;

        if (!this.verifyWebhookSignature(req.body, signature)) {
          return res.status(401).send('Unauthorized');
        }

        const event = JSON.parse(req.body.toString());
        res.status(200).send('OK');

        // Process asynchronously
        setImmediate(() => this.handleWebhook(event));
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
      }
    });

    // Manual fulfillment endpoint
    this.app.post('/fulfill/:receiptId', async (req, res) => {
      try {
        const { receiptId } = req.params;
        const { trackingCode, carrier } = req.body;

        await this.fulfillOrder(receiptId, trackingCode, carrier);

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get pending orders
    this.app.get('/orders/pending', async (req, res) => {
      try {
        const orders = await this.getPendingOrders();
        res.json(orders);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  private verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  private async handleWebhook(event: any): Promise<void> {
    console.log(`Webhook received: ${event.event_type}`);

    switch (event.event_type) {
      case 'receipt.created':
        await this.handleNewOrder(event);
        break;
      case 'receipt.paid':
        await this.handleOrderPaid(event);
        break;
      default:
        console.log('Unhandled event type');
    }
  }

  private async handleNewOrder(event: any): Promise<void> {
    const { receipt_id } = event;

    console.log(`New order received: #${receipt_id}`);

    const receipt = await this.client.getShopReceipt(
      this.shopId,
      receipt_id.toString()
    );

    // Get order items
    const transactions = await this.client.getShopReceiptTransactionsByReceipt(
      this.shopId,
      receipt_id.toString()
    );

    const items: OrderItem[] = transactions.results.map((tx) => ({
      listingId: tx.listing_id.toString(),
      title: tx.title,
      quantity: tx.quantity,
      sku: tx.product_data?.sku || ''
    }));

    // Send to fulfillment system (placeholder)
    await this.sendToFulfillmentCenter({
      receiptId: receipt_id,
      customerName: receipt.name,
      address: {
        line1: receipt.first_line,
        line2: receipt.second_line,
        city: receipt.city,
        state: receipt.state,
        zip: receipt.zip,
        country: receipt.country_iso
      },
      items
    });

    console.log(`Order #${receipt_id} sent to fulfillment`);
  }

  private async handleOrderPaid(event: any): Promise<void> {
    const { receipt_id } = event;

    console.log(`Order paid: #${receipt_id}`);

    // Trigger fulfillment process
    await this.processFulfillment(receipt_id.toString());
  }

  private async processFulfillment(receiptId: string): Promise<void> {
    // Check if order is ready to fulfill
    const receipt = await this.client.getShopReceipt(this.shopId, receiptId);

    if (!receipt.was_paid) {
      console.log('Order not paid yet');
      return;
    }

    if (receipt.was_shipped) {
      console.log('Order already shipped');
      return;
    }

    // Get tracking from fulfillment center (placeholder)
    const tracking = await this.getTrackingFromFulfillmentCenter(receiptId);

    if (tracking) {
      await this.fulfillOrder(receiptId, tracking.code, tracking.carrier);
    }
  }

  private async fulfillOrder(
    receiptId: string,
    trackingCode: string,
    carrier: string
  ): Promise<void> {
    console.log(`Fulfilling order #${receiptId}`);

    await this.client.createShopReceiptShipment(this.shopId, receiptId, {
      tracking_code: trackingCode,
      carrier_name: carrier,
      send_bcc: true // Notify customer
    });

    console.log(`Order #${receiptId} fulfilled with tracking: ${trackingCode}`);
  }

  private async getPendingOrders(): Promise<any[]> {
    const receipts = await this.client.getShopReceipts(this.shopId, {
      was_paid: true,
      was_shipped: false,
      limit: 100
    });

    return receipts.results;
  }

  private async sendToFulfillmentCenter(orderData: any): Promise<void> {
    // Placeholder - integrate with your fulfillment center API
    console.log('Sending to fulfillment center:', orderData);
  }

  private async getTrackingFromFulfillmentCenter(
    receiptId: string
  ): Promise<{ code: string; carrier: string } | null> {
    // Placeholder - integrate with your fulfillment center API
    return null;
  }

  start(port: number = 3000): void {
    this.app.listen(port, () => {
      console.log(`Order fulfillment app running on port ${port}`);
      console.log(`Webhook endpoint: http://localhost:${port}/webhooks/etsy`);
    });
  }
}

// Example usage
if (require.main === module) {
  const shopId = process.env.ETSY_SHOP_ID!;
  const webhookSecret = process.env.WEBHOOK_SECRET!;

  const app = new OrderFulfillmentApp(shopId, webhookSecret);
  app.start();
}

export { OrderFulfillmentApp };
