import type { components, operations } from './generated/schema';
import type { EtsyShop, EtsyListing, FindActiveListingsByShopParams, UpdateListingParams } from '../src/types';

// These fixtures document selected compatibility boundaries, not complete equivalence.
const shop: components['schemas']['Shop'] = { shop_id: 123, shop_name: 'Example' };
const shopId: EtsyShop['shop_id'] = shop.shop_id!;
const query: operations['findAllActiveListingsByShop']['parameters']['query'] = { limit: 25, offset: 0, sort_on: 'price' };
const sdkQuery: FindActiveListingsByShopParams = query!;
const money: components['schemas']['Money'] = { amount: 3200, divisor: 100, currency_code: 'USD' };
const sdkMoney: EtsyListing['price'] = { amount: money.amount!, divisor: money.divisor!, currency_code: money.currency_code! };
const inventory: operations['getListingInventory']['parameters'] = { path: { listing_id: 123 }, query: { show_deleted: false, includes: 'Listing' } };
type Update = NonNullable<operations['updateListing']['requestBody']>['content']['application/x-www-form-urlencoded'];
const update: Update = { title: 'Example', tags: ['print'], state: 'active' };
// The spec permits null tags; the existing SDK does not. Preserve and record the mismatch.
// @ts-expect-error nullable spec tags cannot directly replace SDK tags
const incompatibleUpdate: UpdateListingParams = { tags: update.tags };
const sdkUpdate: UpdateListingParams = { title: update.title, tags: ['print'] };
// API path IDs are numbers; the existing SDK method intentionally takes strings.
// @ts-expect-error generated path identifiers are numeric
const wrongId: operations['getShop']['parameters']['path'] = { shop_id: '123' };
// @ts-expect-error invalid sort enum
const wrongSort: operations['findAllActiveListingsByShop']['parameters']['query'] = { sort_on: 'random' };
// @ts-expect-error money amount is numeric
const wrongMoney: components['schemas']['Money'] = { amount: '32' };
// @ts-expect-error tags must be an array
const wrongUpdate: Update = { tags: 'print' };
// @ts-expect-error required path identifier missing
const missingPath: operations['getShop']['parameters']['path'] = {};
void [shopId, sdkQuery, sdkMoney, inventory, sdkUpdate, incompatibleUpdate, wrongId, wrongSort, wrongMoney, wrongUpdate, missingPath];
