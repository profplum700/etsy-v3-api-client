import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import { getClient } from '../utils/client.js';
import { formatError, formatSuccess } from '../utils/format.js';

export const imagesCommand = new Command('images')
  .description('Manage listing images')
  .addCommand(
    new Command('upload')
      .description('Upload an image to a listing')
      .argument('<shopId>', 'Shop ID')
      .argument('<listingId>', 'Listing ID')
      .argument('<imagePath>', 'Path to image file')
      .option('-r, --rank <number>', 'Image rank (1-10)', '1')
      .option('--overwrite', 'Overwrite existing image at this rank')
      .action(async (shopId, listingId, imagePath, options) => {
        const spinner = ora('Uploading image...').start();

        try {
          // Read the image file
          const imageBuffer = await fs.readFile(imagePath);

          const client = await getClient();
          const result = await client.uploadListingImage(
            shopId,
            listingId,
            imageBuffer,
            {
              rank: parseInt(options.rank, 10),
              overwrite: options.overwrite
            }
          );

          spinner.succeed('Image uploaded');
          console.log(formatSuccess(`Image uploaded with ID: ${result.listing_image_id}`));
        } catch (error) {
          spinner.fail('Failed to upload image');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('Delete a listing image')
      .argument('<shopId>', 'Shop ID')
      .argument('<listingId>', 'Listing ID')
      .argument('<imageId>', 'Image ID')
      .option('-y, --yes', 'Skip confirmation')
      .action(async (shopId, listingId, imageId, options) => {
        if (!options.yes) {
          console.log(chalk.yellow('Warning: This will permanently delete the image'));
          console.log(chalk.gray('Use --yes to skip this confirmation'));
          process.exit(0);
        }

        const spinner = ora('Deleting image...').start();

        try {
          const client = await getClient();
          await client.deleteListingImage(shopId, listingId, imageId);

          spinner.succeed('Image deleted');
          console.log(formatSuccess(`Image ${imageId} has been deleted`));
        } catch (error) {
          spinner.fail('Failed to delete image');
          console.error(formatError(error as Error));
          process.exit(1);
        }
      })
  );
