#!/usr/bin/env node
import { execSync } from 'child_process';

const versionType = process.argv[2];
const shouldPush = process.argv.includes('--push');

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('Usage: node scripts/release.mjs <major|minor|patch> [--push]');
  process.exit(1);
}

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function readStdout(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

const status = readStdout('git status --porcelain');
if (status) {
  console.error('Working tree is not clean. Commit or stash changes before releasing.');
  process.exit(1);
}

const branch = readStdout('git rev-parse --abbrev-ref HEAD');
if (branch !== 'master' && branch !== 'main') {
  console.error(`Release must be run from master/main. Current branch: ${branch}`);
  process.exit(1);
}

run(`pnpm run version:${versionType}`);
run('pnpm run version:commit');

const version = readStdout('node -p "require(\'./package.json\').version"');
run(`git tag -a v${version} -m "Release v${version}"`);

if (shouldPush) {
  run('git push');
  run('git push --tags');
}

console.log(`Release prepared for v${version}.`);
console.log('CI will publish to npm when the tag is pushed.');
