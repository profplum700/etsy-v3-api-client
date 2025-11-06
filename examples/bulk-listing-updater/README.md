# Bulk Listing Updater Example

Demonstrates how to perform bulk operations on Etsy listings efficiently.

## Features

- Bulk price updates by percentage
- Bulk tag management
- Bulk state changes (activate/deactivate)
- CSV import for batch updates
- Progress tracking
- Result logging
- Rate limit handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
ETSY_API_KEY=your_api_key_here
```

3. Run:
```bash
npm start
```

## Usage Examples

### Update All Prices

```typescript
const updater = new BulkListingUpdater();
await updater.initialize();

// Increase all prices by 10%
await updater.updateAllPricesByPercentage(10);

// Decrease prices by 15%
await updater.updateAllPricesByPercentage(-15);
```

### Update Tags

```typescript
// Add tags to all listings containing "handmade"
await updater.bulkUpdateTags('handmade', ['artisan', 'custom', 'unique']);
```

### Activate Listings

```typescript
// Activate all draft listings
await updater.bulkChangeState('active');

// Deactivate specific listings
await updater.bulkChangeState('inactive', ['123', '456', '789']);
```

### CSV Import

Create a CSV file (`updates.csv`):

```csv
listing_id,title,price,quantity,state
1234567,New Title,29.99,10,active
2345678,,24.99,,active
3456789,,,5,
```

Then import:

```typescript
await updater.importFromCSV('./updates.csv');
```

## Output

Results are saved to JSON files with timestamps:
```
bulk-update-results-2025-01-06T12-30-45-123Z.json
```

Example output:
```json
[
  {
    "listingId": "1234567",
    "success": true
  },
  {
    "listingId": "2345678",
    "success": false,
    "error": "Invalid price"
  }
]
```

## Best Practices

1. **Test First**: Run on a few listings before bulk operations
2. **Rate Limiting**: Built-in 100ms delay between requests
3. **Error Handling**: Failed updates don't stop the batch
4. **Backup**: Export listings before major changes
5. **Results**: Always review result files

## Learning Points

- Pagination for large datasets
- Batch processing with progress tracking
- Rate limit compliance
- Error handling in bulk operations
- CSV import/export
- Idempotent operations
