/**
 * User and Shop tests - getUser, getShop, shop sections CRUD
 */

import { EtsyApiError } from '../src/types';
import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient User & Shop', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getUser', () => {
    it('should fetch current user', async () => {
      const mockUser = { user_id: 123, login_name: 'testuser' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockUser)
      });

      const result = await ctx.client.getUser();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('getShop', () => {
    it('should fetch shop by ID', async () => {
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockShop)
      });

      const result = await ctx.client.getShop('456');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });

    it('should fetch current user shop when no ID provided', async () => {
      const mockUser = { user_id: 123, shop_id: 456 };
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };

      ctx.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockShop)
        });

      const result = await ctx.client.getShop();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });

    it('should throw error when user has no shop', async () => {
      const mockUser = { user_id: 123 }; // No shop_id
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockUser)
      });

      await expect(ctx.client.getShop()).rejects.toThrow(EtsyApiError);
      await expect(ctx.client.getShop()).rejects.toThrow('User does not have a shop');
    });
  });

  describe('getShopByOwnerUserId', () => {
    it('should fetch shop by user ID', async () => {
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockShop)
      });

      const result = await ctx.client.getShopByOwnerUserId('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/123/shops',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });
  });

  describe('updateShop', () => {
    it('should update shop settings', async () => {
      const mockShop = { shop_id: 123, title: 'Updated Title' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockShop)
      });

      const result = await ctx.client.updateShop('123', { title: 'Updated Title' });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123',
        expect.objectContaining({
          method: 'PUT',
          body: 'title=Updated+Title'
        })
      );
      expect(result).toEqual(mockShop);
    });

    it('should update multiple shop fields', async () => {
      const updateParams = {
        title: 'New Title',
        announcement: 'Sale!',
        sale_message: 'Thanks for shopping!',
        digital_sale_message: 'Enjoy your download!'
      };
      const mockShop = { shop_id: 123, ...updateParams };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockShop)
      });

      const result = await ctx.client.updateShop('123', updateParams);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('title=New+Title')
        })
      );
      expect(result).toEqual(mockShop);
    });
  });

  describe('Shop Sections', () => {
    describe('createShopSection', () => {
      it('should create a new shop section', async () => {
        const mockSection = { shop_section_id: 456, title: 'New Section' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSection)
        });

        const result = await ctx.client.createShopSection('123', { title: 'New Section' });

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections',
          expect.objectContaining({
            method: 'POST',
            body: 'title=New+Section'
          })
        );
        expect(result).toEqual(mockSection);
      });
    });

    describe('updateShopSection', () => {
      it('should update a shop section', async () => {
        const mockSection = { shop_section_id: 456, title: 'Updated Section' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSection)
        });

        const result = await ctx.client.updateShopSection('123', '456', { title: 'Updated Section' });

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections/456',
          expect.objectContaining({
            method: 'PUT',
            body: 'title=Updated+Section'
          })
        );
        expect(result).toEqual(mockSection);
      });
    });

    describe('deleteShopSection', () => {
      it('should delete a shop section with 204 No Content response', async () => {
        ctx.mockFetch.mockResolvedValue(create204Response());

        const result = await ctx.client.deleteShopSection('123', '456');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections/456',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Production Partners', () => {
    describe('getShopProductionPartners', () => {
      it('should get shop production partners', async () => {
        const mockPartners = {
          count: 1,
          results: [{ production_partner_id: 1, partner_name: 'Partner Co', location: 'USA' }]
        };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockPartners)
        });

        const result = await ctx.client.getShopProductionPartners('123');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/production-partners',
          expect.any(Object)
        );
        expect(result).toEqual(mockPartners.results);
      });
    });
  });

  describe('findShops', () => {
    it('should find shops by name', async () => {
      const mockShops = {
        count: 1,
        results: [{ shop_id: 789, shop_name: 'TestShop' }]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockShops)
      });

      const result = await ctx.client.findShops({ shop_name: 'TestShop' });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shops?shop_name=TestShop'),
        expect.any(Object)
      );
      expect(result).toEqual(mockShops.results);
    });

    it('should find shops with pagination', async () => {
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ count: 0, results: [] })
      });

      await ctx.client.findShops({ shop_name: 'Test', limit: 10, offset: 5 });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(ctx.mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=5'),
        expect.any(Object)
      );
    });
  });

  describe('getMe', () => {
    it('should get authenticated user', async () => {
      const mockUser = { user_id: 123, login_name: 'testuser' };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockUser)
      });

      const result = await ctx.client.getMe();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('User Addresses', () => {
    describe('getUserAddresses', () => {
      it('should get user addresses', async () => {
        const mockAddresses = {
          count: 1,
          results: [{ user_address_id: 1, name: 'Home', city: 'Portland' }]
        };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockAddresses)
        });

        const result = await ctx.client.getUserAddresses();

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/user/addresses',
          expect.any(Object)
        );
        expect(result).toEqual(mockAddresses.results);
      });
    });

    describe('getUserAddress', () => {
      it('should get a specific user address', async () => {
        const mockAddress = { user_address_id: 1, name: 'Home', city: 'Portland' };
        ctx.mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockAddress)
        });

        const result = await ctx.client.getUserAddress('1');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/user/addresses/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockAddress);
      });
    });

    describe('deleteUserAddress', () => {
      it('should delete a user address', async () => {
        ctx.mockFetch.mockResolvedValue(create204Response());

        const result = await ctx.client.deleteUserAddress('1');

        expect(ctx.mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/user/addresses/1',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined();
      });
    });
  });
});
