import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../utils/client.js';
import { formatTable, formatJson, formatError } from '../utils/format.js';

export const receiptsCommand = new Command('receipts')
  .description('Manage receipts')
  .addCommand(
    new Command('list')
      .description('List shop receipts')
      .argument('<shopId>', 'Shop ID')
      .option('--paid', 'Show only paid receipts')
      .option('--unpaid', 'Show only unpaid receipts')
      .option('--shipped', 'Show only shipped receipts')
      .option('--unshipped', 'Show only unshipped receipts')
      .option('-l, --limit <number>', 'Number of receipts to fetch', '25')
      .option('-j, --json', 'Output as JSON')
      .action(async (shopId, options) => {
        const spinner = ora('Fetching receipts...').start();

        try {
          const client = await getClient();
          const response = await client.getShopReceipts(shopId, {
            is_paid: options.paid ? true : options.unpaid ? false : undefined,
            is_shipped: options.shipped ? true : options.unshipped ? false : undefined,
            limit: parseInt(options.limit, 10),
          });

          spinner.succeed(`Found ${response.count} receipts`);

          if (options.json) {
            console.log(formatJson(response.results));
          } else {
            if (response.results.length === 0) {
              console.log(chalk.yellow('\nNo receipts found'));
            } else {
              console.log(formatTable(
                ['Receipt ID', 'Buyer', 'Total', 'Paid', 'Shipped', 'Created'],
                response.results.map(receipt => [
                  receipt.receipt_id.toString(),
                  receipt.name || 'N/A',
                  `${receipt.grandtotal.amount / receipt.grandtotal.divisor} ${receipt.grandtotal.currency_code}`,
                  receipt.is_paid ? '✓' : '✗',
                  receipt.is_shipped ? '✓' : '✗',
                  new Date(receipt.create_timestamp * 1000).toLocaleDateString(),
                ])
              ));

              if (response.count > response.results.length) {
                console.log(chalk.gray(`\nShowing ${response.results.length} of ${response.count} receipts`));
              }
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch receipts');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('Get receipt details')
      .argument('<shopId>', 'Shop ID')
      .argument('<receiptId>', 'Receipt ID')
      .option('-j, --json', 'Output as JSON')
      .action(async (shopId, receiptId, options) => {
        const spinner = ora('Fetching receipt details...').start();

        try {
          const client = await getClient();
          const receipt = await client.getShopReceipt(shopId, receiptId);

          spinner.succeed('Receipt details fetched');

          if (options.json) {
            console.log(formatJson(receipt));
          } else {
            console.log(chalk.bold(`\nReceipt #${receipt.receipt_id}\n`));
            console.log(formatTable(
              ['Property', 'Value'],
              [
                ['Receipt ID', receipt.receipt_id.toString()],
                ['Buyer', receipt.name || 'N/A'],
                ['Total', `${receipt.grandtotal.amount / receipt.grandtotal.divisor} ${receipt.grandtotal.currency_code}`],
                ['Paid', receipt.is_paid ? 'Yes' : 'No'],
                ['Shipped', receipt.is_shipped ? 'Yes' : 'No'],
                ['Created', new Date(receipt.create_timestamp * 1000).toLocaleString()],
              ]
            ));

            if (receipt.message_from_buyer) {
              console.log(chalk.bold('\nMessage from buyer:'));
              console.log(receipt.message_from_buyer);
            }
          }
        } catch (error) {
          spinner.fail('Failed to fetch receipt');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  );
