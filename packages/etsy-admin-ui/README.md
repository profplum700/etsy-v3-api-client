# @profplum700/etsy-admin-ui

Pre-built admin dashboard components for the Etsy v3 API. Build beautiful admin interfaces in minutes.

## Installation

```bash
npm install @profplum700/etsy-admin-ui @profplum700/etsy-react @profplum700/etsy-v3-api-client
```

## Features

- Pre-built dashboard components
- Responsive design
- TypeScript support
- Customizable styling
- Dark mode ready
- Zero dependencies (besides peer deps)

## Quick Start

```tsx
import React from 'react';
import { EtsyProvider } from '@profplum700/etsy-react';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import {
  Layout,
  ShopDashboard,
  ListingManager,
  OrderFulfillment,
  InventoryTracker,
} from '@profplum700/etsy-admin-ui';

// Import default styles (optional)
import '@profplum700/etsy-admin-ui/dist/styles/default.css';

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY,
});

function App() {
  return (
    <EtsyProvider client={client}>
      <Layout
        header={<h1>My Shop Admin</h1>}
        sidebar={
          <nav>
            <a href="#dashboard">Dashboard</a>
            <a href="#listings">Listings</a>
            <a href="#orders">Orders</a>
            <a href="#inventory">Inventory</a>
          </nav>
        }
      >
        <ShopDashboard shopId="123" />
        <ListingManager shopId="123" />
        <OrderFulfillment shopId="123" />
        <InventoryTracker shopId="123" />
      </Layout>
    </EtsyProvider>
  );
}
```

## Components

### `<Layout>`

Main layout container with header, sidebar, and footer support.

```tsx
<Layout
  header={<Header title="Shop Admin" />}
  sidebar={<Sidebar>{/* sidebar content */}</Sidebar>}
  footer={<footer>© 2025 My Shop</footer>}
>
  {/* main content */}
</Layout>
```

**Props:**
- `children` - Main content
- `header` - Header content
- `sidebar` - Sidebar content
- `footer` - Footer content
- `className` - Additional CSS classes

### `<ShopDashboard>`

Display shop overview with key statistics.

```tsx
<ShopDashboard
  shopId="123"
  onError={(error) => console.error(error)}
/>
```

**Props:**
- `shopId` (required) - The shop ID
- `className` - Additional CSS classes
- `onError` - Error callback

**Features:**
- Shop title and name
- Active listings count
- Currency information
- Shop status (open/vacation)
- Shop announcement
- Links to shop URL

### `<ListingManager>`

Manage shop listings with filtering and actions.

```tsx
<ListingManager
  shopId="123"
  onListingUpdate={(listing) => console.log('Updated:', listing)}
  onListingDelete={(id) => console.log('Deleted:', id)}
/>
```

**Props:**
- `shopId` (required) - The shop ID
- `className` - Additional CSS classes
- `onListingUpdate` - Callback when a listing is updated
- `onListingDelete` - Callback when a listing is deleted

**Features:**
- Filter by state (active, inactive, draft, expired)
- Grid view with images
- Quick activate/deactivate
- Delete listings
- Load more pagination
- Price and quantity display

### `<OrderFulfillment>`

Track and manage orders with fulfillment actions.

```tsx
<OrderFulfillment
  shopId="123"
  onOrderUpdate={(receipt) => console.log('Updated:', receipt)}
/>
```

**Props:**
- `shopId` (required) - The shop ID
- `className` - Additional CSS classes
- `onOrderUpdate` - Callback when an order is updated

**Features:**
- Filter by status (all, unpaid, unshipped)
- Order details display
- Buyer information
- Payment and shipping status
- Mark as paid/shipped actions
- Buyer messages
- Load more pagination

### `<InventoryTracker>`

Monitor inventory levels with low stock alerts.

```tsx
<InventoryTracker
  shopId="123"
  lowStockThreshold={5}
/>
```

**Props:**
- `shopId` (required) - The shop ID
- `className` - Additional CSS classes
- `lowStockThreshold` - Threshold for low stock warning (default: 5)

**Features:**
- Total inventory count
- In stock, low stock, and out of stock counts
- Low stock warnings
- Out of stock alerts
- Quick overview of inventory status

### Layout Components

#### `<Header>`

Pre-styled header component.

```tsx
<Header title="Shop Admin">
  <button>Settings</button>
</Header>
```

