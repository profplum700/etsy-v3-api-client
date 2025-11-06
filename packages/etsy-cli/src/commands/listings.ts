import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../utils/client.js';
import { formatTable, formatJson, formatError, formatSuccess } from '../utils/format.js';

export const listingsCommand = new Command('listings')
  .description('Manage listings')
  .addCommand(
    new Command('list')
      .description('List shop listings')
      .argument('<shopId>', 'Shop ID')
      .option('-s, --state <state>', 'Filter by state (active, inactive, draft, expired)')
      .option('-l, --limit <number>', 'Number of listings to fetch', '25')
      .option('-j, --json', 'Output as JSON')
      .action(async (shopId, options) => {
        const spinner = ora('Fetching listings...').start();

        try {
          const client = await getClient();
          const response = await client.getListingsByShop(shopId, {
            state: options.state,
            limit: parseInt(options.limit, 10),
          });

          // Handle both array and paginated response
          const results = Array.isArray(response) ? response : (response as any).results || [];
          const count = Array.isArray(response) ? response.length : (response as any).count || 0;

          spinner.succeed(`Found ${count} listings`);

          if (options.json) {
            console.log(formatJson(results));
          } else {
            if (results.length === 0) {
              console.log(chalk.yellow('\nNo listings found'));
            } else {
              console.log(formatTable(
                ['Listing ID', 'Title', 'State', 'Price', 'Quantity'],
                results.map((listing: any) => [
                  listing.listing_id.toString(),
                  listing.title.substring(0, 40) + (listing.title.length > 40 ? '...' : ''),
                  listing.state,
                  `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`,
                  listing.quantity?.toString() || '0',
                ])
              ));

              if (count > results.length) {
                console.log(chalk.gray(`\nShowing ${results.length} of ${count} listings`));
              }
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch listings');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('Get listing details')
      .argument('<listingId>', 'Listing ID')
      .option('-j, --json', 'Output as JSON')
      .action(async (listingId, options) => {
        const spinner = ora('Fetching listing details...').start();

        try {
          const client = await getClient();
          const listing = await client.getListing(listingId);

          spinner.succeed('Listing details fetched');

          if (options.json) {
            console.log(formatJson(listing));
          } else {
            console.log(chalk.bold(`\n${listing.title}\n`));
            console.log(formatTable(
              ['Property', 'Value'],
              [
                ['Listing ID', listing.listing_id.toString()],
                ['State', listing.state],
                ['Price', `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`],
                ['Quantity', listing.quantity?.toString() || '0'],
                ['Views', listing.views?.toString() || '0'],
                ['Num Favorers', listing.num_favorers?.toString() || '0'],
              ]
            ));

            if (listing.description) {
              console.log(chalk.bold('\nDescription:'));
              console.log(listing.description.substring(0, 200) + (listing.description.length > 200 ? '...' : ''));
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch listing');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('Delete a listing')
      .argument('<listingId>', 'Listing ID')
      .option('-y, --yes', 'Skip confirmation')
      .action(async (listingId, options) => {
        if (!options.yes) {
          console.log(chalk.yellow('Warning: This will permanently delete the listing'));
          console.log(chalk.gray('Use --yes to skip this confirmation'));
          process.exit(0);
        }

        const spinner = ora('Deleting listing...').start();

        try {
          const client = await getClient();
          await client.deleteListing(listingId);

          spinner.succeed('Listing deleted');
          console.log(formatSuccess(`Listing ${listingId} has been deleted`));
        } catch (error) {
          spinner.fail('Failed to delete listing');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  );
