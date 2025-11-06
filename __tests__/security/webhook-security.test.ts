/**
 * Tests for WebhookSecurity (Phase 5)
 */

import { WebhookSecurity, createWebhookSecurity } from '../../src/security/webhook-security';
import * as crypto from 'crypto';

describe('WebhookSecurity', () => {
  const secret = 'test-webhook-secret';

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const security = new WebhookSecurity({ secret });

      expect(security).toBeInstanceOf(WebhookSecurity);
      expect(security.getAlgorithm()).toBe('sha256');
    });

    it('should support custom algorithm', () => {
      const security = new WebhookSecurity({
        secret,
        algorithm: 'sha512'
      });

      expect(security.getAlgorithm()).toBe('sha512');
    });

    it('should throw error for empty secret', () => {
      expect(() => {
        new WebhookSecurity({ secret: '' });
      }).toThrow('Webhook secret is required');
    });
  });

  describe('signRequest', () => {
    it('should sign string payload', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const signature = security.signRequest(payload);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should sign object payload', () => {
      const security = new WebhookSecurity({ secret });
      const payload = { event: 'order.created', data: { id: 123 } };

      const signature = security.signRequest(payload);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
    });

    it('should produce consistent signatures for same payload', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const signature1 = security.signRequest(payload);
      const signature2 = security.signRequest(payload);

      expect(signature1).toBe(signature2);
    });

    it('should produce different signatures for different payloads', () => {
      const security = new WebhookSecurity({ secret });

      const signature1 = security.signRequest('payload 1');
      const signature2 = security.signRequest('payload 2');

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures with different secrets', () => {
      const security1 = new WebhookSecurity({ secret: 'secret1' });
      const security2 = new WebhookSecurity({ secret: 'secret2' });
      const payload = 'same payload';

      const signature1 = security1.signRequest(payload);
      const signature2 = security2.signRequest(payload);

      expect(signature1).not.toBe(signature2);
    });

    it('should support base64 encoding', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const hexSignature = security.signRequest(payload, 'hex');
      const base64Signature = security.signRequest(payload, 'base64');

      expect(hexSignature).not.toBe(base64Signature);
      expect(hexSignature.length).toBeGreaterThan(0);
      expect(base64Signature.length).toBeGreaterThan(0);
    });

    it('should use different algorithms correctly', () => {
      const payload = 'test payload';

      const sha256Security = new WebhookSecurity({ secret, algorithm: 'sha256' });
      const sha512Security = new WebhookSecurity({ secret, algorithm: 'sha512' });

      const sha256Sig = sha256Security.signRequest(payload);
      const sha512Sig = sha512Security.signRequest(payload);

      expect(sha256Sig).not.toBe(sha512Sig);
      expect(sha512Sig.length).toBeGreaterThan(sha256Sig.length);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const signature = security.signRequest(payload);
      const isValid = security.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const isValid = security.verifySignature(payload, 'invalid-signature');

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong payload', () => {
      const security = new WebhookSecurity({ secret });

      const signature = security.signRequest('original payload');
      const isValid = security.verifySignature('different payload', signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const security1 = new WebhookSecurity({ secret: 'secret1' });
      const security2 = new WebhookSecurity({ secret: 'secret2' });
      const payload = 'test payload';

      const signature = security1.signRequest(payload);
      const isValid = security2.verifySignature(payload, signature);

      expect(isValid).toBe(false);
    });

    it('should verify object payloads', () => {
      const security = new WebhookSecurity({ secret });
      const payload = { event: 'order.created', data: { id: 123 } };

      const signature = security.signRequest(payload);
      const isValid = security.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should verify base64 signatures', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const signature = security.signRequest(payload, 'base64');
      const isValid = security.verifySignature(payload, signature, 'base64');

      expect(isValid).toBe(true);
    });

    it('should use timing-safe comparison', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const signature = security.signRequest(payload);

      // Verify uses timing-safe comparison (we can't directly test timing,
      // but we can ensure it doesn't throw and works correctly)
      expect(security.verifySignature(payload, signature)).toBe(true);
      expect(security.verifySignature(payload, 'wrong')).toBe(false);
    });
  });

  describe('signRequestWithTimestamp', () => {
    it('should sign payload with timestamp', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const result = security.signRequestWithTimestamp(payload);

      expect(result.timestamp).toBeTruthy();
      expect(result.signature).toBeTruthy();
      expect(typeof result.timestamp).toBe('number');
      expect(typeof result.signature).toBe('string');
    });

    it('should use provided timestamp', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const timestamp = 1234567890;

      const result = security.signRequestWithTimestamp(payload, timestamp);

      expect(result.timestamp).toBe(timestamp);
    });

    it('should use current timestamp if not provided', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const before = Math.floor(Date.now() / 1000);
      const result = security.signRequestWithTimestamp(payload);
      const after = Math.floor(Date.now() / 1000);

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('should produce different signatures for different timestamps', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';

      const result1 = security.signRequestWithTimestamp(payload, 1000);
      const result2 = security.signRequestWithTimestamp(payload, 2000);

      expect(result1.signature).not.toBe(result2.signature);
    });
  });

  describe('verifySignatureWithTimestamp', () => {
    it('should verify valid signature with timestamp', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000);

      const { signature } = security.signRequestWithTimestamp(payload, timestamp);
      const isValid = security.verifySignatureWithTimestamp(payload, signature, timestamp);

      expect(isValid).toBe(true);
    });

    it('should reject signature with future timestamp', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      const { signature } = security.signRequestWithTimestamp(payload, futureTimestamp);
      const isValid = security.verifySignatureWithTimestamp(payload, signature, futureTimestamp);

      expect(isValid).toBe(false);
    });

    it('should reject old timestamps', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

      const { signature } = security.signRequestWithTimestamp(payload, oldTimestamp);
      const isValid = security.verifySignatureWithTimestamp(payload, signature, oldTimestamp, 300);

      expect(isValid).toBe(false);
    });

    it('should accept timestamps within maxAge', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago

      const { signature } = security.signRequestWithTimestamp(payload, timestamp);
      const isValid = security.verifySignatureWithTimestamp(payload, signature, timestamp, 300);

      expect(isValid).toBe(true);
    });

    it('should support custom maxAge', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000) - 500; // 500 seconds ago

      const { signature } = security.signRequestWithTimestamp(payload, timestamp);

      // Should fail with default maxAge (300)
      expect(security.verifySignatureWithTimestamp(payload, signature, timestamp, 300)).toBe(false);

      // Should succeed with larger maxAge (600)
      expect(security.verifySignatureWithTimestamp(payload, signature, timestamp, 600)).toBe(true);
    });

    it('should reject invalid signature even with valid timestamp', () => {
      const security = new WebhookSecurity({ secret });
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000);

      const isValid = security.verifySignatureWithTimestamp(
        payload,
        'invalid-signature',
        timestamp
      );

      expect(isValid).toBe(false);
    });
  });

  describe('updateSecret', () => {
    it('should update secret', () => {
      const security = new WebhookSecurity({ secret: 'old-secret' });
      const payload = 'test payload';

      const oldSignature = security.signRequest(payload);

      security.updateSecret('new-secret');

      const newSignature = security.signRequest(payload);

      expect(oldSignature).not.toBe(newSignature);
    });

    it('should throw error for empty secret', () => {
      const security = new WebhookSecurity({ secret });

      expect(() => {
        security.updateSecret('');
      }).toThrow('Secret cannot be empty');
    });

    it('should verify with new secret after update', () => {
      const security = new WebhookSecurity({ secret: 'old-secret' });
      const payload = 'test payload';

      security.updateSecret('new-secret');

      const signature = security.signRequest(payload);
      const isValid = security.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });
  });

  describe('createWebhookSecurity helper', () => {
    it('should create WebhookSecurity instance', () => {
      const security = createWebhookSecurity(secret);

      expect(security).toBeInstanceOf(WebhookSecurity);
      expect(security.getAlgorithm()).toBe('sha256');
    });

    it('should support custom algorithm', () => {
      const security = createWebhookSecurity(secret, 'sha512');

      expect(security.getAlgorithm()).toBe('sha512');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete webhook signing flow', () => {
      const security = new WebhookSecurity({ secret });

      // 1. Create webhook payload
      const payload = {
        event: 'order.created',
        data: {
          orderId: 12345,
          total: 99.99
        }
      };

      // 2. Sign the payload
      const signature = security.signRequest(payload);

      // 3. Verify signature (simulating receiver)
      const isValid = security.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should handle webhook with timestamp for replay protection', () => {
      const security = new WebhookSecurity({ secret });

      // Sender creates signed request
      const payload = { event: 'user.updated', userId: 789 };
      const { timestamp, signature } = security.signRequestWithTimestamp(payload);

      // Receiver verifies (within 5 minutes)
      const isValid = security.verifySignatureWithTimestamp(
        payload,
        signature,
        timestamp,
        300 // 5 minutes
      );

      expect(isValid).toBe(true);
    });

    it('should detect tampered payloads', () => {
      const security = new WebhookSecurity({ secret });

      const originalPayload = { amount: 100 };
      const signature = security.signRequest(originalPayload);

      // Attacker modifies payload
      const tamperedPayload = { amount: 1000 };

      const isValid = security.verifySignature(tamperedPayload, signature);

      expect(isValid).toBe(false);
    });
  });
});
