import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

const CONFIG_DIR = join(homedir(), '.etsy-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const TOKENS_FILE = join(CONFIG_DIR, 'tokens.json');

export interface CliConfig {
  apiKey?: string;
  redirectUri?: string;
  scopes?: string[];
}

export async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

export async function loadConfig(): Promise<CliConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getClient(): Promise<EtsyClient> {
  const config = await loadConfig();

  if (!config.apiKey) {
    console.error(chalk.red('Error: API key not configured'));
    console.log(chalk.yellow('Run `etsy auth configure` to set up your API key'));
    process.exit(1);
  }

  const tokenStorage = {
    async load(): Promise<unknown> {
      try {
        const data = await fs.readFile(TOKENS_FILE, 'utf-8');
        return JSON.parse(data);
      } catch {
        return null;
      }
    },
    async save(tokens: Record<string, unknown>): Promise<void> {
      await ensureConfigDir();
      await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    },
    async clear(): Promise<void> {
      try {
        await fs.unlink(TOKENS_FILE);
      } catch {
        // File might not exist
      }
    },
  };

  return new EtsyClient(
    {
      apiKey: config.apiKey,
      redirectUri: config.redirectUri || '',
      scopes: config.scopes || [],
    },
    tokenStorage
  );
}
