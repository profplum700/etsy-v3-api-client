#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read current version from package.json
const rootPackagePath = join(rootDir, 'package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const version = rootPackage.version;

console.log(`Committing version changes for v${version}...`);

try {
  // Stage all package.json changes
  execSync('git add package.json packages/*/package.json', { stdio: 'inherit', cwd: rootDir });

  // Commit with version number (skip pre-commit hook since release script runs build/test after)
  execSync(`git commit --no-verify -m "chore: bump version to ${version}"`, { stdio: 'inherit', cwd: rootDir });

  console.log(`✅ Committed version bump to ${version}`);
} catch {
  console.error('❌ Failed to commit version changes');
  process.exit(1);
}
