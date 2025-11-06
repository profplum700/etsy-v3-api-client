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

  // Load tokens from storage
  let tokens: Record<string, unknown> | null = null;
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    tokens = JSON.parse(data);
  } catch {
    // No tokens yet
  }

  if (!tokens || !tokens.accessToken) {
    console.error(chalk.red('Error: No access token found'));
    console.log(chalk.yellow('Please authenticate first using `etsy auth login`'));
    process.exit(1);
  }

  // Save tokens callback
  const refreshSave = async (accessToken: string, refreshToken: string, expiresAt: Date): Promise<void> => {
    await ensureConfigDir();
    await fs.writeFile(TOKENS_FILE, JSON.stringify({
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    }, null, 2));
  };

  return new EtsyClient({
    keystring: config.apiKey,
    accessToken: tokens.accessToken as string,
    refreshToken: tokens.refreshToken as string,
    expiresAt: new Date(tokens.expiresAt as string),
    refreshSave,
  });
}
