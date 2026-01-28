/**
 * Tests for Webhook Support (Phase 1)
 */

import { EtsyWebhookHandler, createWebhookHandler } from '../src/webhooks';

// Mock crypto module for Node.js
const mockCrypto = {
  createHmac: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-signature-hash')
  }),
  timingSafeEqual: vi.fn((a: any, b: any) => a.toString() === b.toString())
};

describe('EtsyWebhookHandler', () => {
  const mockSecret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    mockCrypto.createHmac.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-signature-hash')
    });
    mockCrypto.timingSafeEqual.mockImplementation((a: any, b: any) => a.toString() === b.toString());
  });

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      expect(handler).toBeInstanceOf(EtsyWebhookHandler);
    });

    it('should create instance with custom config', () => {
      const handler = new EtsyWebhookHandler({
        secret: mockSecret,
        algorithm: 'sha256',
        verifySignatures: true
      });
      expect(handler).toBeInstanceOf(EtsyWebhookHandler);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      (handler as any).crypto = mockCrypto;
      const payload = JSON.stringify({ type: 'receipt.updated', data: {} });

      mockCrypto.createHmac.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('valid-signature')
      });

      mockCrypto.timingSafeEqual.mockReturnValueOnce(true);

      const isValid = handler.verifySignature(payload, 'valid-signature');

      expect(isValid).toBe(true);
      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', mockSecret);
    });

    it('should reject invalid signature', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      (handler as any).crypto = mockCrypto;
      const payload = JSON.stringify({ type: 'receipt.updated', data: {} });

      mockCrypto.createHmac.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('expected-signature')
      });

      mockCrypto.timingSafeEqual.mockReturnValueOnce(false);

      const isValid = handler.verifySignature(payload, 'wrong-signature');

      expect(isValid).toBe(false);
    });

    it('should skip verification when disabled', () => {
      const handler = new EtsyWebhookHandler({
        secret: mockSecret,
        verifySignatures: false
      });

      const isValid = handler.verifySignature('any-payload', 'any-signature');

      expect(isValid).toBe(true);
      expect(mockCrypto.createHmac).not.toHaveBeenCalled();
    });
  });

  describe('parseEvent', () => {
    it('should parse valid event from string', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const payload = JSON.stringify({
        type: 'receipt.updated',
        timestamp: 1234567890,
        data: { receipt_id: 123 },
        shop_id: 456
      });

      const event = handler.parseEvent(payload);

      expect(event).toEqual({
        type: 'receipt.updated',
        timestamp: 1234567890,
        data: { receipt_id: 123 },
        shop_id: 456,
        user_id: undefined
      });
    });

    it('should parse valid event from object', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const payload = {
        type: 'listing.created',
        timestamp: 1234567890,
        data: { listing_id: 789 }
      };

      const event = handler.parseEvent(payload);

      expect(event).toEqual({
        type: 'listing.created',
        timestamp: 1234567890,
        data: { listing_id: 789 },
        shop_id: undefined,
        user_id: undefined
      });
    });

    it('should add timestamp if missing', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const payload = {
        type: 'receipt.updated',
        data: { receipt_id: 123 }
      };

      const beforeParse = Date.now();
      const event = handler.parseEvent(payload);
      const afterParse = Date.now();

      expect(event.timestamp).toBeGreaterThanOrEqual(beforeParse);
      expect(event.timestamp).toBeLessThanOrEqual(afterParse);
    });

    it('should throw on invalid event format', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const invalidPayload = {
        type: 'receipt.updated'
        // Missing data field
      };

      expect(() => handler.parseEvent(invalidPayload)).toThrow(
        'Invalid webhook event format'
      );
    });
  });

  describe('on/off event handlers', () => {
    it('should register event handler', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn();

      handler.on('receipt.updated', mockHandler);

      expect(handler.getHandlerCount('receipt.updated')).toBe(1);
    });

    it('should register multiple handlers for same event', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      handler.on('receipt.updated', mockHandler1);
      handler.on('receipt.updated', mockHandler2);

      expect(handler.getHandlerCount('receipt.updated')).toBe(2);
    });

    it('should remove specific handler', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      handler.on('receipt.updated', mockHandler1);
      handler.on('receipt.updated', mockHandler2);

      handler.off('receipt.updated', mockHandler1);

      expect(handler.getHandlerCount('receipt.updated')).toBe(1);
    });

    it('should call handler when event is parsed', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn();

      handler.on('receipt.updated', mockHandler);

      const payload = {
        type: 'receipt.updated',
        data: { receipt_id: 123 }
      };

      handler.parseEvent(payload);

      // Wait for async handlers to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockHandler).toHaveBeenCalledWith({ receipt_id: 123 });
    });

    it('should call all handlers for an event', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      handler.on('receipt.updated', mockHandler1);
      handler.on('receipt.updated', mockHandler2);

      const payload = {
        type: 'receipt.updated',
        data: { receipt_id: 123 }
      };

      handler.parseEvent(payload);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockHandler1).toHaveBeenCalledWith({ receipt_id: 123 });
      expect(mockHandler2).toHaveBeenCalledWith({ receipt_id: 123 });
    });

    it('should handle async handlers', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return data;
      });

      handler.on('receipt.updated', mockHandler);

      const payload = {
        type: 'receipt.updated',
        data: { receipt_id: 123 }
      };

      handler.parseEvent(payload);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should not throw if handler throws', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      handler.on('receipt.updated', mockHandler);

      const payload = {
        type: 'receipt.updated',
        data: { receipt_id: 123 }
      };

      // Should not throw
      expect(() => handler.parseEvent(payload)).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all handlers for specific event', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      handler.on('receipt.updated', mockHandler1);
      handler.on('listing.created', mockHandler2);

      handler.removeAllListeners('receipt.updated');

      expect(handler.getHandlerCount('receipt.updated')).toBe(0);
      expect(handler.getHandlerCount('listing.created')).toBe(1);
    });

    it('should remove all handlers for all events', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      handler.on('receipt.updated', mockHandler1);
      handler.on('listing.created', mockHandler2);

      handler.removeAllListeners();

      expect(handler.getHandlerCount('receipt.updated')).toBe(0);
      expect(handler.getHandlerCount('listing.created')).toBe(0);
    });
  });

  describe('getHandlerCount', () => {
    it('should return 0 for events with no handlers', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });

      expect(handler.getHandlerCount('receipt.updated')).toBe(0);
    });

    it('should return correct count', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });

      handler.on('receipt.updated', vi.fn());
      handler.on('receipt.updated', vi.fn());
      handler.on('listing.created', vi.fn());

      expect(handler.getHandlerCount('receipt.updated')).toBe(2);
      expect(handler.getHandlerCount('listing.created')).toBe(1);
    });
  });

  describe('getRegisteredEventTypes', () => {
    it('should return empty array initially', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });

      expect(handler.getRegisteredEventTypes()).toEqual([]);
    });

    it('should return all registered event types', () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });

      handler.on('receipt.updated', vi.fn());
      handler.on('listing.created', vi.fn());
      handler.on('shop.updated', vi.fn());

      const eventTypes = handler.getRegisteredEventTypes();

      expect(eventTypes).toHaveLength(3);
      expect(eventTypes).toContain('receipt.updated');
      expect(eventTypes).toContain('listing.created');
      expect(eventTypes).toContain('shop.updated');
    });
  });

  describe('createWebhookHandler helper', () => {
    it('should create handler instance', () => {
      const handler = createWebhookHandler({ secret: mockSecret });

      expect(handler).toBeInstanceOf(EtsyWebhookHandler);
    });
  });

  describe('supported event types', () => {
    it('should handle receipt.updated events', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn();

      handler.on('receipt.updated', mockHandler);
      handler.parseEvent({ type: 'receipt.updated', data: {} });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should handle receipt.created events', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn();

      handler.on('receipt.created', mockHandler);
      handler.parseEvent({ type: 'receipt.created', data: {} });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should handle listing events', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const handlers = {
        updated: vi.fn(),
        created: vi.fn(),
        deactivated: vi.fn()
      };

      handler.on('listing.updated', handlers.updated);
      handler.on('listing.created', handlers.created);
      handler.on('listing.deactivated', handlers.deactivated);

      handler.parseEvent({ type: 'listing.updated', data: {} });
      handler.parseEvent({ type: 'listing.created', data: {} });
      handler.parseEvent({ type: 'listing.deactivated', data: {} });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handlers.updated).toHaveBeenCalled();
      expect(handlers.created).toHaveBeenCalled();
      expect(handlers.deactivated).toHaveBeenCalled();
    });

    it('should handle shop.updated events', async () => {
      const handler = new EtsyWebhookHandler({ secret: mockSecret });
      const mockHandler = vi.fn();

      handler.on('shop.updated', mockHandler);
      handler.parseEvent({ type: 'shop.updated', data: {} });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
