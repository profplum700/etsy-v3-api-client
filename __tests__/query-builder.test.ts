/**
 * Tests for Query Builder (Phase 2)
 */

import { type Mocked } from 'vitest';
import { EtsyClient } from '../src/client';
import {
  ListingQueryBuilder,
  ReceiptQueryBuilder,
  BatchQueryExecutor,
  withQueryBuilder
} from '../src/query-builder';
import type { EtsyListing, EtsyShopReceipt } from '../src/types';

// Mock EtsyClient
vi.mock('../src/client');

describe('Query Builder', () => {
  let mockClient: Mocked<EtsyClient>;

  beforeEach(() => {
    mockClient = {
      getListingsByShop: vi.fn(),
      getShopReceipts: vi.fn(),
      getShop: vi.fn()
    } as any;
  });

  describe('ListingQueryBuilder', () => {
    it('should build query with where clause', async () => {
      const mockListings: EtsyListing[] = [
        { listing_id: 1, title: 'Test', price: { amount: 1000, divisor: 100, currency_code: 'USD' }, url: 'test' } as any
      ];

      mockClient.getListingsByShop.mockResolvedValue(mockListings);

      const query = new ListingQueryBuilder(mockClient, '123');
      const results = await query.where({ state: 'active' }).fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', { state: 'active' });
      expect(results).toEqual(mockListings);
    });

    it('should build query with include fields', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const query = new ListingQueryBuilder(mockClient, '123');
      await query.include(['Images', 'Inventory']).fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', {        
        includes: ['Images', 'Inventory']
      });
    });

    it('should build query with limit and offset', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const query = new ListingQueryBuilder(mockClient, '123');
      await query.limit(25).offset(10).fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', {
        limit: 25,
        offset: 10
      });
    });

    it('should build query with sorting', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const query = new ListingQueryBuilder(mockClient, '123');
      await query.sortBy('price', 'desc').fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', {
        sort_on: 'price',
        sort_order: 'down' // 'desc' maps to 'down'
      });
    });

    it('should chain multiple query methods', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const query = new ListingQueryBuilder(mockClient, '123');
      await query
        .where({ state: 'active' })
        .include(['Images'])
        .limit(10)
        .sortBy('created', 'desc')
        .fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', {        
        state: 'active',
        includes: ['Images'],
        limit: 10,
        sort_on: 'created',
        sort_order: 'down' // 'desc' maps to 'down'
      });
    });

    it('should fetch first result', async () => {
      const mockListings: EtsyListing[] = [
        { listing_id: 1, title: 'Test 1', price: { amount: 1000, divisor: 100, currency_code: 'USD' }, url: 'test1' } as any,
        { listing_id: 2, title: 'Test 2', price: { amount: 2000, divisor: 100, currency_code: 'USD' }, url: 'test2' } as any
      ];

      mockClient.getListingsByShop.mockResolvedValue([mockListings[0]!]);

      const query = new ListingQueryBuilder(mockClient, '123');
      const result = await query.first();

      expect(result).toEqual(mockListings[0]);
      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', { limit: 1 });
    });

    it('should return null when first() finds no results', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const query = new ListingQueryBuilder(mockClient, '123');
      const result = await query.first();

      expect(result).toBeNull();
    });

    it('should throw error when shopId is missing', async () => {
      const query = new ListingQueryBuilder(mockClient);

      await expect(query.fetch()).rejects.toThrow('Shop ID is required');
    });
  });

  describe('ReceiptQueryBuilder', () => {
    it('should build query with where clause', async () => {
      const mockReceipts: EtsyShopReceipt[] = [
        { receipt_id: 1 } as any
      ];

      mockClient.getShopReceipts.mockResolvedValue(mockReceipts);

      const query = new ReceiptQueryBuilder(mockClient, '123');
      const results = await query.where({ was_paid: true }).fetch();

      expect(mockClient.getShopReceipts).toHaveBeenCalledWith('123', {
        was_paid: true
      });
      expect(results).toEqual(mockReceipts);
    });

    it('should build query with limit, offset, and sorting', async () => {
      mockClient.getShopReceipts.mockResolvedValue([]);

      const query = new ReceiptQueryBuilder(mockClient, '123');
      await query.limit(50).offset(10).sortBy('created', 'desc').fetch();

      expect(mockClient.getShopReceipts).toHaveBeenCalledWith('123', {
        limit: 50,
        offset: 10,
        sort_on: 'created',
        sort_order: 'down' // 'desc' maps to 'down'
      });
    });

    it('should fetch first result', async () => {
      const mockReceipts: EtsyShopReceipt[] = [
        { receipt_id: 1 } as any
      ];

      mockClient.getShopReceipts.mockResolvedValue([mockReceipts[0]!]);

      const query = new ReceiptQueryBuilder(mockClient, '123');
      const result = await query.first();

      expect(result).toEqual(mockReceipts[0]);
    });
  });

  describe('BatchQueryExecutor', () => {
    it('should execute multiple queries in parallel', async () => {
      mockClient.getShop.mockResolvedValue({ shop_id: 123 } as any);
      mockClient.getListingsByShop.mockResolvedValue([{ listing_id: 1 }] as any);
      mockClient.getShopReceipts.mockResolvedValue([{ receipt_id: 1 }] as any);

      const batch = new BatchQueryExecutor(mockClient);
      const results = await batch
        .getShop('123')
        .getListings('123')
        .getReceipts('123')
        .execute();

      expect(results).toHaveLength(3);
      expect(mockClient.getShop).toHaveBeenCalledWith('123');
      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', undefined);
      expect(mockClient.getShopReceipts).toHaveBeenCalledWith('123', undefined);
    });

    it('should execute queries sequentially', async () => {
      const executionOrder: string[] = [];

      mockClient.getShop.mockImplementation(async () => {
        executionOrder.push('shop');
        return { shop_id: 123 } as any;
      });

      mockClient.getListingsByShop.mockImplementation(async () => {
        executionOrder.push('listings');
        return [];
      });

      const batch = new BatchQueryExecutor(mockClient);
      await batch
        .getShop('123')
        .getListings('123')
        .executeSequential();

      expect(executionOrder).toEqual(['shop', 'listings']);
    });

    it('should support custom queries', async () => {
      const customQuery = vi.fn().mockResolvedValue('custom result');

      const batch = new BatchQueryExecutor(mockClient);
      const results = await batch.custom(customQuery).execute();

      expect(customQuery).toHaveBeenCalled();
      expect(results[0]).toBe('custom result');
    });

    it('should clear operations', () => {
      const batch = new BatchQueryExecutor(mockClient);
      batch.getShop('123');
      batch.getListings('123');

      expect(batch.size()).toBe(2);

      batch.clear();

      expect(batch.size()).toBe(0);
    });

    it('should return batch size', () => {
      const batch = new BatchQueryExecutor(mockClient);
      expect(batch.size()).toBe(0);

      batch.getShop('123');
      expect(batch.size()).toBe(1);

      batch.getListings('123');
      expect(batch.size()).toBe(2);
    });
  });

  describe('withQueryBuilder', () => {
    it('should add query builder methods to client', () => {
      const extendedClient = withQueryBuilder(mockClient);

      expect(typeof extendedClient.listings).toBe('function');
      expect(typeof extendedClient.receipts).toBe('function');
      expect(typeof extendedClient.batch).toBe('function');
    });

    it('should create working query builders', async () => {
      mockClient.getListingsByShop.mockResolvedValue([]);

      const extendedClient = withQueryBuilder(mockClient);
      await extendedClient.listings('123').where({ state: 'active' }).fetch();

      expect(mockClient.getListingsByShop).toHaveBeenCalledWith('123', {
        state: 'active'
      });
    });
  });
});
