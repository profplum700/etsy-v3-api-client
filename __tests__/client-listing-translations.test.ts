/**
 * Listing Translation tests - create, get, and update operations
 */

import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Listing Translations', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('createListingTranslation', () => {
    it('should create a listing translation', async () => {
      const mockTranslation = {
        listing_id: 789,
        language: 'fr',
        title: 'Titre du produit',
        description: 'Description du produit',
        tags: ['fait main', 'cadeau']
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslation)
      });

      const result = await ctx.client.createListingTranslation('123', '789', 'fr', {
        title: 'Titre du produit',
        description: 'Description du produit',
        tags: ['fait main', 'cadeau']
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/translations/fr',
        expect.objectContaining({
          method: 'POST',
          body: 'title=Titre+du+produit&description=Description+du+produit&tags=fait+main&tags=cadeau'
        })
      );
      expect(result).toEqual(mockTranslation);
    });

    it('should create a translation without tags', async () => {
      const mockTranslation = {
        listing_id: 789,
        language: 'de',
        title: 'Produkttitel',
        description: 'Produktbeschreibung',
        tags: []
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslation)
      });

      const result = await ctx.client.createListingTranslation('123', '789', 'de', {
        title: 'Produkttitel',
        description: 'Produktbeschreibung'
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/translations/de',
        expect.objectContaining({
          method: 'POST',
          body: 'title=Produkttitel&description=Produktbeschreibung'
        })
      );
      expect(result).toEqual(mockTranslation);
    });
  });

  describe('getListingTranslation', () => {
    it('should get a listing translation', async () => {
      const mockTranslation = {
        listing_id: 789,
        language: 'fr',
        title: 'Titre du produit',
        description: 'Description du produit',
        tags: ['fait main', 'cadeau']
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslation)
      });

      const result = await ctx.client.getListingTranslation('123', '789', 'fr');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/translations/fr',
        expect.any(Object)
      );
      expect(result).toEqual(mockTranslation);
    });
  });

  describe('updateListingTranslation', () => {
    it('should update a listing translation', async () => {
      const mockTranslation = {
        listing_id: 789,
        language: 'fr',
        title: 'Titre mis a jour',
        description: 'Description mise a jour',
        tags: ['nouveau', 'mis a jour']
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslation)
      });

      const result = await ctx.client.updateListingTranslation('123', '789', 'fr', {
        title: 'Titre mis a jour',
        description: 'Description mise a jour',
        tags: ['nouveau', 'mis a jour']
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/translations/fr',
        expect.objectContaining({
          method: 'PUT',
          body: 'title=Titre+mis+a+jour&description=Description+mise+a+jour&tags=nouveau&tags=mis+a+jour'
        })
      );
      expect(result).toEqual(mockTranslation);
    });
  });
});