#### `<Sidebar>`

Sidebar container with navigation items.

```tsx
<Sidebar>
  <SidebarItem label="Dashboard" active />
  <SidebarItem label="Listings" onClick={() => navigate('/listings')} />
  <SidebarItem label="Orders" href="/orders" />
</Sidebar>
```

#### `<SidebarItem>`

Individual sidebar navigation item.

```tsx
<SidebarItem
  label="Dashboard"
  icon={<DashboardIcon />}
  active={true}
  onClick={() => {}}
  href="/dashboard"
/>
```

## Styling

### Using Default Styles

Import the default stylesheet:

```tsx
import '@profplum700/etsy-admin-ui/dist/styles/default.css';
```

### Custom Styling

All components use CSS classes with the `etsy-` prefix. You can override them:

```css
.etsy-shop-dashboard {
  background: #f5f5f5;
  border-radius: 8px;
}

.etsy-btn {
  background: #your-brand-color;
}

.etsy-stat-card {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
```

### CSS Variables

Customize the color scheme using CSS variables:

```css
:root {
  --etsy-primary: #f56400;
  --etsy-secondary: #222222;
  --etsy-success: #00a651;
  --etsy-warning: #f9a825;
  --etsy-danger: #d32f2f;
  --etsy-info: #2196f3;
}
```

### Dark Mode

Add dark mode support:

```css
[data-theme="dark"] {
  --etsy-bg: #1a1a1a;
  --etsy-bg-secondary: #2a2a2a;
  --etsy-text: #ffffff;
  --etsy-text-secondary: #b0b0b0;
  --etsy-border: #404040;
}
```

## Complete Example

```tsx
import React, { useState } from 'react';
import { EtsyProvider } from '@profplum700/etsy-react';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import {
  Layout,
  Header,
  Sidebar,
  SidebarItem,
  ShopDashboard,
  ListingManager,
  OrderFulfillment,
  InventoryTracker,
} from '@profplum700/etsy-admin-ui';
import '@profplum700/etsy-admin-ui/dist/styles/default.css';

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY,
});

function AdminApp() {
  const [activeView, setActiveView] = useState('dashboard');
  const shopId = 'YOUR_SHOP_ID';

  return (
    <EtsyProvider client={client}>
      <Layout
        header={
          <Header title="Shop Admin Dashboard">
            <button onClick={() => console.log('Settings')}>Settings</button>
          </Header>
        }
        sidebar={
          <Sidebar>
            <SidebarItem
              label="Dashboard"
              active={activeView === 'dashboard'}
              onClick={() => setActiveView('dashboard')}
            />
            <SidebarItem
              label="Listings"
              active={activeView === 'listings'}
              onClick={() => setActiveView('listings')}
            />
            <SidebarItem
              label="Orders"
              active={activeView === 'orders'}
              onClick={() => setActiveView('orders')}
            />
            <SidebarItem
              label="Inventory"
              active={activeView === 'inventory'}
              onClick={() => setActiveView('inventory')}
            />
          </Sidebar>
        }
      >
        {activeView === 'dashboard' && <ShopDashboard shopId={shopId} />}
        {activeView === 'listings' && <ListingManager shopId={shopId} />}
        {activeView === 'orders' && <OrderFulfillment shopId={shopId} />}
        {activeView === 'inventory' && <InventoryTracker shopId={shopId} />}
      </Layout>
    </EtsyProvider>
  );
}

export default AdminApp;
```

## TypeScript Support

All components are fully typed with TypeScript.

```typescript
import type {
  ShopDashboardProps,
  ListingManagerProps,
  OrderFulfillmentProps,
  InventoryTrackerProps,
  LayoutProps,
  HeaderProps,
  SidebarProps,
  SidebarItemProps,
} from '@profplum700/etsy-admin-ui';
```

## Responsive Design

All components are mobile-responsive and adapt to different screen sizes automatically.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Related Packages

- [@profplum700/etsy-v3-api-client](../etsy-v3-api-client) - Core API client
- [@profplum700/etsy-react](../etsy-react) - React hooks
- [@profplum700/etsy-nextjs](../etsy-nextjs) - Next.js integration
- [@profplum700/etsy-cli](../etsy-cli) - CLI tool

## Contributing

Contributions are welcome! Please see the main repository for guidelines.
