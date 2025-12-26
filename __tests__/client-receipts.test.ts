/**
 * Receipts and Transactions tests
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Receipts & Transactions', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getShopReceipts', () => {
    it('should get shop receipts', async () => {
      const mockReceipts = {
        count: 2,
        results: [
          { receipt_id: 1, status: 'completed' },
          { receipt_id: 2, status: 'open' }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockReceipts)
      });

      const result = await ctx.client.getShopReceipts('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shops/123/receipts'),
        expect.any(Object)
      );
      expect(result).toEqual(mockReceipts.results);
    });

    it('should get receipts with filters', async () => {
      const mockReceipts = { count: 1, results: [{ receipt_id: 1, status: 'completed' }] };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockReceipts)
      });

      const result = await ctx.client.getShopReceipts('123', {
        was_paid: true,
        was_shipped: true,
        limit: 10
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('was_paid=true'),
        expect.any(Object)
      );
      expect(result).toEqual(mockReceipts.results);
    });
  });

  describe('getShopReceipt', () => {
    it('should get a specific receipt', async () => {
      const mockReceipt = { receipt_id: 1, status: 'completed' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockReceipt)
      });

      const result = await ctx.client.getShopReceipt('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/receipts/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockReceipt);
    });
  });

  describe('updateShopReceipt', () => {
    it('should update a receipt', async () => {
      const mockReceipt = { receipt_id: 1, was_shipped: true };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockReceipt)
      });

      const result = await ctx.client.updateShopReceipt('123', '1', { was_shipped: true });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/receipts/1',
        expect.objectContaining({
          method: 'PUT',
          body: 'was_shipped=true'
        })
      );
      expect(result).toEqual(mockReceipt);
    });
  });

  describe('getShopReceiptTransactions', () => {
    it('should get receipt transactions', async () => {
      const mockTransactions = {
        count: 2,
        results: [
          { transaction_id: 1, title: 'Item 1' },
          { transaction_id: 2, title: 'Item 2' }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTransactions)
      });

      const result = await ctx.client.getShopReceiptTransactions('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/receipts/1/transactions',
        expect.any(Object)
      );
      expect(result).toEqual(mockTransactions.results);
    });
  });

  describe('getShopTransaction', () => {
    it('should get a specific transaction', async () => {
      const mockTransaction = { transaction_id: 1, title: 'Item 1' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTransaction)
      });

      const result = await ctx.client.getShopTransaction('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/transactions/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('Shipments', () => {
    describe('createReceiptShipment', () => {
      it('should create a receipt shipment', async () => {
        const shipmentParams = {
          tracking_code: '1Z999AA10123456784',
          carrier_name: 'UPS'
        };
        const mockShipment = { receipt_shipping_id: 1, ...shipmentParams };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShipment)
        });

        const result = await ctx.client.createReceiptShipment('123', '456', shipmentParams);

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/456/tracking',
          expect.objectContaining({
            method: 'POST',
            body: 'tracking_code=1Z999AA10123456784&carrier_name=UPS'
          })
        );
        expect(result).toEqual(mockShipment);
      });

      it('should create shipment with optional params', async () => {
        const shipmentParams = {
          tracking_code: '1Z999AA10123456784',
          carrier_name: 'UPS',
          send_bcc: true,
          note_to_buyer: 'Your package is on the way!'
        };
        const mockShipment = { receipt_shipping_id: 1, ...shipmentParams };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShipment)
        });

        const result = await ctx.client.createReceiptShipment('123', '456', shipmentParams);

        expect(result).toEqual(mockShipment);
      });
    });
  });
});
