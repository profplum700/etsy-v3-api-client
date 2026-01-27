/**
 * Return Policy tests - CRUD operations and consolidation
 */

import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Return Policies', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('createShopReturnPolicy', () => {
    it('should create a return policy', async () => {
      const policyParams = {
        accepts_returns: true,
        accepts_exchanges: false,
        return_deadline: 30
      };
      const mockPolicy = { return_policy_id: 1, shop_id: 123, ...policyParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPolicy)
      });

      const result = await ctx.client.createShopReturnPolicy('123', policyParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return',
        expect.objectContaining({
          method: 'POST',
          body: 'accepts_returns=true&accepts_exchanges=false&return_deadline=30'
        })
      );
      expect(result).toEqual(mockPolicy);
    });
  });

  describe('getShopReturnPolicies', () => {
    it('should get all return policies', async () => {
      const mockPolicies = {
        count: 2,
        results: [
          { return_policy_id: 1, shop_id: 123, accepts_returns: true, accepts_exchanges: false, return_deadline: 30 },
          { return_policy_id: 2, shop_id: 123, accepts_returns: false, accepts_exchanges: true, return_deadline: null }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPolicies)
      });

      const result = await ctx.client.getShopReturnPolicies('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return',
        expect.any(Object)
      );
      expect(result).toEqual(mockPolicies.results);
    });
  });

  describe('getShopReturnPolicy', () => {
    it('should get a specific return policy', async () => {
      const mockPolicy = {
        return_policy_id: 1,
        shop_id: 123,
        accepts_returns: true,
        accepts_exchanges: false,
        return_deadline: 30
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPolicy)
      });

      const result = await ctx.client.getShopReturnPolicy('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockPolicy);
    });
  });

  describe('updateShopReturnPolicy', () => {
    it('should update a return policy', async () => {
      const updateParams = {
        accepts_returns: true,
        accepts_exchanges: true,
        return_deadline: 60
      };
      const mockPolicy = { return_policy_id: 1, shop_id: 123, ...updateParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPolicy)
      });

      const result = await ctx.client.updateShopReturnPolicy('123', '1', updateParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return/1',
        expect.objectContaining({
          method: 'PUT',
          body: 'accepts_returns=true&accepts_exchanges=true&return_deadline=60'
        })
      );
      expect(result).toEqual(mockPolicy);
    });
  });

  describe('deleteShopReturnPolicy', () => {
    it('should delete a return policy with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteShopReturnPolicy('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });

  describe('consolidateShopReturnPolicies', () => {
    it('should consolidate return policies', async () => {
      const consolidateParams = {
        source_return_policy_id: 2,
        destination_return_policy_id: 1
      };
      const mockPolicy = {
        return_policy_id: 1,
        shop_id: 123,
        accepts_returns: true,
        accepts_exchanges: false,
        return_deadline: 30
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPolicy)
      });

      const result = await ctx.client.consolidateShopReturnPolicies('123', consolidateParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/policies/return/consolidate',
        expect.objectContaining({
          method: 'POST',
          body: 'source_return_policy_id=2&destination_return_policy_id=1'
        })
      );
      expect(result).toEqual(mockPolicy);
    });
  });
});
