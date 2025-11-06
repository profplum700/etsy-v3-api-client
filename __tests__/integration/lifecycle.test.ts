/**
 * Enhanced Integration Tests - Full Lifecycle Testing
 * Tests complete workflows from creation to deletion
 */

import { EtsyClient } from '../../src/client';
import { MemoryTokenStorage } from '../../src/auth/token-manager';

describe('Listing Lifecycle Integration Tests', () => {
  let client: EtsyClient;
  let mockFetch: jest.Mock;
  const TEST_SHOP_ID = '12345';

  beforeEach(() => {
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    const storage = new MemoryTokenStorage();
    storage.save({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3600000
    });

    client = new EtsyClient(
      {
        apiKey: 'test-key',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['listings_r', 'listings_w']
      },
      storage
    );
  });

  it('should complete full listing lifecycle: create -> update -> upload image -> activate -> delete', async () => {
    const listingId = '9876543210';

    // Step 1: Create draft listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        listing_id: listingId,
        title: 'Test Product',
        state: 'draft',
        price: { amount: 19.99 },
        quantity: 10
      })
    });

    const listing = await client.createDraftListing(TEST_SHOP_ID, {
      quantity: 10,
      title: 'Test Product',
      description: 'Test description',
      price: 19.99,
      who_made: 'i_did',
      when_made: 'made_to_order',
      taxonomy_id: 1234,
      type: 'physical'
    });

    expect(listing.state).toBe('draft');
    expect(listing.listing_id.toString()).toBe(listingId);

    // Step 2: Update listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...listing,
        title: 'Updated Product',
        price: { amount: 24.99 }
      })
    });

    await client.updateListing(TEST_SHOP_ID, listingId, {
      title: 'Updated Product',
      price: 24.99
    });

    // Step 3: Upload image
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        listing_image_id: '111',
        url_fullxfull: 'https://example.com/image.jpg',
        rank: 1
      })
    });

    const imageBuffer = Buffer.from('fake-image-data');
    await client.uploadListingImage(TEST_SHOP_ID, listingId, imageBuffer, {
      rank: 1
    });

    // Step 4: Activate listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...listing,
        state: 'active'
      })
    });

    await client.updateListing(TEST_SHOP_ID, listingId, {
      state: 'active'
    });

    // Step 5: Verify active state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...listing,
        state: 'active'
      })
    });

    const activeListing = await client.getListing(listingId);
    expect(activeListing.state).toBe('active');

    // Step 6: Delete listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });

    await client.deleteListing(listingId);

    // Verify all API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('should handle order fulfillment workflow', async () => {
    const receiptId = '123456';

    // Step 1: Get receipt
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        receipt_id: receiptId,
        name: 'John Doe',
        buyer_email: 'john@example.com',
        was_paid: true,
        was_shipped: false,
        grandtotal: { amount: 49.99 }
      })
    });

    const receipt = await client.getShopReceipt(TEST_SHOP_ID, receiptId);
    expect(receipt.was_paid).toBe(true);
    expect(receipt.was_shipped).toBe(false);

    // Step 2: Get transactions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        count: 1,
        results: [
          {
            transaction_id: '789',
            title: 'Test Product',
            quantity: 2,
            price: { amount: 24.99 }
          }
        ]
      })
    });

    const transactions = await client.getShopReceiptTransactionsByReceipt(
      TEST_SHOP_ID,
      receiptId
    );

    expect(transactions.results.length).toBe(1);

    // Step 3: Add tracking
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        receipt_shipping_id: '999',
        tracking_code: '1Z999AA10123456784',
        carrier_name: 'ups'
      })
    });

    await client.createShopReceiptShipment(TEST_SHOP_ID, receiptId, {
      tracking_code: '1Z999AA10123456784',
      carrier_name: 'ups',
      send_bcc: true
    });

    // Step 4: Verify shipment
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        receipt_id: receiptId,
        was_paid: true,
        was_shipped: true
      })
    });

    const shippedReceipt = await client.getShopReceipt(TEST_SHOP_ID, receiptId);
    expect(shippedReceipt.was_shipped).toBe(true);
  });

  it('should handle inventory management workflow', async () => {
    const listingId = '555555';

    // Get inventory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            sku: 'TEST-001',
            offerings: [
              {
                price: { amount: 29.99 },
                quantity: 10,
                is_enabled: true
              }
            ]
          }
        ]
      })
    });

    const inventory = await client.getListingInventory(listingId);
    expect(inventory.products.length).toBe(1);

    // Update inventory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            sku: 'TEST-001',
            offerings: [
              {
                price: { amount: 34.99 },
                quantity: 15,
                is_enabled: true
              }
            ]
          }
        ]
      })
    });

    await client.updateListingInventory(listingId, {
      products: [
        {
          sku: 'TEST-001',
          offerings: [
            {
              price: 34.99,
              quantity: 15,
              is_enabled: true
            }
          ]
        }
      ]
    });
  });
});

describe('Shop Management Integration Tests', () => {
  let client: EtsyClient;
  let mockFetch: jest.Mock;
  const TEST_SHOP_ID = '12345';

  beforeEach(() => {
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    const storage = new MemoryTokenStorage();
    storage.save({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3600000
    });

    client = new EtsyClient(
      {
        apiKey: 'test-key',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['shops_r', 'shops_w']
      },
      storage
    );
  });

  it('should handle shipping profile workflow', async () => {
    // Create shipping profile
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        shipping_profile_id: '777',
        title: 'Standard Shipping',
        origin_country_iso: 'US',
        min_processing_days: 1,
        max_processing_days: 3
      })
    });

    const profile = await client.createShopShippingProfile(TEST_SHOP_ID, {
      title: 'Standard Shipping',
      origin_country_iso: 'US',
      min_processing_days: 1,
      max_processing_days: 3,
      processing_days_display_label: '1-3 business days',
      origin_postal_code: '12345'
    });

    expect(profile.shipping_profile_id.toString()).toBe('777');

    // Add destination
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        shipping_profile_destination_id: '888',
        primary_cost: { amount: 5.99 },
        secondary_cost: { amount: 2.0 }
      })
    });

    await client.createShopShippingProfileDestination(TEST_SHOP_ID, '777', {
      primary_cost: 5.99,
      secondary_cost: 2.0,
      destination_country_iso: 'US'
    });
  });
});
