/**
 * Payment and Ledger tests
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Payments & Ledger', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getShopPaymentAccountLedgerEntries', () => {
    it('should get ledger entries', async () => {
      const mockEntries = {
        count: 2,
        results: [
          { entry_id: 1, amount: { amount: 2999, divisor: 100, currency_code: 'USD' } },
          { entry_id: 2, amount: { amount: 1999, divisor: 100, currency_code: 'USD' } }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEntries)
      });

      const result = await ctx.client.getShopPaymentAccountLedgerEntries('123', {
        min_created: 1609459200,
        max_created: 1640995200
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shops/123/payment-account/ledger-entries'),
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('min_created=1609459200'),
        expect.any(Object)
      );
      expect(result).toEqual(mockEntries.results);
    });

    it('should get ledger entries with pagination', async () => {
      const mockEntries = { count: 10, results: [] };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEntries)
      });

      await ctx.client.getShopPaymentAccountLedgerEntries('123', {
        min_created: 1609459200,
        max_created: 1640995200,
        limit: 25,
        offset: 50
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=50'),
        expect.any(Object)
      );
    });
  });

  describe('getShopPaymentAccountLedgerEntry', () => {
    it('should get a specific ledger entry', async () => {
      const mockEntry = { entry_id: 1, amount: { amount: 2999, divisor: 100, currency_code: 'USD' } };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEntry)
      });

      const result = await ctx.client.getShopPaymentAccountLedgerEntry('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/payment-account/ledger-entries/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockEntry);
    });
  });

  describe('getShopPayment', () => {
    it('should get payment details', async () => {
      const mockPayment = {
        payment_id: 1,
        amount_gross: { amount: 2999, divisor: 100, currency_code: 'USD' }
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          count: 1,
          results: [mockPayment]
        })
      });

      const result = await ctx.client.getShopPayment('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/payments?payment_ids=1',
        expect.any(Object)
      );
      expect(result).toEqual(mockPayment);
    });
  });

  describe('getPaymentAccountLedgerEntryPayments', () => {
    it('should get payments for ledger entries', async () => {
      const mockPayments = {
        count: 2,
        results: [
          { payment_id: 1, amount_gross: { amount: 2999, divisor: 100, currency_code: 'USD' } },
          { payment_id: 2, amount_gross: { amount: 1999, divisor: 100, currency_code: 'USD' } }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPayments)
      });

      const result = await ctx.client.getPaymentAccountLedgerEntryPayments('123', {
        ledger_entry_ids: [100, 200]
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shops/123/payment-account/ledger-entries/payments'),
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ledger_entry_ids=100%2C200'),
        expect.any(Object)
      );
      expect(result).toEqual(mockPayments.results);
    });
  });

  describe('getShopPaymentByReceiptId', () => {
    it('should get payments for a receipt', async () => {
      const mockPayments = {
        count: 1,
        results: [
          { payment_id: 1, amount_gross: { amount: 2999, divisor: 100, currency_code: 'USD' } }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPayments)
      });

      const result = await ctx.client.getShopPaymentByReceiptId('123', '456');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/receipts/456/payments',
        expect.any(Object)
      );
      expect(result).toEqual(mockPayments.results);
    });
  });
});
