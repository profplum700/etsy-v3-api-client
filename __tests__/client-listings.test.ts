/**
 * Listing tests - read, write, images, inventory, properties
 */

import { ListingParams } from '../src/types';
import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Listings', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getListingsByShop', () => {
    it('should fetch listings by shop ID', async () => {
      const mockListings = [
        { listing_id: 1, title: 'Test Listing 1' },
        { listing_id: 2, title: 'Test Listing 2' }
      ];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const result = await ctx.client.getListingsByShop('456');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=active',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should fetch listings with parameters', async () => {
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const params: ListingParams = {
        state: 'draft' as const,
        limit: 10,
        offset: 0,
        sort_on: 'created' as const,
        sort_order: 'down' as const,
        includes: ['Images']
      };

      const result = await ctx.client.getListingsByShop('456', params);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=draft&limit=10&offset=0&sort_on=created&sort_order=down&includes=Images',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should use current user shop when no shop ID provided', async () => {
      const mockUser = { user_id: 123, shop_id: 456 };
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];

      ctx.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ results: mockListings })
        });

      const result = await ctx.client.getListingsByShop();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=active',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });
  });

  describe('getListing', () => {
    it('should fetch listing by ID', async () => {
      const mockListing = { listing_id: 123, title: 'Test Listing' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.getListing('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123',
        expect.any(Object)
      );
      expect(result).toEqual(mockListing);
    });

    it('should fetch listing with includes', async () => {
      const mockListing = { listing_id: 123, title: 'Test Listing' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.getListing('123', ['Images', 'Inventory']);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123?includes=Images%2CInventory',
        expect.any(Object)
      );
      expect(result).toEqual(mockListing);
    });
  });

  describe('findAllListingsActive', () => {
    it('should search active listings', async () => {
      const mockListings = [
        { listing_id: 1, title: 'Test Listing 1' },
        { listing_id: 2, title: 'Test Listing 2' }
      ];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const result = await ctx.client.findAllListingsActive();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/active?',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should search with parameters', async () => {
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const params = {
        keywords: 'vintage print',
        limit: 20,
        offset: 0,
        sort_on: 'price' as const,
        sort_order: 'up' as const,
        min_price: 10,
        max_price: 100,
        taxonomy_id: 123,
        shop_location: 'New York'
      };

      const result = await ctx.client.findAllListingsActive(params);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/active?keywords=vintage+print&limit=20&offset=0&sort_on=price&sort_order=up&min_price=10&max_price=100&taxonomy_id=123&shop_location=New+York',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });
  });

  describe('createDraftListing', () => {
    it('should create a draft listing', async () => {
      const listingParams = {
        quantity: 10,
        title: 'Test Listing',
        description: 'Test description',
        price: 29.99,
        who_made: 'i_did' as const,
        when_made: 'made_to_order' as const,
        taxonomy_id: 123
      };
      const mockListing = { listing_id: 789, ...listingParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.createDraftListing('123', listingParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings',
        expect.objectContaining({
          method: 'POST',
          body:
            'quantity=10&title=Test+Listing&description=Test+description&price=29.99&who_made=i_did&when_made=made_to_order&taxonomy_id=123'
        })
      );
      expect(result).toEqual(mockListing);
    });

    it('should create listing with optional parameters', async () => {
      const listingParams = {
        quantity: 10,
        title: 'Test Listing',
        description: 'Test description',
        price: 29.99,
        who_made: 'i_did' as const,
        when_made: 'made_to_order' as const,
        taxonomy_id: 123,
        tags: ['handmade', 'gift'],
        materials: ['wood', 'metal'],
        is_supply: false,
        is_customizable: true
      };
      const mockListing = { listing_id: 789, ...listingParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.createDraftListing('123', listingParams);

      expect(result).toEqual(mockListing);
    });
  });

  describe('updateListing', () => {
    it('should update a listing', async () => {
      const updateParams = {
        title: 'Updated Title',
        description: 'Updated description',
        tags: ['updated', 'tags']
      };
      const mockListing = { listing_id: 789, ...updateParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.updateListing('123', '789', updateParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('title=Updated+Title')
        })
      );
      expect(result).toEqual(mockListing);
    });

    it('should update listing state', async () => {
      const mockListing = { listing_id: 789, state: 'active' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await ctx.client.updateListing('123', '789', { state: 'active' });

      expect(result.state).toBe('active');
    });
  });

  describe('deleteListing', () => {
    it('should delete a listing with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteListing('789');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/789',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });

  describe('updateListingInventory', () => {
    it('should update listing inventory', async () => {
      const inventoryParams = {
        products: [{
          offerings: [{
            price: 29.99,
            quantity: 10,
            is_enabled: true
          }]
        }]
      };
      const mockInventory = { products: inventoryParams.products };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockInventory)
      });

      const result = await ctx.client.updateListingInventory('789', inventoryParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/789/inventory',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(inventoryParams)
        })
      );
      expect(result).toEqual(mockInventory);
    });
  });

  describe('Listing Images', () => {
    describe('uploadListingImage', () => {
      it('should upload a listing image', async () => {
        const mockImage = { listing_image_id: 999, url_fullxfull: 'https://example.com/image.jpg' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
        const result = await ctx.client.uploadListingImage('123', '789', blob);

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/images',
          expect.objectContaining({ method: 'POST' })
        );
        expect(result).toEqual(mockImage);
      });

      it('should upload image with metadata', async () => {
        const mockImage = { listing_image_id: 999, alt_text: 'Test alt text' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
        const result = await ctx.client.uploadListingImage('123', '789', blob, {
          rank: 1,
          alt_text: 'Test alt text',
          is_watermarked: false
        });

        expect(result).toEqual(mockImage);
      });
    });

    describe('getListingImage', () => {
      it('should get a specific listing image', async () => {
        const mockImage = { listing_image_id: 999, url_fullxfull: 'https://example.com/image.jpg' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const result = await ctx.client.getListingImage('789', '999');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/listings/789/images/999',
          expect.any(Object)
        );
        expect(result).toEqual(mockImage);
      });
    });

    describe('deleteListingImage', () => {
      it('should delete a listing image with 204 No Content response', async () => {
        ctx.mockFetch.mockResolvedValue(create204Response());

        const result = await ctx.client.deleteListingImage('123', '789', '999');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/images/999',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Listing Properties', () => {
    describe('getListingProperties', () => {
      it('should get listing properties', async () => {
        const mockProperties = {
          count: 1,
          results: [{ property_id: 1, name: 'color', display_name: 'Color' }]
        };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProperties)
        });

        const result = await ctx.client.getListingProperties('123', '789');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/properties',
          expect.any(Object)
        );
        expect(result).toEqual(mockProperties.results);
      });
    });

    describe('updateListingProperty', () => {
      it('should update listing property with form-urlencoded body', async () => {
        const mockProperty = {
          property_id: 505,
          name: 'width',
          display_name: 'Width',
          selected_values: [{ property_id: 505, value_ids: [505], values: ['12'] }]
        };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          headers: new Headers(),
          json: jest.fn().mockResolvedValue(mockProperty)
        });

        const result = await ctx.client.updateListingProperty({
          shopId: '12345678',
          listingId: '1234567890',
          propertyId: 505,
          valueIds: [505],
          values: ['12'],
          scaleId: 5
        });

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/12345678/listings/1234567890/properties/505',
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/x-www-form-urlencoded'
            }),
            body: expect.stringContaining('value_ids')
          })
        );
        expect(result.property_id).toBe(505);
      });

      it('should update listing property with multi-value arrays', async () => {
        const mockProperty = {
          property_id: 4848,
          name: 'subject',
          display_name: 'Subject',
          selected_values: [
            { property_id: 4848, value_ids: [1, 60, 5022], values: ['Abstract', 'Animals', 'Architecture'] }
          ]
        };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          headers: new Headers(),
          json: jest.fn().mockResolvedValue(mockProperty)
        });

        const result = await ctx.client.updateListingProperty({
          shopId: '12345678',
          listingId: '1234567890',
          propertyId: 4848,
          valueIds: [1, 60, 5022],
          values: ['Abstract', 'Animals', 'Architecture']
        });

        const callArgs = ctx.mockFetch.mock.calls[0];
        const body = callArgs[1].body as string;
        expect(body).toContain('value_ids=1');
        expect(body).toContain('value_ids=60');
        expect(body).toContain('value_ids=5022');
        expect(body).toContain('values=Abstract');
        expect(body).toContain('values=Animals');
        expect(body).toContain('values=Architecture');
        expect(result.property_id).toBe(4848);
      });

      it('should throw error on API failure', async () => {
        ctx.mockFetch.mockResolvedValue({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          headers: new Headers(),
          text: jest.fn().mockResolvedValue('Invalid property value')
        });

        await expect(ctx.client.updateListingProperty({
          shopId: '12345678',
          listingId: '1234567890',
          propertyId: 505,
          valueIds: [999],
          values: ['invalid']
        })).rejects.toThrow('Failed to update listing property');
      });
    });
  });
});
