/**
 * Simple Shop Manager Example
 *
 * A basic CLI application demonstrating:
 * - Authentication
 * - Listing management
 * - Order retrieval
 * - Basic shop operations
 */

import {
  EtsyClient,
  FileTokenStorage,
  EtsyApiError
} from '@profplum700/etsy-v3-api-client';
import readline from 'readline';

class SimpleShopManager {
  private client: EtsyClient;
  private shopId: string | null = null;

  constructor() {
    const storage = new FileTokenStorage('./tokens.json');

    this.client = new EtsyClient(
      {
        apiKey: process.env.ETSY_API_KEY!,
        redirectUri: 'http://localhost:3000/callback',
        scopes: [
          'listings_r',
          'listings_w',
          'shops_r',
          'transactions_r'
        ]
      },
      storage
    );
  }

  async authenticate(): Promise<void> {
    const isAuth = await this.client.isAuthenticated();

    if (!isAuth) {
      console.log('\n=== Authentication Required ===');
      const authUrl = await this.client.getAuthorizationUrl();

      console.log('\n1. Visit this URL in your browser:');
      console.log(authUrl);
      console.log('\n2. After authorizing, you will be redirected to:');
      console.log('   http://localhost:3000/callback?code=...');
      console.log('\n3. Copy the "code" parameter from the URL');

      const code = await this.prompt('\nEnter the authorization code: ');

      await this.client.exchangeAuthorizationCode(code.trim());
      console.log('✓ Authentication successful!\n');
    }

    // Get shop ID
    const shop = await this.client.getShopByOwnerUserId();
    this.shopId = shop.shop_id.toString();
    console.log(`✓ Connected to shop: ${shop.shop_name} (ID: ${this.shopId})\n`);
  }

  async showMenu(): Promise<void> {
    console.log('=== Simple Shop Manager ===\n');
    console.log('1. View shop statistics');
    console.log('2. List active listings');
    console.log('3. List recent orders');
    console.log('4. Create a new listing');
    console.log('5. Update listing price');
    console.log('6. Deactivate a listing');
    console.log('7. Exit\n');

    const choice = await this.prompt('Select an option: ');

    switch (choice.trim()) {
      case '1':
        await this.showShopStats();
        break;
      case '2':
        await this.listActiveListings();
        break;
      case '3':
        await this.listRecentOrders();
        break;
      case '4':
        await this.createListing();
        break;
      case '5':
        await this.updateListingPrice();
        break;
      case '6':
        await this.deactivateListing();
        break;
      case '7':
        console.log('Goodbye!');
        process.exit(0);
      default:
        console.log('Invalid option\n');
    }

    await this.showMenu();
  }

  private async showShopStats(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Shop Statistics ===\n');

    try {
      const [active, draft, receipts] = await Promise.all([
        this.client.getListingsByShop(this.shopId, { state: 'active', limit: 1 }),
        this.client.getListingsByShop(this.shopId, { state: 'draft', limit: 1 }),
        this.client.getShopReceipts(this.shopId, { was_paid: true, limit: 1 })
      ]);

      console.log(`Active Listings: ${active.count}`);
      console.log(`Draft Listings: ${draft.count}`);
      console.log(`Total Orders: ${receipts.count}\n`);
    } catch (error) {
      console.error('Error fetching stats:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async listActiveListings(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Active Listings ===\n');

    try {
      const listings = await this.client.getListingsByShop(this.shopId, {
        state: 'active',
        limit: 10
      });

      if (listings.results.length === 0) {
        console.log('No active listings found.\n');
        return;
      }

      listings.results.forEach((listing, index) => {
        console.log(`${index + 1}. [${listing.listing_id}] ${listing.title}`);
        console.log(`   Price: $${listing.price.amount} | Quantity: ${listing.quantity}`);
      });

      console.log(`\nShowing ${listings.results.length} of ${listings.count} listings\n`);
    } catch (error) {
      console.error('Error fetching listings:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async listRecentOrders(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Recent Orders ===\n');

    try {
      const receipts = await this.client.getShopReceipts(this.shopId, {
        was_paid: true,
        limit: 10
      });

      if (receipts.results.length === 0) {
        console.log('No orders found.\n');
        return;
      }

      receipts.results.forEach((receipt, index) => {
        console.log(`${index + 1}. Order #${receipt.receipt_id}`);
        console.log(`   Customer: ${receipt.name}`);
        console.log(`   Total: $${receipt.grandtotal.amount}`);
        console.log(`   Paid: ${receipt.was_paid ? 'Yes' : 'No'} | Shipped: ${receipt.was_shipped ? 'Yes' : 'No'}`);
      });

      console.log(`\nShowing ${receipts.results.length} of ${receipts.count} orders\n`);
    } catch (error) {
      console.error('Error fetching orders:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async createListing(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Create New Listing ===\n');

    try {
      const title = await this.prompt('Title: ');
      const description = await this.prompt('Description: ');
      const price = parseFloat(await this.prompt('Price: $'));
      const quantity = parseInt(await this.prompt('Quantity: '));

      // For simplicity, using hardcoded values for required fields
      // In a real app, you'd prompt for these or have them configured
      const listing = await this.client.createDraftListing(this.shopId, {
        quantity,
        title,
        description,
        price,
        who_made: 'i_did',
        when_made: 'made_to_order',
        taxonomy_id: 1, // You'd need to select proper taxonomy
        type: 'physical'
      });

      console.log(`\n✓ Draft listing created! ID: ${listing.listing_id}`);
      console.log('  Note: Listing is in draft state. Update to "active" to publish.\n');
    } catch (error) {
      console.error('Error creating listing:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async updateListingPrice(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Update Listing Price ===\n');

    try {
      const listingId = await this.prompt('Listing ID: ');
      const newPrice = parseFloat(await this.prompt('New Price: $'));

      await this.client.updateListing(this.shopId, listingId, {
        price: newPrice
      });

      console.log(`\n✓ Price updated successfully!\n`);
    } catch (error) {
      console.error('Error updating price:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async deactivateListing(): Promise<void> {
    if (!this.shopId) return;

    console.log('\n=== Deactivate Listing ===\n');

    try {
      const listingId = await this.prompt('Listing ID: ');

      await this.client.updateListing(this.shopId, listingId, {
        state: 'inactive'
      });

      console.log(`\n✓ Listing deactivated successfully!\n`);
    } catch (error) {
      console.error('Error deactivating listing:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.showMenu();
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run the application
if (require.main === module) {
  const manager = new SimpleShopManager();
  manager.run();
}
