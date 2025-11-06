/**
 * Inventory Sync Example
 *
 * Demonstrates real-time inventory synchronization
 * between Etsy and external inventory management systems
 */

import { EtsyClient, FileTokenStorage } from '@profplum700/etsy-v3-api-client';

interface InventoryItem {
  sku: string;
  quantity: number;
  price?: number;
}

class InventorySyncService {
  private client: EtsyClient;
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;

    const storage = new FileTokenStorage('./tokens.json');
    this.client = new EtsyClient(
      {
        apiKey: process.env.ETSY_API_KEY!,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['listings_r', 'listings_w', 'shops_r']
      },
      storage
    );
  }

  /**
   * Sync inventory from external system to Etsy
   */
  async syncToEtsy(inventoryData: InventoryItem[]): Promise<void> {
    console.log(`Syncing ${inventoryData.length} items to Etsy...`);

    for (const item of inventoryData) {
      await this.updateListingBySKU(item.sku, item.quantity, item.price);
    }

    console.log('Sync complete');
  }

  /**
   * Sync inventory from Etsy to external system
   */
  async syncFromEtsy(): Promise<InventoryItem[]> {
    console.log('Fetching inventory from Etsy...');

    const listings = await this.getAllListings();
    const inventory: InventoryItem[] = [];

    for (const listing of listings) {
      const inv = await this.client.getListingInventory(
        listing.listing_id.toString()
      );

      for (const product of inv.products) {
        inventory.push({
          sku: product.sku || '',
          quantity: product.offerings[0]?.quantity || 0,
          price: product.offerings[0]?.price.amount
        });
      }
    }

    console.log(`Fetched ${inventory.length} inventory items`);

    return inventory;
  }

  /**
   * Update listing by SKU
   */
  private async updateListingBySKU(
    sku: string,
    quantity: number,
    price?: number
  ): Promise<void> {
    const listing = await this.findListingBySKU(sku);

    if (!listing) {
      console.log(`No listing found for SKU: ${sku}`);
      return;
    }

    const updates: any = {};

    if (quantity !== undefined) {
      updates.quantity = quantity;
    }

    if (price !== undefined) {
      updates.price = price;
    }

    await this.client.updateListing(
      this.shopId,
      listing.listing_id.toString(),
      updates
    );

    console.log(`Updated ${sku}: quantity=${quantity}, price=${price}`);
  }

  /**
   * Find listing by SKU
   */
  private async findListingBySKU(sku: string): Promise<any | null> {
    const listings = await this.getAllListings();

    for (const listing of listings) {
      const inv = await this.client.getListingInventory(
        listing.listing_id.toString()
      );

      for (const product of inv.products) {
        if (product.sku === sku) {
          return listing;
        }
      }
    }

    return null;
  }

  /**
   * Get all active listings
   */
  private async getAllListings(): Promise<any[]> {
    const listings: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await this.client.getListingsByShop(this.shopId, {
        state: 'active',
        limit,
        offset
      });

      listings.push(...response.results);

      if (response.results.length < limit) break;
      offset += limit;
    }

    return listings;
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(intervalMs: number = 5 * 60 * 1000): void {
    console.log(`Starting periodic sync every ${intervalMs / 1000}s`);

    setInterval(async () => {
      try {
        // Fetch from external system (placeholder)
        const externalInventory = await this.fetchExternalInventory();

        // Sync to Etsy
        await this.syncToEtsy(externalInventory);
      } catch (error) {
        console.error('Sync error:', error);
      }
    }, intervalMs);
  }

  /**
   * Placeholder - integrate with your inventory system
   */
  private async fetchExternalInventory(): Promise<InventoryItem[]> {
    // Replace with actual API call to your inventory system
    return [];
  }
}

// Example usage
async function main() {
  const shopId = process.env.ETSY_SHOP_ID!;
  const sync = new InventorySyncService(shopId);

  // One-time sync
  const etsyInventory = await sync.syncFromEtsy();
  console.log('Etsy inventory:', etsyInventory);

  // Periodic sync
  sync.startPeriodicSync(5 * 60 * 1000); // Every 5 minutes
}

if (require.main === module) {
  main().catch(console.error);
}

export { InventorySyncService };
