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
  AuthHelper,
  EtsyClient,
  EtsyApiError,
  FileTokenStorage
} from '@profplum700/etsy-v3-api-client';
import 'dotenv/config';
import readline from 'readline';

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = ['listings_r', 'listings_w', 'shops_r', 'transactions_r'];

class SimpleShopManager {
  private client!: EtsyClient;
  private shopId = '';
  private readonly storage = new FileTokenStorage('./tokens.json');
  private readonly keystring = process.env.ETSY_API_KEY ?? '';
  private readonly sharedSecret = process.env.ETSY_SHARED_SECRET ?? '';

  async authenticate(): Promise<void> {
    if (!this.keystring || !this.sharedSecret) {
      throw new Error('Set ETSY_API_KEY and ETSY_SHARED_SECRET (see README).');
    }

    const stored = await this.storage.load();

    if (stored) {
      this.client = this.createClient(stored.access_token, stored.refresh_token, stored.expires_at);
    } else {
      console.log('\n=== Authentication Required ===');
      const authHelper = new AuthHelper({
        keystring: this.keystring,
        redirectUri: REDIRECT_URI,
        scopes: SCOPES
      });

      console.log('\n1. Visit this URL in your browser:');
      console.log(await authHelper.getAuthUrl());
      console.log(`\n2. After authorizing, you will be redirected to ${REDIRECT_URI}?code=...&state=...`);

      const redirected = await this.prompt('\n3. Paste the full redirect URL: ');
      const params = new URL(redirected.trim()).searchParams;
      await authHelper.setAuthorizationCode(params.get('code') ?? '', params.get('state') ?? '');

      const tokens = await authHelper.getAccessToken();
      await this.storage.save(tokens);
      this.client = this.createClient(tokens.access_token, tokens.refresh_token, tokens.expires_at);
      console.log('Authentication successful!\n');
    }

    const user = await this.client.getUser();
    if (!user.shop_id) {
      throw new Error('This Etsy account does not own a shop.');
    }
    this.shopId = user.shop_id.toString();

    const shop = await this.client.getShop(this.shopId);
    console.log(`Connected to shop: ${shop.shop_name} (ID: ${this.shopId})\n`);
  }

  private createClient(accessToken: string, refreshToken: string, expiresAt: Date): EtsyClient {
    return new EtsyClient({
      keystring: this.keystring,
      sharedSecret: this.sharedSecret,
      accessToken,
      refreshToken,
      expiresAt,
      refreshSaveAsync: (access, refresh, expires) =>
        this.storage.save({
          access_token: access,
          refresh_token: refresh,
          expires_at: expires,
          token_type: 'Bearer',
          scope: SCOPES.join(' ')
        })
    });
  }

  async showMenu(): Promise<void> {
    console.log('=== Simple Shop Manager ===\n');
    console.log('1. View shop statistics');
    console.log('2. List active listings');
    console.log('3. List recent orders');
    console.log('4. Create a new listing');
    console.log('5. Update listing title');
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
        await this.updateListingTitle();
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
    console.log('\n=== Shop Statistics (up to 100 each) ===\n');

    try {
      const [active, draft, receipts] = await Promise.all([
        this.client.getListingsByShop(this.shopId, { state: 'active', limit: 100 }),
        this.client.getListingsByShop(this.shopId, { state: 'draft', limit: 100 }),
        this.client.getShopReceipts(this.shopId, { was_paid: true, limit: 100 })
      ]);

      console.log(`Active Listings: ${active.length}`);
      console.log(`Draft Listings: ${draft.length}`);
      console.log(`Paid Orders: ${receipts.length}\n`);
    } catch (error) {
      console.error('Error fetching stats:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async listActiveListings(): Promise<void> {
    console.log('\n=== Active Listings ===\n');

    try {
      const listings = await this.client.getListingsByShop(this.shopId, {
        state: 'active',
        limit: 10
      });

      if (listings.length === 0) {
        console.log('No active listings found.\n');
        return;
      }

      listings.forEach((listing, index) => {
        console.log(`${index + 1}. [${listing.listing_id}] ${listing.title}`);
        console.log(`   Price: ${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`);
      });

      console.log(`\nShowing ${listings.length} listings\n`);
    } catch (error) {
      console.error('Error fetching listings:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async listRecentOrders(): Promise<void> {
    console.log('\n=== Recent Orders ===\n');

    try {
      const receipts = await this.client.getShopReceipts(this.shopId, {
        was_paid: true,
        limit: 10
      });

      if (receipts.length === 0) {
        console.log('No orders found.\n');
        return;
      }

      receipts.forEach((receipt, index) => {
        console.log(`${index + 1}. Order #${receipt.receipt_id}`);
        console.log(`   Customer: ${receipt.name}`);
        console.log(`   Total: ${receipt.grandtotal.amount / receipt.grandtotal.divisor} ${receipt.grandtotal.currency_code}`);
        console.log(`   Status: ${receipt.status} | Shipped: ${receipt.is_shipped ? 'Yes' : 'No'}`);
      });

      console.log(`\nShowing ${receipts.length} orders\n`);
    } catch (error) {
      console.error('Error fetching orders:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async createListing(): Promise<void> {
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

  private async updateListingTitle(): Promise<void> {
    console.log('\n=== Update Listing Title ===\n');

    try {
      const listingId = await this.prompt('Listing ID: ');
      const title = await this.prompt('New title: ');

      await this.client.updateListing(this.shopId, listingId, {
        title
      });

      console.log(`\n✓ Title updated successfully!\n`);
    } catch (error) {
      console.error('Error updating title:', error instanceof EtsyApiError ? error.message : error);
    }
  }

  private async deactivateListing(): Promise<void> {
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
const manager = new SimpleShopManager();
manager.run();
