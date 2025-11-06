# Simple Shop Manager Example

A basic CLI application demonstrating core Etsy API functionality.

## Features

- Authentication flow
- View shop statistics
- List active listings
- List recent orders
- Create new listings
- Update listing prices
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
```

3. Run the application:
```bash
npm start
```

## Usage

1. On first run, you'll be prompted to authenticate
2. Visit the authorization URL in your browser
3. Copy the authorization code from the redirect URL
4. Paste it into the CLI
5. Navigate the menu to perform various shop operations

## Code Structure

- `index.ts` - Main application logic
- Interactive CLI menu
- Token storage in `./tokens.json`

## Learning Points

This example demonstrates:
- OAuth 2.0 authentication flow
- Token storage and reuse
- Basic CRUD operations on listings
- Error handling with EtsyApiError
- Pagination basics
- Shop statistics gathering

## Next Steps

- Add image upload functionality
- Implement bulk operations
- Add listing search/filter
- Export data to CSV
- Create automated reports
