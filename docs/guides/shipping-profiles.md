# Shipping Profiles Guide

This guide covers how to manage shipping profiles for your Etsy shop.

## Table of Contents

- [Overview](#overview)
- [Getting Shipping Profiles](#getting-shipping-profiles)
- [Creating Shipping Profiles](#creating-shipping-profiles)
- [Updating Shipping Profiles](#updating-shipping-profiles)
- [Best Practices](#best-practices)

## Overview

Shipping profiles define how you ship items to different destinations. Each listing must be associated with a shipping profile.

Key concepts:
- **Shipping Profile**: Container for shipping destinations and pricing
- **Shipping Destination**: Countries/regions you ship to
- **Shipping Upgrade**: Premium shipping options (expedited, etc.)

## Getting Shipping Profiles

### Get All Shop Shipping Profiles

```typescript
const shopId = '12345';

const profiles = await client.getShopShippingProfiles(shopId);

profiles.results.forEach(profile => {
  console.log(`Profile: ${profile.title}`);
  console.log(`  ID: ${profile.shipping_profile_id}`);
  console.log(`  Destinations: ${profile.shipping_profile_destinations?.length || 0}`);
  console.log(`  Upgrades: ${profile.shipping_profile_upgrades?.length || 0}`);
});
```

### Get Specific Shipping Profile

```typescript
const profileId = '123456789';

const profile = await client.getShopShippingProfile(shopId, profileId);

console.log('Profile:', profile.title);
console.log('Processing time:', {
  min: profile.processing_days_display_label,
  max: profile.max_processing_days
});

// Get destinations
profile.shipping_profile_destinations?.forEach(dest => {
  console.log(`Destination: ${dest.destination_country_iso}`);
  console.log(`  Primary cost: $${dest.primary_cost.amount}`);
  console.log(`  Secondary cost: $${dest.secondary_cost.amount}`);
});
```

## Creating Shipping Profiles

### Create Basic Shipping Profile

```typescript
const newProfile = await client.createShopShippingProfile(shopId, {
  title: 'Standard Shipping',
  origin_country_iso: 'US',
  min_processing_days: 1,
  max_processing_days: 3,
  processing_days_display_label: '1-3 business days',
  origin_postal_code: '12345'
});

console.log('Created profile:', newProfile.shipping_profile_id);
```

### Add Shipping Destinations

```typescript
// Create domestic destination (US)
await client.createShopShippingProfileDestination(
  shopId,
  newProfile.shipping_profile_id.toString(),
  {
    primary_cost: 5.99,
    secondary_cost: 2.00,
    destination_country_iso: 'US',
    destination_region: 'none',
    shipping_carrier_id: 0,
    mail_class: 'priority'
  }
);

// Create international destination (Canada)
await client.createShopShippingProfileDestination(
  shopId,
  newProfile.shipping_profile_id.toString(),
  {
    primary_cost: 15.99,
    secondary_cost: 5.00,
    destination_country_iso: 'CA',
    destination_region: 'none'
  }
);

// Create destination for rest of world
await client.createShopShippingProfileDestination(
  shopId,
  newProfile.shipping_profile_id.toString(),
  {
    primary_cost: 25.00,
    secondary_cost: 8.00,
    destination_country_iso: 'none',
    destination_region: 'rest_of_world'
  }
);
```

### Add Shipping Upgrades

```typescript
// Add expedited shipping option
await client.createShopShippingProfileUpgrade(
  shopId,
  newProfile.shipping_profile_id.toString(),
  {
    upgrade_name: 'Express Shipping',
    type: 'express',
    price: 15.00,
    secondary_price: 5.00,
    shipping_carrier_id: 0,
    mail_class: 'express',
    min_delivery_days: 1,
    max_delivery_days: 2
  }
);
```

## Updating Shipping Profiles

### Update Profile Details

```typescript
await client.updateShopShippingProfile(shopId, profileId, {
  title: 'Updated Standard Shipping',
  min_processing_days: 1,
  max_processing_days: 5,
  processing_days_display_label: '1-5 business days'
});
```

### Update Destination

```typescript
const destinations = await client.getShopShippingProfile(shopId, profileId);
const destId = destinations.shipping_profile_destinations[0]
  .shipping_profile_destination_id;

await client.updateShopShippingProfileDestination(
  shopId,
  profileId,
  destId.toString(),
  {
    primary_cost: 6.99,  // Updated price
    secondary_cost: 2.50
  }
);
```

### Update Shipping Upgrade

```typescript
const profile = await client.getShopShippingProfile(shopId, profileId);
const upgradeId = profile.shipping_profile_upgrades[0]
  .shipping_profile_upgrade_id;

await client.updateShopShippingProfileUpgrade(
  shopId,
  profileId,
  upgradeId.toString(),
  {
    price: 17.99,  // Updated express price
    min_delivery_days: 1,
    max_delivery_days: 2
  }
);
```

## Best Practices

### 1. Create Reusable Profiles

```typescript
// Create profiles for different product types
const profiles = {
  small: await createShippingProfile('Small Items', 3.99, 1.00),
  medium: await createShippingProfile('Medium Items', 7.99, 3.00),
  large: await createShippingProfile('Large Items', 14.99, 7.00)
};

async function createShippingProfile(
  title: string,
  primaryCost: number,
  secondaryCost: number
) {
  const profile = await client.createShopShippingProfile(shopId, {
    title,
    origin_country_iso: 'US',
    min_processing_days: 1,
    max_processing_days: 3,
    processing_days_display_label: '1-3 business days',
    origin_postal_code: '12345'
  });

  await client.createShopShippingProfileDestination(
    shopId,
    profile.shipping_profile_id.toString(),
    {
      primary_cost: primaryCost,
      secondary_cost: secondaryCost,
      destination_country_iso: 'US'
    }
  );

  return profile;
}
```

### 2. Offer Multiple Shipping Options

```typescript
async function setupComprehensiveShipping(shopId: string) {
  const profile = await client.createShopShippingProfile(shopId, {
    title: 'Comprehensive Shipping',
    origin_country_iso: 'US',
    min_processing_days: 1,
    max_processing_days: 3,
    processing_days_display_label: '1-3 business days',
    origin_postal_code: '12345'
  });

  const profileId = profile.shipping_profile_id.toString();

  // Standard shipping
  await client.createShopShippingProfileDestination(shopId, profileId, {
    primary_cost: 5.99,
    secondary_cost: 2.00,
    destination_country_iso: 'US',
    mail_class: 'priority'
  });

  // Express upgrade
  await client.createShopShippingProfileUpgrade(shopId, profileId, {
    upgrade_name: 'Express (1-2 days)',
    type: 'express',
    price: 15.00,
    secondary_price: 5.00,
    min_delivery_days: 1,
    max_delivery_days: 2
  });

  // Next day upgrade
  await client.createShopShippingProfileUpgrade(shopId, profileId, {
    upgrade_name: 'Next Day',
    type: 'overnight',
    price: 25.00,
    secondary_price: 10.00,
    min_delivery_days: 1,
    max_delivery_days: 1
  });

  return profile;
}
```

### 3. International Shipping Strategy

```typescript
async function setupInternationalShipping(shopId: string, profileId: string) {
  // North America
  await client.createShopShippingProfileDestination(shopId, profileId, {
    primary_cost: 12.00,
    secondary_cost: 4.00,
    destination_country_iso: 'CA'
  });

  await client.createShopShippingProfileDestination(shopId, profileId, {
    primary_cost: 15.00,
    secondary_cost: 5.00,
    destination_country_iso: 'MX'
  });

  // Europe
  await client.createShopShippingProfileDestination(shopId, profileId, {
    primary_cost: 18.00,
    secondary_cost: 6.00,
    destination_country_iso: 'none',
    destination_region: 'eu'
  });

  // Rest of world
  await client.createShopShippingProfileDestination(shopId, profileId, {
    primary_cost: 25.00,
    secondary_cost: 10.00,
    destination_country_iso: 'none',
    destination_region: 'rest_of_world'
  });
}
```

### 4. Free Shipping Promotion

```typescript
async function createFreeShippingProfile(shopId: string) {
  const profile = await client.createShopShippingProfile(shopId, {
    title: 'Free Shipping',
    origin_country_iso: 'US',
    min_processing_days: 3,
    max_processing_days: 7,
    processing_days_display_label: '3-7 business days',
    origin_postal_code: '12345'
  });

  await client.createShopShippingProfileDestination(
    shopId,
    profile.shipping_profile_id.toString(),
    {
      primary_cost: 0,    // Free!
      secondary_cost: 0,  // Free for additional items too
      destination_country_iso: 'US'
    }
  );

  return profile;
}
```

### 5. Calculated Shipping

For calculated shipping based on weight/dimensions, you'll need to update per listing:

```typescript
// Set shipping profile for listing
await client.updateListing(shopId, listingId, {
  shipping_profile_id: profileId
});

// Note: Actual calculated shipping requires integration
// with carrier APIs (USPS, UPS, FedEx) separately
```

## Complete Example

```typescript
async function setupCompleteShippingStrategy(shopId: string) {
  // Profile 1: Small/Light items with free shipping
  const freeShipping = await client.createShopShippingProfile(shopId, {
    title: 'Free Standard Shipping',
    origin_country_iso: 'US',
    min_processing_days: 3,
    max_processing_days: 7,
    processing_days_display_label: '3-7 business days',
    origin_postal_code: '12345'
  });

  await client.createShopShippingProfileDestination(
    shopId,
    freeShipping.shipping_profile_id.toString(),
    {
      primary_cost: 0,
      secondary_cost: 0,
      destination_country_iso: 'US'
    }
  );

  // Profile 2: Standard items
  const standard = await client.createShopShippingProfile(shopId, {
    title: 'Standard Shipping',
    origin_country_iso: 'US',
    min_processing_days: 1,
    max_processing_days: 3,
    processing_days_display_label: '1-3 business days',
    origin_postal_code: '12345'
  });

  const standardId = standard.shipping_profile_id.toString();

  // Domestic
  await client.createShopShippingProfileDestination(shopId, standardId, {
    primary_cost: 7.99,
    secondary_cost: 3.00,
    destination_country_iso: 'US'
  });

  // International
  await client.createShopShippingProfileDestination(shopId, standardId, {
    primary_cost: 18.00,
    secondary_cost: 8.00,
    destination_country_iso: 'none',
    destination_region: 'rest_of_world'
  });

  // Add express upgrade
  await client.createShopShippingProfileUpgrade(shopId, standardId, {
    upgrade_name: 'Express Shipping',
    type: 'express',
    price: 15.00,
    secondary_price: 5.00,
    min_delivery_days: 1,
    max_delivery_days: 2
  });

  return { freeShipping, standard };
}
```

## Next Steps

- [Listing Management](./listing-management.md)
- [Order Fulfillment](./order-fulfillment.md)
- [API Reference](../api-reference/README.md)
