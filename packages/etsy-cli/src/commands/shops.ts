import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../utils/client.js';
import { formatTable, formatJson, formatError } from '../utils/format.js';

export const shopsCommand = new Command('shops')
  .description('Manage shops')
  .addCommand(
    new Command('get')
      .description('Get shop details')
      .argument('<shopId>', 'Shop ID')
      .option('-j, --json', 'Output as JSON')
      .action(async (shopId, options) => {
        const spinner = ora('Fetching shop details...').start();

        try {
          const client = await getClient();
          const shop = await client.getShop(shopId);

          spinner.succeed('Shop details fetched');

          if (options.json) {
            console.log(formatJson(shop));
          } else {
            console.log(chalk.bold(`\n${shop.title}\n`));
            console.log(formatTable(
              ['Property', 'Value'],
              [
                ['Shop ID', shop.shop_id.toString()],
                ['Name', shop.shop_name],
                ['Title', shop.title || 'N/A'],
                ['URL', shop.url],
                ['Currency', shop.currency_code],
                ['Listings', shop.listing_active_count.toString()],
              ]
            ));

            if (shop.announcement) {
              console.log(chalk.bold('\nAnnouncement:'));
              console.log(shop.announcement);
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch shop');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('sections')
      .description('List shop sections')
      .argument('<shopId>', 'Shop ID')
      .option('-j, --json', 'Output as JSON')
      .action(async (shopId, options) => {
        const spinner = ora('Fetching shop sections...').start();

        try {
          const client = await getClient();
          const sections = await client.getShopSections(shopId);

          spinner.succeed(`Found ${sections.length} sections`);

          if (options.json) {
            console.log(formatJson(sections));
          } else {
            if (sections.length === 0) {
              console.log(chalk.yellow('\nNo sections found'));
            } else {
              console.log(formatTable(
                ['Section ID', 'Title', 'Active Listings'],
                sections.map(section => [
                  section.shop_section_id.toString(),
                  section.title,
                  section.active_listing_count?.toString() || '0',
                ])
              ));
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch sections');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  );
