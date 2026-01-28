/**
 * Listing Variation Image tests - get and update operations
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Listing Variation Images', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getListingVariationImages', () => {
    it('should get listing variation images', async () => {
      const mockVariationImages = {
        count: 2,
        results: [
          {
            property_id: 100,
            value_id: 200,
            value: 'Red',
            image_id: 300
          },
          {
            property_id: 100,
            value_id: 201,
            value: 'Blue',
            image_id: 301
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockVariationImages)
      });

      const result = await ctx.client.getListingVariationImages('123', '789');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/variation-images',
        expect.any(Object)
      );
      expect(result).toEqual(mockVariationImages.results);
    });
  });

  describe('updateVariationImages', () => {
    it('should update variation images with JSON body', async () => {
      const params = {
        variation_images: [
          { property_id: 100, value_id: 200, image_id: 300 },
          { property_id: 100, value_id: 201, image_id: 301 }
        ]
      };
      const mockVariationImages = {
        count: 2,
        results: [
          {
            property_id: 100,
            value_id: 200,
            value: 'Red',
            image_id: 300
          },
          {
            property_id: 100,
            value_id: 201,
            value: 'Blue',
            image_id: 301
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockVariationImages)
      });

      const result = await ctx.client.updateVariationImages('123', '789', params);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/variation-images',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params)
        })
      );
      expect(result).toEqual(mockVariationImages.results);
    });
  });
});
