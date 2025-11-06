# @profplum700/etsy-cli

Command-line tool for the Etsy v3 API. Manage your Etsy shop from the terminal with ease.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @profplum700/etsy-cli
```

### Local Installation

```bash
npm install @profplum700/etsy-cli
```

## Quick Start

### 1. Configure Your API Key

```bash
etsy auth configure
```

You'll be prompted to enter:
- Your Etsy API key
- Redirect URI (default: http://localhost:3000/oauth/callback)
- Scopes (default: listings_r,shops_r)

### 2. Check Authentication Status

```bash
etsy auth status
```

### 3. Start Using the CLI

```bash
# Get shop details
etsy shops get YOUR_SHOP_ID

# List active listings
etsy listings list YOUR_SHOP_ID --state active

# View receipts
etsy receipts list YOUR_SHOP_ID --unpaid
```

## Commands

### Authentication

#### `etsy auth configure`
Configure your API credentials.

```bash
etsy auth configure
```

#### `etsy auth status`
Check authentication status.

```bash
etsy auth status
```

### Shops

#### `etsy shops get <shopId>`
Get shop details.

```bash
etsy shops get 123456
etsy shops get 123456 --json
```

#### `etsy shops sections <shopId>`
List shop sections.

```bash
etsy shops sections 123456
etsy shops sections 123456 --json
```

### Listings

#### `etsy listings list <shopId>`
List shop listings.

```bash
etsy listings list 123456
etsy listings list 123456 --state active
etsy listings list 123456 --state active --limit 50
etsy listings list 123456 --json
```

Options:
- `-s, --state <state>` - Filter by state (active, inactive, draft, expired)
- `-l, --limit <number>` - Number of listings to fetch (default: 25)
- `-j, --json` - Output as JSON

#### `etsy listings get <listingId>`
Get listing details.

```bash
etsy listings get 987654321
etsy listings get 987654321 --json
```

#### `etsy listings delete <listingId>`
Delete a listing.

```bash
etsy listings delete 987654321 --yes
```

Options:
- `-y, --yes` - Skip confirmation prompt

### Receipts

#### `etsy receipts list <shopId>`
List shop receipts.

```bash
etsy receipts list 123456
etsy receipts list 123456 --unpaid
etsy receipts list 123456 --shipped
etsy receipts list 123456 --limit 50
etsy receipts list 123456 --json
```

Options:
- `--paid` - Show only paid receipts
- `--unpaid` - Show only unpaid receipts
- `--shipped` - Show only shipped receipts
- `--unshipped` - Show only unshipped receipts
- `-l, --limit <number>` - Number of receipts to fetch (default: 25)
- `-j, --json` - Output as JSON

#### `etsy receipts get <shopId> <receiptId>`
Get receipt details.

```bash
etsy receipts get 123456 789012345
etsy receipts get 123456 789012345 --json
```

### Images

#### `etsy images upload <shopId> <listingId> <imagePath>`
Upload an image to a listing.

```bash
etsy images upload 123456 987654321 ./product.jpg
etsy images upload 123456 987654321 ./product.jpg --rank 1
etsy images upload 123456 987654321 ./product.jpg --rank 1 --overwrite
```

Options:
- `-r, --rank <number>` - Image rank (1-10, default: 1)
- `--overwrite` - Overwrite existing image at this rank

#### `etsy images delete <shopId> <listingId> <imageId>`
Delete a listing image.

```bash
etsy images delete 123456 987654321 111222333 --yes
```

Options:
- `-y, --yes` - Skip confirmation prompt

## Configuration

The CLI stores configuration in `~/.etsy-cli/`:
- `config.json` - API credentials and settings
- `tokens.json` - OAuth tokens (if authenticated)

## Output Formats

### Table Format (Default)

The CLI outputs data in beautiful tables by default:

```
┌────────────┬─────────────┐
│ Property   │ Value       │
├────────────┼─────────────┤
│ Shop ID    │ 123456      │
│ Name       │ MyShop      │
│ Title      │ My Shop     │
└────────────┴─────────────┘
```

### JSON Format

Use the `--json` flag for machine-readable output:

```bash
etsy shops get 123456 --json
```

## Examples

### View Shop Statistics

```bash
etsy shops get YOUR_SHOP_ID
```

### List Active Listings

```bash
etsy listings list YOUR_SHOP_ID --state active --limit 100
```

### Find Unpaid Orders

```bash
etsy receipts list YOUR_SHOP_ID --unpaid
```

### Upload Product Images

```bash
etsy images upload YOUR_SHOP_ID LISTING_ID image1.jpg --rank 1
etsy images upload YOUR_SHOP_ID LISTING_ID image2.jpg --rank 2
etsy images upload YOUR_SHOP_ID LISTING_ID image3.jpg --rank 3
```

### Export Data as JSON

```bash
etsy listings list YOUR_SHOP_ID --json > listings.json
etsy receipts list YOUR_SHOP_ID --json > receipts.json
```

## Programmatic Usage

You can also use the CLI utilities in your Node.js applications:

```typescript
import { getClient, loadConfig } from '@profplum700/etsy-cli';

const client = await getClient();
const shop = await client.getShop('123456');
console.log(shop);
```

## Error Handling

The CLI provides clear error messages and suggestions:

```
✗ Error: API key not configured
ℹ Run `etsy auth configure` to set up your API key
```

## Exit Codes

- `0` - Success
- `1` - Error

## Requirements

- Node.js >= 20.0.0
- Active Etsy API key

## Getting an API Key

1. Go to https://www.etsy.com/developers/your-apps
2. Create a new app or use an existing one
3. Copy your API key (Keystring)
4. Run `etsy auth configure` and paste your key

## License

MIT

## Related Packages

- [@profplum700/etsy-v3-api-client](../etsy-v3-api-client) - Core API client
- [@profplum700/etsy-react](../etsy-react) - React hooks
- [@profplum700/etsy-nextjs](../etsy-nextjs) - Next.js integration
- [@profplum700/etsy-admin-ui](../etsy-admin-ui) - Admin dashboard components

## Contributing

Contributions are welcome! Please see the main repository for guidelines.

## Support

- Issues: https://github.com/profplum700/etsy-v3-api-client/issues
- Documentation: https://github.com/profplum700/etsy-v3-api-client
