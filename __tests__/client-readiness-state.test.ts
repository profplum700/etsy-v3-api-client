/**
 * Readiness State Definition tests - processing profile CRUD operations
 */

import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Readiness State Definitions', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('createShopReadinessStateDefinition', () => {
    it('should create a readiness state definition', async () => {
      const createParams = {
        readiness_state: 'made_to_order' as const,
        min_processing_time: 3,
        max_processing_time: 5
      };
      const mockProfile = {
        shop_id: 123,
        readiness_state_id: 1,
        readiness_state: 'made_to_order',
        min_processing_days: 3,
        max_processing_days: 5,
        processing_days_display_label: '3-5 business days'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

      const result = await ctx.client.createShopReadinessStateDefinition('123', createParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions',
        expect.objectContaining({
          method: 'POST',
          body: 'readiness_state=made_to_order&min_processing_time=3&max_processing_time=5'
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getShopReadinessStateDefinitions', () => {
    it('should get all readiness state definitions', async () => {
      const mockDefinitions = {
        count: 2,
        results: [
          {
            shop_id: 123,
            readiness_state_id: 1,
            readiness_state: 'ready_to_ship',
            min_processing_days: 1,
            max_processing_days: 2,
            processing_days_display_label: '1-2 business days'
          },
          {
            shop_id: 123,
            readiness_state_id: 2,
            readiness_state: 'made_to_order',
            min_processing_days: 3,
            max_processing_days: 5,
            processing_days_display_label: '3-5 business days'
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockDefinitions)
      });

      const result = await ctx.client.getShopReadinessStateDefinitions('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions',
        expect.any(Object)
      );
      expect(result).toEqual(mockDefinitions.results);
    });

    it('should get readiness state definitions with limit and offset', async () => {
      const mockDefinitions = {
        count: 1,
        results: [
          {
            shop_id: 123,
            readiness_state_id: 2,
            readiness_state: 'made_to_order',
            min_processing_days: 3,
            max_processing_days: 5,
            processing_days_display_label: '3-5 business days'
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockDefinitions)
      });

      const result = await ctx.client.getShopReadinessStateDefinitions('123', {
        limit: 10,
        offset: 1
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions?limit=10&offset=1',
        expect.any(Object)
      );
      expect(result).toEqual(mockDefinitions.results);
    });
  });

  describe('getShopReadinessStateDefinition', () => {
    it('should get a specific readiness state definition', async () => {
      const mockProfile = {
        shop_id: 123,
        readiness_state_id: 1,
        readiness_state: 'ready_to_ship',
        min_processing_days: 1,
        max_processing_days: 2,
        processing_days_display_label: '1-2 business days'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

      const result = await ctx.client.getShopReadinessStateDefinition('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateShopReadinessStateDefinition', () => {
    it('should update a readiness state definition', async () => {
      const updateParams = {
        min_processing_time: 2,
        max_processing_time: 4
      };
      const mockProfile = {
        shop_id: 123,
        readiness_state_id: 1,
        readiness_state: 'made_to_order',
        min_processing_days: 2,
        max_processing_days: 4,
        processing_days_display_label: '2-4 business days'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

      const result = await ctx.client.updateShopReadinessStateDefinition('123', '1', updateParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions/1',
        expect.objectContaining({
          method: 'PUT',
          body: 'min_processing_time=2&max_processing_time=4'
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('deleteShopReadinessStateDefinition', () => {
    it('should delete a readiness state definition with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteShopReadinessStateDefinition('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/readiness-state-definitions/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });
});
