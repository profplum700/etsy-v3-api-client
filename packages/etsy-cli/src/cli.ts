#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { shopsCommand } from './commands/shops.js';
import { listingsCommand } from './commands/listings.js';
import { receiptsCommand } from './commands/receipts.js';
import { imagesCommand } from './commands/images.js';

const program = new Command();

program
  .name('etsy')
  .description('CLI tool for Etsy v3 API')
  .version('2.3.0');

// Add commands
program.addCommand(authCommand);
program.addCommand(shopsCommand);
program.addCommand(listingsCommand);
program.addCommand(receiptsCommand);
program.addCommand(imagesCommand);

program.parse();
