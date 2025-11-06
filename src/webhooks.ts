/**
 * Webhook Support for Etsy API v3
 * Handles webhook signature verification and event parsing
 */

import { EtsyShopReceipt, EtsyListing } from './types';
import { isNode } from './utils/environment';

/**
 * Configuration for webhook handler
 */
export interface WebhookConfig {
  /**
   * Webhook secret for signature verification
   * This is provided by Etsy when you set up webhooks
   */
  secret: string;

  /**
   * Algorithm to use for signature verification (default: 'sha256')
   */
  algorithm?: 'sha256' | 'sha1';

  /**
   * Whether to verify signatures (default: true)
   * Set to false only for testing/development
   */
  verifySignatures?: boolean;
}

/**
 * Supported Etsy webhook event types
 */
export type EtsyWebhookEventType =
  | 'receipt.updated'
  | 'receipt.created'
  | 'listing.updated'
  | 'listing.created'
  | 'listing.deactivated'
  | 'shop.updated';

/**
 * Webhook event data
 */
export interface EtsyWebhookEvent {
  /**
   * Type of event
   */
  type: EtsyWebhookEventType;

  /**
   * Timestamp when the event occurred
   */
  timestamp: number;

  /**
   * Event data payload
   */
  data: EtsyShopReceipt | EtsyListing | unknown;

  /**
   * Shop ID associated with the event
   */
  shop_id?: number;

  /**
   * User ID associated with the event
   */
  user_id?: number;
}

/**
 * Event handler function type
 */
export type WebhookEventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Webhook handler class for Etsy API webhooks
 *
 * @example
 * ```typescript
 * const webhooks = new EtsyWebhookHandler({
 *   secret: process.env.WEBHOOK_SECRET
 * });
 *
 * webhooks.on('receipt.updated', async (receipt) => {
 *   console.log('Receipt updated:', receipt.receipt_id);
 *   await fulfillOrder(receipt);
 * });
 *
 * // In your Express endpoint:
 * app.post('/webhooks/etsy', (req, res) => {
 *   const signature = req.headers['x-etsy-signature'];
 *   const payload = JSON.stringify(req.body);
 *
 *   if (webhooks.verifySignature(payload, signature)) {
 *     const event = webhooks.parseEvent(payload);
 *     // Handler will be called automatically
 *     res.sendStatus(200);
 *   } else {
 *     res.sendStatus(401);
 *   }
 * });
 * ```
 */
export class EtsyWebhookHandler {
  private config: Required<WebhookConfig>;
  private handlers: Map<EtsyWebhookEventType, Set<WebhookEventHandler>>;
  private crypto: typeof import('crypto') | undefined;

  constructor(config: WebhookConfig) {
    this.config = {
      algorithm: 'sha256',
      verifySignatures: true,
      ...config
    };

    this.handlers = new Map();

    // Load crypto module for signature verification (Node.js only)
    if (isNode) {
      try {
        this.crypto = require('crypto');
      } catch {
        console.warn('crypto module not available, signature verification will not work');
      }
    }
  }

  /**
   * Verify webhook signature
   * @param payload Raw webhook payload as string
   * @param signature Signature from X-Etsy-Signature header
   * @returns true if signature is valid
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.config.verifySignatures) {
      return true;
    }

    if (!this.crypto) {
      throw new Error('Signature verification requires Node.js crypto module');
    }

    try {
      // Create HMAC with secret
      const hmac = this.crypto
        .createHmac(this.config.algorithm, this.config.secret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return this.timingSafeEqual(hmac, signature);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Parse webhook event from payload
   * @param payload Webhook payload (string or object)
   * @returns Parsed webhook event
   */
  parseEvent(payload: string | object): EtsyWebhookEvent {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    // Validate event structure
    if (!data.type || !data.data) {
      throw new Error('Invalid webhook event format');
    }

    const event: EtsyWebhookEvent = {
      type: data.type,
      timestamp: data.timestamp || Date.now(),
      data: data.data,
      shop_id: data.shop_id,
      user_id: data.user_id
    };

    // Automatically trigger handlers for this event type
    this.triggerHandlers(event);

    return event;
  }

  /**
   * Register an event handler
   * @param eventType Type of event to listen for
   * @param handler Function to call when event occurs
   */
  on<T = unknown>(
    eventType: EtsyWebhookEventType,
    handler: WebhookEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.add(handler as WebhookEventHandler);
    }
  }

  /**
   * Remove an event handler
   * @param eventType Type of event
   * @param handler Handler function to remove
   */
  off(eventType: EtsyWebhookEventType, handler: WebhookEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Remove all handlers for an event type
   * @param eventType Type of event (optional, clears all if not specified)
   */
  removeAllListeners(eventType?: EtsyWebhookEventType): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Trigger all handlers for an event
   */
  private async triggerHandlers(event: EtsyWebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Execute all handlers
    const promises = Array.from(handlers).map(handler => {
      try {
        return Promise.resolve(handler(event.data));
      } catch (error) {
        console.error(`Error in webhook handler for ${event.type}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (this.crypto?.timingSafeEqual) {
      // Use built-in timing-safe comparison if available
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) {
        return false;
      }
      return this.crypto.timingSafeEqual(bufA, bufB);
    } else {
      // Fallback to simple comparison (less secure)
      return a === b;
    }
  }

  /**
   * Get the number of registered handlers for an event type
   */
  getHandlerCount(eventType: EtsyWebhookEventType): number {
    return this.handlers.get(eventType)?.size || 0;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): EtsyWebhookEventType[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Helper function to create a webhook handler
 */
export function createWebhookHandler(config: WebhookConfig): EtsyWebhookHandler {
  return new EtsyWebhookHandler(config);
}
