/**
 * Analytics Dashboard Example
 *
 * Demonstrates data collection and analysis for shop metrics
 */

import { EtsyClient, FileTokenStorage } from '@profplum700/etsy-v3-api-client';

interface ShopMetrics {
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  revenue: number;
  averageOrderValue: number;
  topSellingItems: Array<{ title: string; sales: number }>;
}

class AnalyticsDashboard {
  private client: EtsyClient;
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;

    const storage = new FileTokenStorage('./tokens.json');
    this.client = new EtsyClient(
      {
        apiKey: process.env.ETSY_API_KEY!,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['listings_r', 'shops_r', 'transactions_r']
      },
      storage
    );
  }

  /**
   * Collect comprehensive shop metrics
   */
  async collectMetrics(): Promise<ShopMetrics> {
    console.log('Collecting shop metrics...');

    const [listings, activeListings, receipts] = await Promise.all([
      this.client.getListingsByShop(this.shopId, { limit: 1 }),
      this.client.getListingsByShop(this.shopId, { state: 'active', limit: 1 }),
      this.getAllReceipts()
    ]);

    const revenue = receipts.reduce((sum, r) => sum + r.grandtotal.amount, 0);

    const metrics: ShopMetrics = {
      totalListings: listings.count,
      activeListings: activeListings.count,
      totalOrders: receipts.length,
      revenue,
      averageOrderValue: receipts.length > 0 ? revenue / receipts.length : 0,
      topSellingItems: await this.getTopSellingItems()
    };

    return metrics;
  }

  /**
   * Get top selling items
   */
  private async getTopSellingItems(): Promise<
    Array<{ title: string; sales: number }>
  > {
    const receipts = await this.getAllReceipts();
    const salesByListing = new Map<string, number>();

    for (const receipt of receipts) {
      const transactions = await this.client.getShopReceiptTransactionsByReceipt(
        this.shopId,
        receipt.receipt_id.toString()
      );

      for (const tx of transactions.results) {
        const key = tx.title;
        salesByListing.set(key, (salesByListing.get(key) || 0) + tx.quantity);
      }
    }

    return Array.from(salesByListing.entries())
      .map(([title, sales]) => ({ title, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }

  /**
   * Get all receipts
   */
  private async getAllReceipts(): Promise<any[]> {
    const receipts: any[] = [];
    let offset = 0;
    const limit = 100;

    while (receipts.length < 1000) {
      // Limit to last 1000 orders
      const response = await this.client.getShopReceipts(this.shopId, {
        was_paid: true,
        limit,
        offset
      });

      receipts.push(...response.results);

      if (response.results.length < limit) break;
      offset += limit;
    }

    return receipts;
  }

  /**
   * Generate report
   */
  async generateReport(): Promise<void> {
    const metrics = await this.collectMetrics();

    console.log('\n=== Shop Analytics Report ===\n');
    console.log(`Total Listings: ${metrics.totalListings}`);
    console.log(`Active Listings: ${metrics.activeListings}`);
    console.log(`Total Orders: ${metrics.totalOrders}`);
    console.log(`Revenue: $${metrics.revenue.toFixed(2)}`);
    console.log(
      `Average Order Value: $${metrics.averageOrderValue.toFixed(2)}`
    );

    console.log('\nTop Selling Items:');
    metrics.topSellingItems.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title} (${item.sales} sold)`);
    });

    console.log('\n');
  }
}

// Example usage
async function main() {
  const shopId = process.env.ETSY_SHOP_ID!;
  const dashboard = new AnalyticsDashboard(shopId);

  await dashboard.generateReport();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AnalyticsDashboard };
