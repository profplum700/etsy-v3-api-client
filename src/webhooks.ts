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
 * Supported Etsy webhook event types.
 *
 * Etsy sends the order, listing and inventory events
 * (https://developers.etsy.com/documentation/essentials/webhooks#available-events).
 * `receipt.*`, `listing.deactivated` and `shop.updated` are kept for existing
 * handlers; Etsy does not send them.
 */
export type EtsyWebhookEventType =
  | 'order.paid'
  | 'order.canceled'
  | 'order.shipped'
  | 'order.delivered'
  | 'listing.created'
  | 'listing.updated'
  | 'listing.deleted'
  | 'inventory.created'
  | 'inventory.updated'
  | 'inventory.deleted'
  | 'inventory.out_of_stock'
  | 'receipt.updated'
  | 'receipt.created'
  | 'listing.deactivated'
  | 'shop.updated';

/**
 * Body of a webhook delivery as Etsy sends it. Fetch `resource_url` with an
 * authenticated GET for the changed receipt, listing or product.
 */
export interface EtsyWebhookPayload {
  event_type: EtsyWebhookEventType;
  resource_url: string;
  shop_id: number | string;
  /** Listing and inventory events */
  listing_id?: number | string;
  /** Inventory events */
  product_id?: number | string;
}

/**
 * Headers Etsy signs each delivery with (Standard Webhooks)
 */
export interface EtsyWebhookHeaders {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
}

/**
 * Options for {@link EtsyWebhookHandler.verifyRequest}
 */
export interface VerifyRequestOptions {
  /** Largest accepted clock difference in seconds (default: 300) */
  toleranceSeconds?: number;
  /** Current time in unix seconds, for tests */
  now?: number;
}

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
   * Event data payload. For deliveries from Etsy this is the
   * {@link EtsyWebhookPayload} itself.
   */
  data: EtsyWebhookPayload | EtsyShopReceipt | EtsyListing | unknown;

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
 * webhooks.on<EtsyWebhookPayload>('order.paid', async (payload) => {
 *   const receipt = await client.request(payload.resource_url);
 *   await fulfillOrder(receipt);
 * });
 *
 * // In your Express endpoint, with the raw body (express.raw()):
 * app.post('/webhooks/etsy', (req, res) => {
 *   const rawBody = req.body.toString('utf8');
 *   if (!webhooks.verifyRequest(rawBody, req.headers)) {
 *     return res.sendStatus(401);
 *   }
 *   webhooks.parseEvent(rawBody); // calls the handlers
 *   res.sendStatus(200);
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
   * Verify a delivery from Etsy: HMAC-SHA256 over `id.timestamp.body` with the
   * `whsec_` signing secret, checked against every entry of `webhook-signature`,
   * and a timestamp within the tolerance.
   * See https://developers.etsy.com/documentation/essentials/webhooks#verifying-webhook-signatures
   * @param rawBody Request body exactly as received, before JSON parsing
   * @param headers Request headers (names in lower case, as Node gives them)
   * @returns true if the delivery is authentic and fresh
   */
  verifyRequest(
    rawBody: string,
    headers: Partial<EtsyWebhookHeaders> | Record<string, string | string[] | undefined>,
    options: VerifyRequestOptions = {}
  ): boolean {
    if (!this.config.verifySignatures) {
      return true;
    }

    if (!this.crypto) {
      throw new Error('Signature verification requires Node.js crypto module');
    }

    const header = (name: keyof EtsyWebhookHeaders): string | undefined => {
      const value = (headers as Record<string, string | string[] | undefined>)[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const id = header('webhook-id');
    const timestamp = header('webhook-timestamp');
    const signatures = header('webhook-signature');
    if (!id || !timestamp || !signatures) {
      return false;
    }

    const sentAt = Number(timestamp);
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > (options.toleranceSeconds ?? 300)) {
      return false;
    }

    const secret = this.config.secret.startsWith('whsec_')
      ? Buffer.from(this.config.secret.slice('whsec_'.length), 'base64')
      : Buffer.from(this.config.secret, 'utf8');
    const expected = this.crypto
      .createHmac('sha256', secret)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest('base64');

    // Entries look like "v1,<base64>", space-separated when the secret is rotating.
    return signatures
      .split(' ')
      .map((entry) => entry.slice(entry.indexOf(',') + 1))
      .some((signature) => this.timingSafeEqual(expected, signature));
  }

  /**
   * Verify a hex HMAC of the payload.
   * @deprecated Etsy signs deliveries with Standard Webhooks headers; use {@link verifyRequest}.
   * @param payload Raw webhook payload as string
   * @param signature Hex HMAC of the payload
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    if (typeof payload === 'string') {
      try {
        data = JSON.parse(payload);
      } catch {
        throw new Error('Invalid webhook payload: malformed JSON');
      }
    } else {
      data = payload;
    }

    // Etsy's delivery body: { event_type, resource_url, shop_id, ... }
    if (typeof data?.event_type === 'string' && typeof data.resource_url === 'string') {
      const event: EtsyWebhookEvent = {
        type: data.event_type,
        timestamp: Date.now(),
        data: data as EtsyWebhookPayload,
        shop_id: Number(data.shop_id)
      };
      this.triggerHandlers(event);
      return event;
    }

    // Validate event structure
    if (!data?.type || !data.data) {
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
