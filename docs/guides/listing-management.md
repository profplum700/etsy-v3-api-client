# Listing Management Guide

This guide covers everything you need to know about managing Etsy listings with the API client.

## Table of Contents

- [Overview](#overview)
- [Getting Listings](#getting-listings)
- [Creating Listings](#creating-listings)
- [Updating Listings](#updating-listings)
- [Managing Images](#managing-images)
- [Inventory Management](#inventory-management)
- [Listing States](#listing-states)
- [Best Practices](#best-practices)

## Overview

Listings are the core of any Etsy shop. This guide will show you how to:
- Retrieve existing listings
- Create new listings
- Update listing details
- Manage listing images
- Handle inventory and variations
- Control listing states (draft, active, inactive)

## Getting Listings

### Get All Shop Listings

```typescript
const shopId = '12345';

// Get all active listings
const activeListings = await client.getListingsByShop(shopId, {
  state: 'active',
  limit: 100
});

console.log(`Found ${activeListings.count} active listings`);
activeListings.results.forEach(listing => {
  console.log(`${listing.listing_id}: ${listing.title} - $${listing.price.amount}`);
});
```

### Filter Listings

```typescript
// Get draft listings
const draftListings = await client.getListingsByShop(shopId, {
  state: 'draft',
  limit: 50
});

// Get inactive listings
const inactiveListings = await client.getListingsByShop(shopId, {
  state: 'inactive',
  limit: 50
});

// Get sold out listings
const soldOut = await client.getListingsByShop(shopId, {
  state: 'sold_out',
  limit: 50
});
```

### Pagination

```typescript
async function getAllListings(shopId: string) {
  const allListings = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await client.getListingsByShop(shopId, {
      state: 'active',
      limit,
      offset
    });

    allListings.push(...response.results);

    if (response.results.length < limit) {
      break; // No more results
    }

    offset += limit;
  }

  return allListings;
}

const allListings = await getAllListings(shopId);
console.log(`Total listings: ${allListings.length}`);
```

### Get Single Listing

```typescript
const listingId = '1234567890';

const listing = await client.getListing(listingId);
console.log('Listing:', {
  id: listing.listing_id,
  title: listing.title,
  price: listing.price.amount,
  quantity: listing.quantity,
  state: listing.state
});
```

## Creating Listings

### Create a Draft Listing

```typescript
const newListing = await client.createDraftListing(shopId, {
  quantity: 10,
  title: 'Handmade Ceramic Mug',
  description: 'Beautiful handcrafted ceramic mug, perfect for your morning coffee.',
  price: 24.99,
  who_made: 'i_did',
  when_made: 'made_to_order',
  taxonomy_id: 1234, // Category ID from Etsy taxonomy
  shipping_profile_id: 123456789, // Your shipping profile ID
  return_policy_id: 987654321, // Your return policy ID
  type: 'physical',
  is_customizable: true,
  tags: ['ceramic', 'mug', 'handmade', 'coffee', 'tea'],
  materials: ['ceramic', 'glaze'],
  production_partners: []
});

console.log('Created listing:', newListing.listing_id);
```

### Required Fields

When creating a listing, you must provide:

- `quantity`: Number of items available
- `title`: Listing title (max 140 characters)
- `description`: Detailed description
- `price`: Price in shop currency
- `who_made`: Who made the item
  - `i_did`: You made it
  - `someone_else`: Someone else made it
  - `collective`: Made by a collective
- `when_made`: When it was made
  - `made_to_order`: Made to order
  - `2020_2024`: Recent years
  - `2010_2019`: 2010-2019
  - Earlier periods
- `taxonomy_id`: Category from Etsy taxonomy
- `shipping_profile_id`: Shipping profile
- `type`: `physical` or `download`

### Get Taxonomy ID

```typescript
// Get the full taxonomy tree
const taxonomy = await client.getSellerTaxonomy();

// Find your category
function findCategory(nodes: any[], searchTerm: string): any[] {
  const results = [];

  for (const node of nodes) {
    if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      results.push(node);
    }
    if (node.children && node.children.length > 0) {
      results.push(...findCategory(node.children, searchTerm));
    }
  }

  return results;
}

const ceramicCategories = findCategory(taxonomy, 'ceramic');
ceramicCategories.forEach(cat => {
  console.log(`${cat.id}: ${cat.full_path_taxonomy_ids.join(' > ')}`);
  console.log(`   ${cat.name}`);
});
```

## Updating Listings

### Update Basic Information

```typescript
await client.updateListing(shopId, listingId, {
  title: 'Updated Title',
  description: 'Updated description',
  price: 29.99,
  quantity: 5
});

console.log('Listing updated');
```

### Update Tags and Materials

```typescript
await client.updateListing(shopId, listingId, {
  tags: ['new-tag', 'updated', 'ceramic', 'handmade'],
  materials: ['ceramic', 'porcelain', 'glaze']
});
```

### Change Listing State

```typescript
// Activate a draft listing
await client.updateListing(shopId, listingId, {
  state: 'active'
});

// Deactivate an active listing
await client.updateListing(shopId, listingId, {
  state: 'inactive'
});
```

### Bulk Update Example

```typescript
async function bulkUpdatePrices(
  shopId: string,
  priceIncrease: number
) {
  const listings = await client.getListingsByShop(shopId, {
    state: 'active',
    limit: 100
  });

  for (const listing of listings.results) {
    const newPrice = listing.price.amount * (1 + priceIncrease / 100);

    await client.updateListing(shopId, listing.listing_id.toString(), {
      price: Math.round(newPrice * 100) / 100
    });

    console.log(`Updated ${listing.title}: $${listing.price.amount} -> $${newPrice}`);

    // Rate limiting - wait 100ms between updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Increase all prices by 10%
await bulkUpdatePrices(shopId, 10);
```

## Managing Images

### Upload Listing Images

```typescript
import fs from 'fs';

// Upload a single image
const imageBuffer = fs.readFileSync('./product-image.jpg');

const uploadedImage = await client.uploadListingImage(
  shopId,
  listingId,
  imageBuffer,
  {
    rank: 1, // First image (1-10)
    alt_text: 'Handmade ceramic mug in blue glaze',
    is_watermarked: false
  }
);

console.log('Image uploaded:', uploadedImage.listing_image_id);
```

### Upload Multiple Images

```typescript
const images = [
  { path: './image1.jpg', rank: 1, alt: 'Main product view' },
  { path: './image2.jpg', rank: 2, alt: 'Side view' },
  { path: './image3.jpg', rank: 3, alt: 'Detail shot' }
];

for (const img of images) {
  const buffer = fs.readFileSync(img.path);

  await client.uploadListingImage(shopId, listingId, buffer, {
    rank: img.rank,
    alt_text: img.alt
  });

  console.log(`Uploaded image ${img.rank}`);

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

### Get Listing Images

```typescript
const images = await client.getListingImages(shopId, listingId);

images.results.forEach(img => {
  console.log(`Image ${img.rank}: ${img.url_fullxfull}`);
  console.log(`Alt text: ${img.alt_text}`);
});
```

### Delete Listing Image

```typescript
const imageId = '123456789';

await client.deleteListingImage(shopId, listingId, imageId);
console.log('Image deleted');
```

## Inventory Management

### Get Inventory

```typescript
const inventory = await client.getListingInventory(listingId);

console.log('Products:', inventory.products.length);
inventory.products.forEach(product => {
  console.log(`SKU: ${product.sku}`);
  console.log(`Offerings: ${product.offerings.length}`);

  product.offerings.forEach(offering => {
    console.log(`  Price: $${offering.price.amount}`);
    console.log(`  Quantity: ${offering.quantity}`);
  });
});
```

### Update Inventory

```typescript
// Simple inventory update (single product, no variations)
await client.updateListingInventory(listingId, {
  products: [{
    sku: 'MUG-001',
    offerings: [{
      price: 24.99,
      quantity: 10,
      is_enabled: true
    }]
  }]
});
```

### Variations (e.g., Size, Color)

```typescript
// Get listing with variations
const listing = await client.getListing(listingId);
const inventory = await client.getListingInventory(listingId);

// Update inventory with variations
await client.updateListingInventory(listingId, {
  products: [
    {
      sku: 'MUG-BLUE-SMALL',
      property_values: [
        { property_id: 200, values: ['Blue'] },
        { property_id: 100, values: ['Small'] }
      ],
      offerings: [{
        price: 24.99,
        quantity: 5,
        is_enabled: true
      }]
    },
    {
      sku: 'MUG-BLUE-LARGE',
      property_values: [
        { property_id: 200, values: ['Blue'] },
        { property_id: 100, values: ['Large'] }
      ],
      offerings: [{
        price: 29.99,
        quantity: 3,
        is_enabled: true
      }]
    }
  ],
  price_on_property: [200], // Price varies by color
  quantity_on_property: [100], // Quantity varies by size
  sku_on_property: [200, 100] // SKU includes both
});
```

## Listing States

### State Types

- `draft`: Listing is not published
- `active`: Listing is live and visible
- `inactive`: Listing is temporarily hidden
- `sold_out`: All inventory is sold
- `expired`: Listing has expired (auto-renew disabled)

### State Transitions

```typescript
// Draft -> Active
await client.updateListing(shopId, listingId, { state: 'active' });

// Active -> Inactive
await client.updateListing(shopId, listingId, { state: 'inactive' });

// Inactive -> Active
await client.updateListing(shopId, listingId, { state: 'active' });

// Any -> Draft (removes from shop)
await client.updateListing(shopId, listingId, { state: 'draft' });
```

### Delete Listing

```typescript
// Permanently delete a listing
await client.deleteListing(listingId);
console.log('Listing deleted');
```

## Best Practices

### 1. Use Draft State for New Listings

```typescript
// Create as draft first
const listing = await client.createDraftListing(shopId, {
  // ... listing details
});

// Upload images
await client.uploadListingImage(shopId, listing.listing_id.toString(), image1);
await client.uploadListingImage(shopId, listing.listing_id.toString(), image2);

// Activate when ready
await client.updateListing(shopId, listing.listing_id.toString(), {
  state: 'active'
});
```

### 2. Validate Before Creating

```typescript
function validateListing(data: any): string[] {
  const errors = [];

  if (!data.title || data.title.length > 140) {
    errors.push('Title must be 1-140 characters');
  }

  if (!data.description || data.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (data.price <= 0) {
    errors.push('Price must be positive');
  }

  if (data.quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (!data.tags || data.tags.length === 0) {
    errors.push('At least one tag is required');
  }

  if (data.tags && data.tags.length > 13) {
    errors.push('Maximum 13 tags allowed');
  }

  return errors;
}

// Use before creating
const errors = validateListing(listingData);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  return;
}

await client.createDraftListing(shopId, listingData);
```

### 3. Handle Rate Limiting

```typescript
async function updateListingsBatch(
  updates: Array<{ listingId: string; data: any }>
) {
  const results = [];

  for (const update of updates) {
    try {
      await client.updateListing(shopId, update.listingId, update.data);
      results.push({ success: true, listingId: update.listingId });
    } catch (error) {
      results.push({ success: false, listingId: update.listingId, error });
    }

    // Wait 100ms between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
```

### 4. SEO Optimization

```typescript
// Good listing title
const listing = await client.createDraftListing(shopId, {
  title: 'Handmade Ceramic Coffee Mug - Blue Glaze - 12oz - Pottery Gift',
  description: `
    Beautiful handcrafted ceramic coffee mug with a stunning blue glaze.

    FEATURES:
    • Hand-thrown on the pottery wheel
    • Food-safe glaze
    • Microwave and dishwasher safe
    • 12oz capacity
    • Each piece is unique

    DIMENSIONS:
    • Height: 4 inches
    • Diameter: 3.5 inches
    • Capacity: 12oz

    CARE INSTRUCTIONS:
    • Dishwasher safe
    • Microwave safe
    • Hand washing recommended for longevity

    Perfect gift for coffee lovers, tea enthusiasts, or pottery collectors!
  `,
  tags: [
    'ceramic mug',
    'handmade',
    'pottery',
    'coffee mug',
    'tea cup',
    'blue glaze',
    'artisan',
    'handthrown',
    'unique gift',
    'kitchenware'
  ],
  materials: ['ceramic', 'glaze', 'clay'],
  // ... other fields
});
```

### 5. Error Handling

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';

async function safeUpdateListing(
  shopId: string,
  listingId: string,
  updates: any
) {
  try {
    await client.updateListing(shopId, listingId, updates);
    return { success: true };
  } catch (error) {
    if (error instanceof EtsyApiError) {
      if (error.statusCode === 404) {
        return { success: false, error: 'Listing not found' };
      } else if (error.statusCode === 400) {
        return { success: false, error: 'Invalid update data' };
      } else if (error.statusCode === 403) {
        return { success: false, error: 'Permission denied' };
      }
    }
    return { success: false, error: error.message };
  }
}
```

## Complete Example

Here's a complete example of creating and managing a listing:

```typescript
async function createCompleteL listing(shopId: string) {
  // Step 1: Create draft listing
  const listing = await client.createDraftListing(shopId, {
    quantity: 10,
    title: 'Handmade Ceramic Mug - Blue Glaze',
    description: 'Beautiful handcrafted ceramic mug...',
    price: 24.99,
    who_made: 'i_did',
    when_made: 'made_to_order',
    taxonomy_id: 1234,
    shipping_profile_id: 123456789,
    return_policy_id: 987654321,
    type: 'physical',
    tags: ['ceramic', 'mug', 'handmade'],
    materials: ['ceramic', 'glaze']
  });

  console.log('Created draft listing:', listing.listing_id);

  // Step 2: Upload images
  const images = ['./img1.jpg', './img2.jpg', './img3.jpg'];
  for (let i = 0; i < images.length; i++) {
    const buffer = fs.readFileSync(images[i]);
    await client.uploadListingImage(
      shopId,
      listing.listing_id.toString(),
      buffer,
      { rank: i + 1 }
    );
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('Images uploaded');

  // Step 3: Activate listing
  await client.updateListing(shopId, listing.listing_id.toString(), {
    state: 'active'
  });

  console.log('Listing is now active!');

  return listing;
}
```

## Next Steps

- [Order Fulfillment](./order-fulfillment.md)
- [Shipping Profiles](./shipping-profiles.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
