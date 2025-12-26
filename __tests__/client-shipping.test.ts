/**
 * Shipping Profile tests
 */

import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Shipping Profiles', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getShopShippingProfiles', () => {
    it('should get all shipping profiles', async () => {
      const mockProfiles = {
        count: 2,
        results: [
          { shipping_profile_id: 1, title: 'Standard' },
          { shipping_profile_id: 2, title: 'Express' }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfiles)
      });

      const result = await ctx.client.getShopShippingProfiles('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles',
        expect.any(Object)
      );
      expect(result).toEqual(mockProfiles.results);
    });
  });

  describe('createShopShippingProfile', () => {
    it('should create a shipping profile', async () => {
      const profileParams = {
        title: 'Standard Shipping',
        origin_country_iso: 'US',
        primary_cost: 5.99,
        secondary_cost: 2.99,
        min_processing_time: 1,
        max_processing_time: 3
      };
      const mockProfile = { shipping_profile_id: 1, ...profileParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfile)
      });

      const result = await ctx.client.createShopShippingProfile('123', profileParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles',
        expect.objectContaining({
          method: 'POST',
          body:
            'title=Standard+Shipping&origin_country_iso=US&primary_cost=5.99&secondary_cost=2.99&min_processing_time=1&max_processing_time=3'
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateShopShippingProfile', () => {
    it('should update a shipping profile', async () => {
      const mockProfile = { shipping_profile_id: 1, title: 'Updated Title' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfile)
      });

      const result = await ctx.client.updateShopShippingProfile('123', '1', {
        title: 'Updated Title'
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1',
        expect.objectContaining({
          method: 'PUT',
          body: 'title=Updated+Title'
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('deleteShopShippingProfile', () => {
    it('should delete a shipping profile with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteShopShippingProfile('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });

  describe('Shipping Profile Destinations', () => {
    it('should get profile destinations', async () => {
      const mockDestinations = {
        count: 1,
        results: [{ shipping_profile_destination_id: 1, destination_country_iso: 'US' }]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockDestinations)
      });

      const result = await ctx.client.getShopShippingProfileDestinations('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/destinations',
        expect.any(Object)
      );
      expect(result).toEqual(mockDestinations.results);
    });

    it('should create a destination', async () => {
      const destParams = {
        primary_cost: 10.0,
        secondary_cost: 5.0,
        destination_country_iso: 'CA'
      };
      const mockDest = { shipping_profile_destination_id: 1, ...destParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockDest)
      });

      const result = await ctx.client.createShopShippingProfileDestination('123', '1', destParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/destinations',
        expect.objectContaining({
          method: 'POST',
          body: 'primary_cost=10&secondary_cost=5&destination_country_iso=CA'
        })
      );
      expect(result).toEqual(mockDest);
    });

    it('should delete a destination with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteShopShippingProfileDestination('123', '1', '999');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/destinations/999',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getShopShippingProfileUpgrades', () => {
    it('should get profile upgrades', async () => {
      const mockUpgrades = {
        count: 1,
        results: [{ upgrade_id: 1, upgrade_name: 'Express' }]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUpgrades)
      });

      const result = await ctx.client.getShopShippingProfileUpgrades('123', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/upgrades',
        expect.any(Object)
      );
      expect(result).toEqual(mockUpgrades.results);
    });
  });
});
