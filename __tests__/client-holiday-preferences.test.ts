/**
 * Holiday Preferences tests - get and update operations
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Holiday Preferences', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getHolidayPreferences', () => {
    it('should get all holiday preferences', async () => {
      const mockPreferences = {
        count: 2,
        results: [
          {
            shop_id: 123,
            holiday_id: 1,
            country_iso: 'US',
            is_working: false,
            holiday_name: 'Christmas'
          },
          {
            shop_id: 123,
            holiday_id: 2,
            country_iso: 'US',
            is_working: true,
            holiday_name: 'Thanksgiving'
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPreferences)
      });

      const result = await ctx.client.getHolidayPreferences('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/holiday-preferences',
        expect.any(Object)
      );
      expect(result).toEqual(mockPreferences.results);
    });
  });

  describe('updateHolidayPreferences', () => {
    it('should update a holiday preference', async () => {
      const mockPreference = {
        shop_id: 123,
        holiday_id: 1,
        country_iso: 'US',
        is_working: true,
        holiday_name: 'Christmas'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPreference)
      });

      const result = await ctx.client.updateHolidayPreferences('123', '1', {
        is_working: true
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/holiday-preferences/1',
        expect.objectContaining({
          method: 'PUT',
          body: 'is_working=true'
        })
      );
      expect(result).toEqual(mockPreference);
    });
  });
});
