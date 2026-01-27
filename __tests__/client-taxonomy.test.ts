/**
 * Taxonomy tests - seller/buyer taxonomy, reviews
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Taxonomy & Reviews', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getBuyerTaxonomyNodes', () => {
    it('should get buyer taxonomy nodes', async () => {
      const mockNodes = {
        count: 2,
        results: [
          { id: 1, name: 'Art', level: 0, children: [] },
          { id: 2, name: 'Jewelry', level: 0, children: [] }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockNodes)
      });

      const result = await ctx.client.getBuyerTaxonomyNodes();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/buyer-taxonomy/nodes',
        expect.any(Object)
      );
      expect(result).toEqual(mockNodes.results);
    });
  });

  describe('getPropertiesByTaxonomyId', () => {
    it('should get properties for a taxonomy', async () => {
      const mockProperties = {
        count: 2,
        results: [
          { property_id: 1, name: 'color', display_name: 'Color' },
          { property_id: 2, name: 'size', display_name: 'Size' }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProperties)
      });

      const result = await ctx.client.getPropertiesByTaxonomyId(123);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/seller-taxonomy/nodes/123/properties',
        expect.any(Object)
      );
      expect(result).toEqual(mockProperties.results);
    });
  });

  describe('Reviews', () => {
    it('should fetch listing reviews with params', async () => {
      const mockReviews = [{ review_id: 1, rating: 5 }];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockReviews })
      });

      const result = await ctx.client.getReviewsByListing('123', {
        limit: 10,
        offset: 5,
        min_created: 946684800,
        max_created: 946684900
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123/reviews?limit=10&offset=5&min_created=946684800&max_created=946684900',
        expect.any(Object)
      );
      expect(result).toEqual(mockReviews);
    });

    it('should fetch shop reviews without params', async () => {
      const mockReviews = [{ review_id: 2, rating: 4 }];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockReviews })
      });

      const result = await ctx.client.getReviewsByShop('456');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/reviews?',
        expect.any(Object)
      );
      expect(result).toEqual(mockReviews);
    });
  });

  describe('getPropertiesByBuyerTaxonomyId', () => {
    it('should get properties for a buyer taxonomy', async () => {
      const mockProperties = {
        count: 2,
        results: [
          { property_id: 1, name: 'color', display_name: 'Color' },
          { property_id: 2, name: 'size', display_name: 'Size' }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProperties)
      });

      const result = await ctx.client.getPropertiesByBuyerTaxonomyId(456);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/buyer-taxonomy/nodes/456/properties',
        expect.any(Object)
      );
      expect(result).toEqual(mockProperties.results);
    });
  });
});
