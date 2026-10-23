# Simple Shop Manager Example

A basic CLI application demonstrating core Etsy API functionality.

## Features

- OAuth 2.0 PKCE authentication (`AuthHelper`)
- View shop statistics
- List active listings
- List recent orders
- Create new listings
- Update listing titles
- Deactivate listings

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env file
ETSY_API_KEY=your_api_key_here
ETSY_SHARED_SECRET=your_shared_secret_here
```

3. Run the application:
```bash
npm start
```

## Usage

1. On first run, the app prints an authorization URL
2. Visit it in your browser and approve access
3. Etsy redirects to `http://localhost:3000/callback?code=...&state=...` (the page will not load, which is expected)
4. Paste the full redirect URL into the CLI
5. Navigate the menu to perform various shop operations

## Code Structure

- `index.ts` - Main application logic
- Interactive CLI menu
- Tokens saved to `./tokens.json` and refreshed automatically (do not commit it)

## Learning Points

This example demonstrates:
- OAuth 2.0 PKCE flow with `AuthHelper`
- Token storage with `FileTokenStorage` and automatic refresh via `refreshSaveAsync`
- Basic CRUD operations on listings
- Error handling with EtsyApiError
- Limiting results with the `limit` parameter
- Shop statistics gathering

## Next Steps

- Add image upload functionality
- Implement bulk operations
- Add listing search/filter
- Export data to CSV
- Create automated reports
