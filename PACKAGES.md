# Etsy v3 API Client - Packages

This monorepo contains multiple packages for working with the Etsy v3 API.

## Core Package

### [@profplum700/etsy-v3-api-client](.)

The core API client library with zero production dependencies.

```bash
npm install @profplum700/etsy-v3-api-client
```

**Features:**
- 70+ API endpoints
- OAuth 2.0 PKCE authentication
- Automatic token refresh
- Rate limiting
- Response caching
- TypeScript support
- Browser and Node.js support

[Documentation](./README.md)

## Integration Packages

### [@profplum700/etsy-react](./packages/etsy-react)

React hooks for the Etsy API.

```bash
npm install @profplum700/etsy-react
```

**Features:**
- `useShop`, `useListings`, `useReceipts` hooks
- Mutation hooks for updates
- Automatic loading and error states
- Pagination support
- Refetch capabilities

[Documentation](./packages/etsy-react/README.md)

### [@profplum700/etsy-nextjs](./packages/etsy-nextjs)

Next.js integration with Server Components support.

```bash
npm install @profplum700/etsy-nextjs
```

**Features:**
- Server Components support
- API route helpers
- Cookie-based token storage
- Built-in rate limiting
- Caching support
- Edge Runtime compatibility

[Documentation](./packages/etsy-nextjs/README.md)

### [@profplum700/etsy-cli](./packages/etsy-cli)

Command-line tool for the Etsy API.

```bash
npm install -g @profplum700/etsy-cli
```

**Features:**
- Shop management
- Listing operations
- Order fulfillment
- Image upload
- Bulk operations
- JSON export

[Documentation](./packages/etsy-cli/README.md)

### [@profplum700/etsy-admin-ui](./packages/etsy-admin-ui)

Pre-built admin dashboard components.

```bash
npm install @profplum700/etsy-admin-ui
```

**Features:**
- `ShopDashboard` component
- `ListingManager` component
- `OrderFulfillment` component
- `InventoryTracker` component
- Responsive design
- Customizable styling

[Documentation](./packages/etsy-admin-ui/README.md)

## Quick Start

### Using with React

```tsx
import { EtsyProvider, useShop, useListings } from '@profplum700/etsy-react';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({ apiKey: 'your-key' });

function App() {
  return (
    <EtsyProvider client={client}>
      <Dashboard />
    </EtsyProvider>
  );
}

function Dashboard() {
  const { data: shop } = useShop('123');
  const { data: listings } = useListings('123');

  return (
    <div>
      <h1>{shop?.title}</h1>
      <ul>
        {listings?.map(listing => (
          <li key={listing.listing_id}>{listing.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Using with Next.js

```tsx
// app/shop/[id]/page.tsx
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export default async function ShopPage({ params }) {
  const client = await getEtsyServerClient();
  const shop = await client.getShop(params.id);

  return <div>{shop.title}</div>;
}
```

### Using the CLI

```bash
# Configure
etsy auth configure

# Get shop details
etsy shops get YOUR_SHOP_ID

# List active listings
etsy listings list YOUR_SHOP_ID --state active

# View unpaid orders
etsy receipts list YOUR_SHOP_ID --unpaid
```

### Using Admin UI

```tsx
import {
  Layout,
  ShopDashboard,
  ListingManager,
  OrderFulfillment
} from '@profplum700/etsy-admin-ui';

function AdminApp() {
  return (
    <Layout>
      <ShopDashboard shopId="123" />
      <ListingManager shopId="123" />
      <OrderFulfillment shopId="123" />
    </Layout>
  );
}
```

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm run build
```

### Build Specific Package

```bash
# Core package
pnpm run build:core

# All integration packages
pnpm run build:packages

# Specific package
pnpm --filter @profplum700/etsy-react run build
```

### Run Tests

```bash
# All tests
pnpm run test

# Core tests only
pnpm run test:core

# Package tests only
pnpm run test:packages
```

### Lint

```bash
# Lint all
pnpm run lint

# Fix all
pnpm run lint:fix
```

### Type Check

```bash
pnpm run type-check
```

### Clean Build Artifacts

```bash
pnpm run clean
```

## Publishing

Each package is published independently to npm under the `@profplum700` scope.

```bash
# Publish all packages
pnpm --filter '@profplum700/*' publish

# Publish specific package
cd packages/etsy-react
pnpm publish
```

## Version Management

All packages follow semantic versioning:

- **Core package**: `@profplum700/etsy-v3-api-client`
- **Integration packages**: Follow the same major version as core

Current version: **2.3.0** (Phase 3 - Ecosystem Integration)

## Package Dependencies

```
@profplum700/etsy-v3-api-client (core)
├── @profplum700/etsy-react (depends on core)
├── @profplum700/etsy-nextjs (depends on core)
├── @profplum700/etsy-cli (depends on core)
└── @profplum700/etsy-admin-ui (depends on core + react)
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for upcoming features and planned enhancements.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](./LICENSE) for details.

## Support

- Issues: https://github.com/profplum700/etsy-v3-api-client/issues
- Documentation: https://github.com/profplum700/etsy-v3-api-client
- Etsy API Documentation: https://developers.etsy.com/documentation
