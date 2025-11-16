#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Get version type from command line argument
const versionType = process.argv[2];

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('Usage: node bump-version.mjs <major|minor|patch>');
  process.exit(1);
}

// Function to bump version
function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);

  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
  }

  return parts.join('.');
}

// Read root package.json
const rootPackagePath = join(rootDir, 'package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const currentVersion = rootPackage.version;

// Calculate new version
const newVersion = bumpVersion(currentVersion, versionType);

console.log(`Bumping version from ${currentVersion} to ${newVersion} (${versionType})`);

// Update root package.json
rootPackage.version = newVersion;
writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
console.log(`✅ Updated root package.json to ${newVersion}`);

// Find and update all package.json files in packages/*
const packagesDir = join(rootDir, 'packages');

if (existsSync(packagesDir)) {
  const packageDirs = readdirSync(packagesDir).filter(file => {
    const filePath = join(packagesDir, file);
    return statSync(filePath).isDirectory();
  });

  for (const packageDir of packageDirs) {
    const packagePath = join(packagesDir, packageDir, 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      pkg.version = newVersion;
      writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`✅ Updated packages/${packageDir}/package.json to ${newVersion}`);
    }
  }
}

console.log(`\n🎉 All packages updated to version ${newVersion}`);
