/**
 * Bulk Listing Updater Example
 *
 * Demonstrates:
 * - Bulk price updates
 * - Bulk tag updates
 * - Bulk state changes
 * - Progress tracking
 * - Error handling for batch operations
 */

import {
  EtsyClient,
  FileTokenStorage,
  EtsyApiError
} from '@profplum700/etsy-v3-api-client';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

interface BulkUpdate {
  listingId: string;
  updates: any;
}

interface UpdateResult {
  listingId: string;
  success: boolean;
  error?: string;
}

class BulkListingUpdater {
  private client: EtsyClient;
  private shopId: string | null = null;

  constructor() {
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

  async initialize(): Promise<void> {
    const shop = await this.client.getShopByOwnerUserId();
    this.shopId = shop.shop_id.toString();
    console.log(`Connected to shop: ${shop.shop_name}\n`);
  }

  /**
   * Update prices for all active listings by a percentage
   */
  async updateAllPricesByPercentage(percentage: number): Promise<UpdateResult[]> {
    if (!this.shopId) throw new Error('Not initialized');

    console.log(`Updating all prices by ${percentage}%...\n`);

    const listings = await this.getAllActiveListings();
    const updates: BulkUpdate[] = [];

    for (const listing of listings) {
      const newPrice = listing.price.amount * (1 + percentage / 100);
      const roundedPrice = Math.round(newPrice * 100) / 100;

      updates.push({
        listingId: listing.listing_id.toString(),
        updates: { price: roundedPrice }
      });
    }

    return await this.executeBulkUpdates(updates);
  }

  /**
   * Update tags for all listings matching criteria
   */
  async bulkUpdateTags(
    searchTag: string,
    newTags: string[]
  ): Promise<UpdateResult[]> {
    if (!this.shopId) throw new Error('Not initialized');

    console.log(`Updating tags for listings with "${searchTag}"...\n`);

    const listings = await this.getAllActiveListings();
    const updates: BulkUpdate[] = [];

    for (const listing of listings) {
      const currentTags = listing.tags || [];

      if (currentTags.includes(searchTag)) {
        // Merge tags, ensuring no duplicates
        const mergedTags = [...new Set([...currentTags, ...newTags])];

        updates.push({
          listingId: listing.listing_id.toString(),
          updates: { tags: mergedTags.slice(0, 13) } // Max 13 tags
        });
      }
    }

    console.log(`Found ${updates.length} listings to update\n`);

    return await this.executeBulkUpdates(updates);
  }

  /**
   * Bulk activate/deactivate listings
   */
  async bulkChangeState(
    state: 'active' | 'inactive',
    listingIds?: string[]
  ): Promise<UpdateResult[]> {
    if (!this.shopId) throw new Error('Not initialized');

    let ids = listingIds;

    if (!ids) {
      // Get all draft listings to activate
      const listings = await this.client.getListingsByShop(this.shopId, {
        state: 'draft',
        limit: 100
      });

      ids = listings.results.map(l => l.listing_id.toString());
    }

    console.log(`Changing ${ids.length} listings to ${state}...\n`);

    const updates = ids.map(id => ({
      listingId: id,
      updates: { state }
    }));

    return await this.executeBulkUpdates(updates);
  }

  /**
   * Import updates from CSV
   */
  async importFromCSV(filePath: string): Promise<UpdateResult[]> {
    if (!this.shopId) throw new Error('Not initialized');

    console.log(`Importing updates from ${filePath}...\n`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    const updates: BulkUpdate[] = records.map((record: any) => ({
      listingId: record.listing_id,
      updates: {
        ...(record.title && { title: record.title }),
        ...(record.price && { price: parseFloat(record.price) }),
        ...(record.quantity && { quantity: parseInt(record.quantity) }),
        ...(record.state && { state: record.state })
      }
    }));

    console.log(`Loaded ${updates.length} updates from CSV\n`);

    return await this.executeBulkUpdates(updates);
  }

  /**
   * Execute bulk updates with progress tracking
   */
  private async executeBulkUpdates(
    updates: BulkUpdate[]
  ): Promise<UpdateResult[]> {
    if (!this.shopId) throw new Error('Not initialized');

    const results: UpdateResult[] = [];
    const total = updates.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;

    console.log(`Starting bulk update of ${total} listings...\n`);

    for (const update of updates) {
      try {
        await this.client.updateListing(
          this.shopId,
          update.listingId,
          update.updates
        );

        results.push({
          listingId: update.listingId,
          success: true
        });

        successful++;
      } catch (error) {
        const errorMessage =
          error instanceof EtsyApiError ? error.message : String(error);

        results.push({
          listingId: update.listingId,
          success: false,
          error: errorMessage
        });

        failed++;
      }

      completed++;

      // Progress update
      if (completed % 10 === 0 || completed === total) {
        console.log(
          `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`
        );
      }

      // Rate limiting - wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n=== Bulk Update Complete ===`);
    console.log(`Total: ${total}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}\n`);

    // Write results to file
    this.saveResults(results);

    return results;
  }

  /**
   * Get all active listings (with pagination)
   */
  private async getAllActiveListings(): Promise<any[]> {
    if (!this.shopId) throw new Error('Not initialized');

    const allListings: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await this.client.getListingsByShop(this.shopId, {
        state: 'active',
        limit,
        offset
      });

      allListings.push(...response.results);

      if (response.results.length < limit) {
        break;
      }

      offset += limit;

      console.log(`Fetched ${allListings.length} listings...`);
    }

    console.log(`Total active listings: ${allListings.length}\n`);

    return allListings;
  }

  /**
   * Save results to JSON file
   */
  private saveResults(results: UpdateResult[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bulk-update-results-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(results, null, 2));

    console.log(`Results saved to: ${filename}\n`);
  }
}

// Example usage
async function main() {
  const updater = new BulkListingUpdater();
  await updater.initialize();

  // Example 1: Increase all prices by 10%
  // await updater.updateAllPricesByPercentage(10);

  // Example 2: Add tags to listings
  // await updater.bulkUpdateTags('handmade', ['artisan', 'custom']);

  // Example 3: Activate all draft listings
  // await updater.bulkChangeState('active');

  // Example 4: Import from CSV
  // await updater.importFromCSV('./updates.csv');

  console.log('Uncomment examples in main() to use this tool');
}

if (require.main === module) {
  main().catch(console.error);
}

export { BulkListingUpdater };
