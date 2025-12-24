/**
 * Unit tests for EtsyClient v2.0.0 endpoints
 * Tests for Shop Management, Listing Operations, Orders, Shipping, Payments, etc.
 */

import { EtsyClient } from '../src/client';
import { EtsyClientConfig } from '../src/types';
import { TokenManager } from '../src/auth/token-manager';
import { EtsyRateLimiter } from '../src/rate-limiting';

// Mock dependencies
jest.mock('../src/auth/token-manager');
jest.mock('../src/rate-limiting');

describe('EtsyClient v2.0.0 - New Endpoints', () => {
  let mockConfig: EtsyClientConfig;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockRateLimiter: jest.Mocked<EtsyRateLimiter>;
  let mockFetch: jest.Mock;
  let client: EtsyClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      keystring: 'test-api-key',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      baseUrl: 'https://api.etsy.com/v3/application'
    };

    mockTokenManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      getCurrentTokens: jest.fn().mockReturnValue({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      }),
      isTokenExpired: jest.fn().mockReturnValue(false),
      refreshToken: jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      })
    } as unknown as jest.Mocked<TokenManager>;

    mockRateLimiter = {
      waitForRateLimit: jest.fn().mockResolvedValue(undefined),
      getRemainingRequests: jest.fn().mockReturnValue(9999),
      getRateLimitStatus: jest.fn().mockReturnValue({
        remainingRequests: 9999,
        resetTime: new Date(Date.now() + 86400000),
        canMakeRequest: true,
        isFromHeaders: false
      }),
      canMakeRequest: jest.fn().mockReturnValue(true),
      updateFromHeaders: jest.fn(),
      resetRetryCount: jest.fn(),
      handleRateLimitResponse: jest.fn().mockResolvedValue({ shouldRetry: false, delayMs: 1000 }),
      setApproachingLimitCallback: jest.fn(),
      setWarningThreshold: jest.fn()
    } as unknown as jest.Mocked<EtsyRateLimiter>;

    mockFetch = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

    (TokenManager as jest.Mock).mockImplementation(() => mockTokenManager);
    (EtsyRateLimiter as jest.Mock).mockImplementation(() => mockRateLimiter);

    client = new EtsyClient(mockConfig);
  });

  // ============================================================================
  // Shop Management Tests
  // ============================================================================

  describe('Shop Management', () => {
    describe('updateShop', () => {
      it('should update shop settings', async () => {
        const mockShop = { shop_id: 123, title: 'Updated Title' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShop)
        });

        const result = await client.updateShop('123', { title: 'Updated Title' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ title: 'Updated Title' })
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShop)
        });

        const result = await client.updateShop('123', updateParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(updateParams)
          })
        );
        expect(result).toEqual(mockShop);
      });
    });

    describe('createShopSection', () => {
      it('should create a new shop section', async () => {
        const mockSection = { shop_section_id: 456, title: 'New Section' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockSection)
        });

        const result = await client.createShopSection('123', { title: 'New Section' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ title: 'New Section' })
          })
        );
        expect(result).toEqual(mockSection);
      });
    });

    describe('updateShopSection', () => {
      it('should update a shop section', async () => {
        const mockSection = { shop_section_id: 456, title: 'Updated Section' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockSection)
        });

        const result = await client.updateShopSection('123', '456', { title: 'Updated Section' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections/456',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ title: 'Updated Section' })
          })
        );
        expect(result).toEqual(mockSection);
      });
    });

    describe('deleteShopSection', () => {
      it('should delete a shop section with 204 No Content response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' })
        });

        const result = await client.deleteShopSection('123', '456');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/sections/456',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined(); // 204 responses return undefined
      });
    });
  });

  // ============================================================================
  // Listing Write Operations Tests
  // ============================================================================

  describe('Listing Write Operations', () => {
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockListing)
        });

        const result = await client.createDraftListing('123', listingParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(listingParams)
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockListing)
        });

        const result = await client.createDraftListing('123', listingParams);

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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockListing)
        });

        const result = await client.updateListing('123', '789', updateParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(updateParams)
          })
        );
        expect(result).toEqual(mockListing);
      });

      it('should update listing state', async () => {
        const mockListing = { listing_id: 789, state: 'active' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockListing)
        });

        const result = await client.updateListing('123', '789', { state: 'active' });

        expect(result.state).toBe('active');
      });
    });

    describe('deleteListing', () => {
      it('should delete a listing with 204 No Content response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' })
        });

        const result = await client.deleteListing('789');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/listings/789',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined(); // 204 responses return undefined
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockInventory)
        });

        const result = await client.updateListingInventory('789', inventoryParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/listings/789/inventory',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(inventoryParams)
          })
        );
        expect(result).toEqual(mockInventory);
      });
    });
  });

  // ============================================================================
  // Listing Image Tests
  // ============================================================================

  describe('Listing Image Management', () => {
    describe('uploadListingImage', () => {
      it('should upload a listing image', async () => {
        const mockImage = { listing_image_id: 999, url_fullxfull: 'https://example.com/image.jpg' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
        const result = await client.uploadListingImage('123', '789', blob);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/images',
          expect.objectContaining({ method: 'POST' })
        );
        expect(result).toEqual(mockImage);
      });

      it('should upload image with metadata', async () => {
        const mockImage = { listing_image_id: 999, alt_text: 'Test alt text' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
        const result = await client.uploadListingImage('123', '789', blob, {
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockImage)
        });

        const result = await client.getListingImage('123', '789', '999');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/images/999',
          expect.any(Object)
        );
        expect(result).toEqual(mockImage);
      });
    });

    describe('deleteListingImage', () => {
      it('should delete a listing image with 204 No Content response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' })
        });

        const result = await client.deleteListingImage('123', '789', '999');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/images/999',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined(); // 204 responses return undefined
      });
    });
  });

  // ============================================================================
  // Shop Receipts/Orders Tests
  // ============================================================================

  describe('Shop Receipts/Orders', () => {
    describe('getShopReceipts', () => {
      it('should get shop receipts', async () => {
        const mockReceipts = {
          count: 2,
          results: [
            { receipt_id: 1, status: 'completed' },
            { receipt_id: 2, status: 'open' }
          ]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockReceipts)
        });

        const result = await client.getShopReceipts('123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/shops/123/receipts'),
          expect.any(Object)
        );
        expect(result).toEqual(mockReceipts.results);
      });

      it('should get receipts with filters', async () => {
        const mockReceipts = { count: 1, results: [{ receipt_id: 1, status: 'completed' }] };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockReceipts)
        });

        const result = await client.getShopReceipts('123', {
          was_paid: true,
          was_shipped: true,
          limit: 10
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('was_paid=true'),
          expect.any(Object)
        );
        expect(result).toEqual(mockReceipts.results);
      });
    });

    describe('getShopReceipt', () => {
      it('should get a specific receipt', async () => {
        const mockReceipt = { receipt_id: 1, status: 'completed' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockReceipt)
        });

        const result = await client.getShopReceipt('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockReceipt);
      });
    });

    describe('updateShopReceipt', () => {
      it('should update a receipt', async () => {
        const mockReceipt = { receipt_id: 1, was_shipped: true };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockReceipt)
        });

        const result = await client.updateShopReceipt('123', '1', { was_shipped: true });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/1',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ was_shipped: true })
          })
        );
        expect(result).toEqual(mockReceipt);
      });
    });

    describe('getShopReceiptTransactions', () => {
      it('should get receipt transactions', async () => {
        const mockTransactions = {
          count: 2,
          results: [
            { transaction_id: 1, title: 'Item 1' },
            { transaction_id: 2, title: 'Item 2' }
          ]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockTransactions)
        });

        const result = await client.getShopReceiptTransactions('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/1/transactions',
          expect.any(Object)
        );
        expect(result).toEqual(mockTransactions.results);
      });
    });

    describe('getShopTransaction', () => {
      it('should get a specific transaction', async () => {
        const mockTransaction = { transaction_id: 1, title: 'Item 1' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockTransaction)
        });

        const result = await client.getShopTransaction('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/transactions/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockTransaction);
      });
    });
  });

  // ============================================================================
  // Shipping Profile Tests
  // ============================================================================

  describe('Shipping Profiles', () => {
    describe('getShopShippingProfiles', () => {
      it('should get all shipping profiles', async () => {
        const mockProfiles = {
          count: 2,
          results: [
            { shipping_profile_id: 1, title: 'Standard' },
            { shipping_profile_id: 2, title: 'Express' }
          ]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProfiles)
        });

        const result = await client.getShopShippingProfiles('123');

        expect(mockFetch).toHaveBeenCalledWith(
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
          min_processing_days: 1,
          max_processing_days: 3
        };
        const mockProfile = { shipping_profile_id: 1, ...profileParams };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProfile)
        });

        const result = await client.createShopShippingProfile('123', profileParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(profileParams)
          })
        );
        expect(result).toEqual(mockProfile);
      });
    });

    describe('updateShopShippingProfile', () => {
      it('should update a shipping profile', async () => {
        const mockProfile = { shipping_profile_id: 1, title: 'Updated Title' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProfile)
        });

        const result = await client.updateShopShippingProfile('123', '1', {
          title: 'Updated Title'
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1',
          expect.objectContaining({ method: 'PUT' })
        );
        expect(result).toEqual(mockProfile);
      });
    });

    describe('deleteShopShippingProfile', () => {
      it('should delete a shipping profile with 204 No Content response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' })
        });

        const result = await client.deleteShopShippingProfile('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined(); // 204 responses return undefined
      });
    });

    describe('Shipping Profile Destinations', () => {
      it('should get profile destinations', async () => {
        const mockDestinations = {
          count: 1,
          results: [{ shipping_profile_destination_id: 1, destination_country_iso: 'US' }]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockDestinations)
        });

        const result = await client.getShopShippingProfileDestinations('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockDest)
        });

        const result = await client.createShopShippingProfileDestination('123', '1', destParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/destinations',
          expect.objectContaining({ method: 'POST' })
        );
        expect(result).toEqual(mockDest);
      });

      it('should delete a destination with 204 No Content response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' })
        });

        const result = await client.deleteShopShippingProfileDestination('123', '1', '999');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/destinations/999',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(result).toBeUndefined(); // 204 responses return undefined
      });
    });

    describe('getShopShippingProfileUpgrades', () => {
      it('should get profile upgrades', async () => {
        const mockUpgrades = {
          count: 1,
          results: [{ upgrade_id: 1, upgrade_name: 'Express' }]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUpgrades)
        });

        const result = await client.getShopShippingProfileUpgrades('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/shipping-profiles/1/upgrades',
          expect.any(Object)
        );
        expect(result).toEqual(mockUpgrades.results);
      });
    });
  });

  // ============================================================================
  // Fulfillment/Shipment Tests
  // ============================================================================

  describe('Fulfillment/Shipment', () => {
    describe('createReceiptShipment', () => {
      it('should create a receipt shipment', async () => {
        const shipmentParams = {
          tracking_code: '1Z999AA10123456784',
          carrier_name: 'UPS'
        };
        const mockShipment = { receipt_shipping_id: 1, ...shipmentParams };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShipment)
        });

        const result = await client.createReceiptShipment('123', '456', shipmentParams);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/456/tracking',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(shipmentParams)
          })
        );
        expect(result).toEqual(mockShipment);
      });

      it('should create shipment with optional params', async () => {
        const shipmentParams = {
          tracking_code: '1Z999AA10123456784',
          carrier_name: 'UPS',
          send_bcc: true,
          note_to_buyer: 'Your package is on the way!'
        };
        const mockShipment = { receipt_shipping_id: 1, ...shipmentParams };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShipment)
        });

        const result = await client.createReceiptShipment('123', '456', shipmentParams);

        expect(result).toEqual(mockShipment);
      });
    });

    describe('getShopReceiptShipments', () => {
      it('should get receipt shipments', async () => {
        const mockShipments = {
          count: 1,
          results: [{ receipt_shipping_id: 1, tracking_code: '123456' }]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShipments)
        });

        const result = await client.getShopReceiptShipments('123', '456');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/receipts/456/shipments',
          expect.any(Object)
        );
        expect(result).toEqual(mockShipments.results);
      });
    });
  });

  // ============================================================================
  // Payment & Ledger Tests
  // ============================================================================

  describe('Payment & Ledger', () => {
    describe('getShopPaymentAccountLedgerEntries', () => {
      it('should get ledger entries', async () => {
        const mockEntries = {
          count: 2,
          results: [
            { entry_id: 1, amount: { amount: 2999, divisor: 100, currency_code: 'USD' } },
            { entry_id: 2, amount: { amount: 1999, divisor: 100, currency_code: 'USD' } }
          ]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockEntries)
        });

        const result = await client.getShopPaymentAccountLedgerEntries('123', {
          min_created: 1609459200,
          max_created: 1640995200
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/shops/123/payment-account/ledger-entries'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('min_created=1609459200'),
          expect.any(Object)
        );
        expect(result).toEqual(mockEntries.results);
      });

      it('should get ledger entries with pagination', async () => {
        const mockEntries = { count: 10, results: [] };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockEntries)
        });

        await client.getShopPaymentAccountLedgerEntries('123', {
          min_created: 1609459200,
          max_created: 1640995200,
          limit: 25,
          offset: 50
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=25'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=50'),
          expect.any(Object)
        );
      });
    });

    describe('getShopPaymentAccountLedgerEntry', () => {
      it('should get a specific ledger entry', async () => {
        const mockEntry = { entry_id: 1, amount: { amount: 2999, divisor: 100, currency_code: 'USD' } };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockEntry)
        });

        const result = await client.getShopPaymentAccountLedgerEntry('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/payment-account/ledger-entries/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockEntry);
      });
    });

    describe('getShopPayment', () => {
      it('should get payment details', async () => {
        const mockPayment = {
          payment_id: 1,
          amount_gross: { amount: 2999, divisor: 100, currency_code: 'USD' }
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockPayment)
        });

        const result = await client.getShopPayment('123', '1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/payment-account/payments/1',
          expect.any(Object)
        );
        expect(result).toEqual(mockPayment);
      });
    });
  });

  // ============================================================================
  // Extended Taxonomy Tests
  // ============================================================================

  describe('Extended Taxonomy', () => {
    describe('getBuyerTaxonomyNodes', () => {
      it('should get buyer taxonomy nodes', async () => {
        const mockNodes = {
          count: 2,
          results: [
            { id: 1, name: 'Art', level: 0, children: [] },
            { id: 2, name: 'Jewelry', level: 0, children: [] }
          ]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockNodes)
        });

        const result = await client.getBuyerTaxonomyNodes();

        expect(mockFetch).toHaveBeenCalledWith(
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
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProperties)
        });

        const result = await client.getPropertiesByTaxonomyId(123);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/seller-taxonomy/nodes/123/properties',
          expect.any(Object)
        );
        expect(result).toEqual(mockProperties.results);
      });
    });

    describe('getListingProperties', () => {
      it('should get listing properties', async () => {
        const mockProperties = {
          count: 1,
          results: [{ property_id: 1, name: 'color', display_name: 'Color' }]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProperties)
        });

        const result = await client.getListingProperties('123', '789');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/listings/789/properties',
          expect.any(Object)
        );
        expect(result).toEqual(mockProperties.results);
      });
    });
  });

  // ============================================================================
  // Production Partners Tests
  // ============================================================================

  describe('Production Partners', () => {
    describe('getShopProductionPartners', () => {
      it('should get shop production partners', async () => {
        const mockPartners = {
          count: 1,
          results: [{ production_partner_id: 1, partner_name: 'Partner Co', location: 'USA' }]
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockPartners)
        });

        const result = await client.getShopProductionPartners('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.etsy.com/v3/application/shops/123/production-partners',
          expect.any(Object)
        );
        expect(result).toEqual(mockPartners.results);
      });
    });
  });
});
