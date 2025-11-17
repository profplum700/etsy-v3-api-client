#!/usr/bin/env node

/**
 * Build all packages sequentially with forced process cleanup
 * Workaround for Windows zombie process issue with pnpm
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const packages = ['etsy-cli', 'etsy-admin-ui', 'etsy-react', 'etsy-nextjs'];

console.log('Building core package...');
try {
  execSync('pnpm run build:core', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Core build complete\n');
} catch (error) {
  console.error('❌ Core build failed');
  process.exit(1);
}

console.log('Building packages sequentially...\n');
for (const pkg of packages) {
  const pkgDir = join(rootDir, 'packages', pkg);
  console.log(`Building ${pkg}...`);

  try {
    execSync('pnpm run build', { stdio: 'inherit', cwd: pkgDir, timeout: 60000 });
    console.log(`✅ ${pkg} build complete\n`);

    // Force garbage collection and wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error(`❌ ${pkg} build failed`);
    process.exit(1);
  }
}

console.log('🎉 All packages built successfully!');
