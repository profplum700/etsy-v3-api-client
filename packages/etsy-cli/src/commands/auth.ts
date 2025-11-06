import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../utils/client.js';
import { formatSuccess, formatInfo } from '../utils/format.js';

export const authCommand = new Command('auth')
  .description('Manage authentication')
  .addCommand(
    new Command('configure')
      .description('Configure API credentials')
      .action(async () => {
        console.log(chalk.bold('\nEtsy API Configuration\n'));

        const config = await loadConfig();

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'apiKey',
            message: 'Enter your Etsy API key:',
            default: config.apiKey,
            validate: (input): boolean | string => input.length > 0 || 'API key is required',
          },
          {
            type: 'input',
            name: 'redirectUri',
            message: 'Enter your redirect URI:',
            default: config.redirectUri || 'http://localhost:3000/oauth/callback',
          },
          {
            type: 'input',
            name: 'scopes',
            message: 'Enter scopes (comma-separated):',
            default: config.scopes?.join(',') || 'listings_r,shops_r',
            filter: (input: string): string[] => input.split(',').map(s => s.trim()),
          },
        ]);

        await saveConfig(answers);

        console.log(formatSuccess('Configuration saved successfully!'));
        console.log(formatInfo('Run `etsy auth login` to authenticate'));
      })
  )
  .addCommand(
    new Command('login')
      .description('Authenticate with Etsy')
      .action(async () => {
        console.log(chalk.yellow('OAuth flow not yet implemented in CLI'));
        console.log(chalk.blue('Please use the library directly for OAuth authentication'));
      })
  )
  .addCommand(
    new Command('status')
      .description('Check authentication status')
      .action(async () => {
        const config = await loadConfig();

        console.log(chalk.bold('\nAuthentication Status\n'));

        if (config.apiKey) {
          console.log(formatSuccess('API key configured'));
          console.log(`  Redirect URI: ${config.redirectUri || 'Not set'}`);
          console.log(`  Scopes: ${config.scopes?.join(', ') || 'None'}`);
        } else {
          console.log(chalk.red('✗ API key not configured'));
          console.log(chalk.yellow('Run `etsy auth configure` to set up'));
        }
      })
  );
