/**
 * Webhook Security utilities for HMAC request signing and verification
 * Provides secure webhook payload signing for outgoing requests
 */

import { isNode } from '../utils/environment';

/**
 * Configuration for webhook security
 */
export interface WebhookSecurityConfig {
  /**
   * Secret key for HMAC signing
   */
  secret: string;

  /**
   * HMAC algorithm to use
   * @default 'sha256'
   */
  algorithm?: 'sha256' | 'sha1' | 'sha512';
}

/**
 * Webhook Security class for HMAC request signing and verification
 *
 * Provides cryptographic signing and verification of webhook payloads
 * using HMAC (Hash-based Message Authentication Code).
 *
 * @example
 * ```typescript
 * const security = new WebhookSecurity({
 *   secret: process.env.WEBHOOK_SECRET,
 *   algorithm: 'sha256'
 * });
 *
 * // Sign outgoing webhook request
 * const payload = JSON.stringify({ event: 'order.created', data: {...} });
 * const signature = security.signRequest(payload);
 *
 * // Add signature to request headers
 * fetch('https://example.com/webhook', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Webhook-Signature': signature
 *   },
 *   body: payload
 * });
 *
 * // Verify incoming webhook request
 * const isValid = security.verifySignature(
 *   incomingPayload,
 *   request.headers['x-webhook-signature']
 * );
 * ```
 */
export class WebhookSecurity {
  private secret: string;
  private algorithm: 'sha256' | 'sha1' | 'sha512';
  private crypto: typeof import('crypto') | undefined;

  constructor(config: WebhookSecurityConfig) {
    this.secret = config.secret;
    this.algorithm = config.algorithm || 'sha256';

    if (!this.secret) {
      throw new Error('Webhook secret is required');
    }

    // Load crypto module (Node.js only)
    if (isNode) {
      try {
        this.crypto = require('crypto');
      } catch {
        throw new Error('crypto module not available, webhook security requires Node.js');
      }
    } else {
      throw new Error('WebhookSecurity is only available in Node.js environments');
    }
  }

  /**
   * Sign a webhook request payload using HMAC
   *
   * @param payload - Request payload (string or object)
   * @param encoding - Output encoding ('hex' or 'base64')
   * @returns HMAC signature
   */
  signRequest(payload: string | object, encoding: 'hex' | 'base64' = 'hex'): string {
    if (!this.crypto) {
      throw new Error('Crypto module not available');
    }

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const hmac = this.crypto
      .createHmac(this.algorithm, this.secret)
      .update(data)
      .digest(encoding);

    return hmac;
  }

  /**
   * Verify webhook signature using timing-safe comparison
   *
   * @param payload - Request payload (string or object)
   * @param signature - Signature to verify
   * @param encoding - Signature encoding ('hex' or 'base64')
   * @returns true if signature is valid
   */
  verifySignature(
    payload: string | object,
    signature: string,
    encoding: 'hex' | 'base64' = 'hex'
  ): boolean {
    if (!this.crypto) {
      throw new Error('Crypto module not available');
    }

    try {
      const expectedSignature = this.signRequest(payload, encoding);

      // Use timing-safe comparison to prevent timing attacks
      return this.timingSafeEqual(expectedSignature, signature);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a webhook signature with timestamp
   * This includes a timestamp to prevent replay attacks
   *
   * @param payload - Request payload (string or object)
   * @param timestamp - Unix timestamp in seconds (default: current time)
   * @param encoding - Output encoding ('hex' or 'base64')
   * @returns Signature object with timestamp and signature
   */
  signRequestWithTimestamp(
    payload: string | object,
    timestamp?: number,
    encoding: 'hex' | 'base64' = 'hex'
  ): { timestamp: number; signature: string } {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Combine timestamp and payload for signing
    const signedPayload = `${ts}.${data}`;
    const signature = this.signRequest(signedPayload, encoding);

    return {
      timestamp: ts,
      signature
    };
  }

  /**
   * Verify webhook signature with timestamp
   *
   * @param payload - Request payload (string or object)
   * @param signature - Signature to verify
   * @param timestamp - Timestamp from request
   * @param maxAge - Maximum age of request in seconds (default: 300 = 5 minutes)
   * @param encoding - Signature encoding ('hex' or 'base64')
   * @returns true if signature is valid and timestamp is within acceptable range
   */
  verifySignatureWithTimestamp(
    payload: string | object,
    signature: string,
    timestamp: number,
    maxAge: number = 300,
    encoding: 'hex' | 'base64' = 'hex'
  ): boolean {
    // Check if timestamp is within acceptable range
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;

    if (age < 0) {
      // Timestamp is in the future
      console.warn('Webhook timestamp is in the future');
      return false;
    }

    if (age > maxAge) {
      // Request is too old
      console.warn(`Webhook request is too old: ${age} seconds`);
      return false;
    }

    // Verify signature
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${timestamp}.${data}`;

    return this.verifySignature(signedPayload, signature, encoding);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   *
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (!this.crypto?.timingSafeEqual) {
      // Fallback to simple comparison (less secure)
      console.warn('crypto.timingSafeEqual not available, using simple comparison');
      return a === b;
    }

    // Use built-in timing-safe comparison
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      return false;
    }

    return this.crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Get the algorithm being used
   */
  getAlgorithm(): string {
    return this.algorithm;
  }

  /**
   * Update the secret (useful for secret rotation)
   *
   * @param newSecret - New secret key
   */
  updateSecret(newSecret: string): void {
    if (!newSecret) {
      throw new Error('Secret cannot be empty');
    }
    this.secret = newSecret;
  }
}

/**
 * Helper function to create a WebhookSecurity instance
 *
 * @param secret - Secret key for HMAC signing
 * @param algorithm - HMAC algorithm (default: 'sha256')
 * @returns WebhookSecurity instance
 */
export function createWebhookSecurity(
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512' = 'sha256'
): WebhookSecurity {
  return new WebhookSecurity({ secret, algorithm });
}
