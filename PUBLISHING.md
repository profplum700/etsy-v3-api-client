# Publishing Guide - Etsy v3 API Client

This guide covers everything you need to publish your package to npm.

## 📋 Pre-Publication Checklist

Before publishing, ensure everything is ready:

### ✅ 1. Package Quality Checks

```bash
# Run all tests
pnpm test

# Check test coverage
pnpm test:coverage

# Lint the code
pnpm lint

# Build the package
pnpm run build

# Type check
pnpm run type-check
```

**Expected Results**:
- ✅ All 334 tests passing
- ✅ >89% code coverage
- ✅ No lint errors
- ✅ Clean build (no errors)
- ✅ No TypeScript errors

### ✅ 2. Package Configuration Check

Review `package.json`:

```json
{
  "name": "@profplum700/etsy-v3-api-client",
  "version": "2.0.0",
  "description": "JavaScript/TypeScript client for the Etsy Open API v3 with OAuth 2.0 authentication",
  "main": "dist/index.cjs",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",

  "files": [
    "dist/**/*",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],

  "keywords": [
    "etsy",
    "api",
    "v3",
    "oauth",
    "oauth2",
    "authentication",
    "typescript",
    "javascript",
    "client",
    "sdk"
  ],

  "author": {
    "name": "profplum700",
    "email": "profplum700@users.noreply.github.com"
  },

  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/profplum700/etsy-v3-api-client.git"
  },

  "bugs": {
    "url": "https://github.com/profplum700/etsy-v3-api-client/issues"
  },

  "homepage": "https://github.com/profplum700/etsy-v3-api-client#readme"
}
```

**Verify**:
- ✅ Version number is correct (2.0.0)
- ✅ Entry points are correct (main, module, types)
- ✅ Files array includes all necessary files
- ✅ Keywords are comprehensive
- ✅ Repository URL is correct
- ✅ License is set (MIT)

### ✅ 3. Documentation Check

Ensure these files are complete:
- ✅ `README.md` - Comprehensive usage guide
- ✅ `CHANGELOG.md` - v2.0.0 release notes
- ✅ `LICENSE` - MIT license file
- ✅ `SECURITY.md` - Security policy
- ✅ `.gitignore` - Excludes sensitive files

### ✅ 4. Build Verification

```bash
# Clean and rebuild
rm -rf dist/
pnpm run build

# Verify build outputs
ls -la dist/

# Expected files:
# - index.cjs          (CommonJS)
# - index.esm.js       (ES Module)
# - index.d.ts         (TypeScript definitions)
# - browser.esm.js     (Browser ESM)
# - browser.umd.js     (Browser UMD)
# - node.esm.js        (Node.js ESM)
# - node.cjs           (Node.js CommonJS)
```

### ✅ 5. Test the Package Locally

Before publishing, test your package locally:

```bash
# Create a test directory
mkdir ../test-etsy-client
cd ../test-etsy-client
npm init -y

# Install your package locally
npm install ../etsy-v3-api-client

# Create a test file
cat > test.js << 'EOF'
const { EtsyClient } = require('@profplum700/etsy-v3-api-client');

console.log('✅ CommonJS import works');
console.log('EtsyClient:', typeof EtsyClient);

// Test TypeScript types exist
const types = require('@profplum700/etsy-v3-api-client');
console.log('✅ Types available:', Object.keys(types).length, 'exports');
EOF

# Run the test
node test.js

# Test ES modules
cat > test.mjs << 'EOF'
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

console.log('✅ ES Module import works');
console.log('EtsyClient:', typeof EtsyClient);
EOF

node test.mjs

# Clean up
cd ../etsy-v3-api-client
rm -rf ../test-etsy-client
```

---

## 🚀 Publishing Steps

### Step 1: Create npm Account (If Needed)

If you don't have an npm account:

1. Visit https://www.npmjs.com/signup
2. Create an account
3. Verify your email

### Step 2: Login to npm

```bash
# Login to npm
npm login

# You'll be prompted for:
# - Username: profplum700
# - Password: ********
# - Email: profplum700@users.noreply.github.com
# - One-time password (if 2FA enabled)

# Verify you're logged in
npm whoami
# Should output: profplum700
```

### Step 3: Verify Package Name Availability

```bash
# Check if package name is available
npm view @profplum700/etsy-v3-api-client

# If available: 404 - Not found
# If taken: Shows package details (choose different name)
```

**Note**: The package name `@profplum700/etsy-v3-api-client` uses a scoped name (@profplum700), which requires:
- You own the npm organization "profplum700", OR
- You need to create it first

To create an npm organization:
1. Go to https://www.npmjs.com/org/create
2. Create organization "profplum700"
3. Or use your username as the scope

Alternatively, publish without a scope:
```json
// package.json
{
  "name": "etsy-v3-api-client"
}
```

### Step 4: Configure Publishing Access

For scoped packages, set access level:

```bash
# Public package (free)
npm access public @profplum700/etsy-v3-api-client

# Or add to package.json:
{
  "publishConfig": {
    "access": "public"
  }
}
```

### Step 5: Publish Dry Run

Test the publish process without actually publishing:

```bash
# Dry run - shows what will be published
npm publish --dry-run

# Review output:
# - Check file list
# - Verify version
# - Ensure no sensitive files included
```

**Expected output**:
```
npm notice
npm notice 📦  @profplum700/etsy-v3-api-client@2.0.0
npm notice === Tarball Contents ===
npm notice 1.2kB  package.json
npm notice 25.8kB README.md
npm notice 5.4kB  CHANGELOG.md
npm notice 1.1kB  LICENSE
npm notice 12.3kB SECURITY.md
npm notice 45.2kB dist/index.cjs
npm notice 43.8kB dist/index.esm.js
npm notice 18.6kB dist/index.d.ts
npm notice ...
npm notice === Tarball Details ===
npm notice name:          @profplum700/etsy-v3-api-client
npm notice version:       2.0.0
npm notice filename:      etsy-v3-api-client-2.0.0.tgz
npm notice package size:  245.3 kB
npm notice unpacked size: 892.1 kB
npm notice total files:   15
```

### Step 6: Publish to npm! 🎉

```bash
# Publish to npm registry
npm publish

# Or with verbose output
npm publish --verbose

# If successful, you'll see:
# + @profplum700/etsy-v3-api-client@2.0.0
```

### Step 7: Verify Publication

```bash
# View your published package
npm view @profplum700/etsy-v3-api-client

# Check on npm website
# https://www.npmjs.com/package/@profplum700/etsy-v3-api-client

# Test installation
npm install @profplum700/etsy-v3-api-client
```

---

## 📝 Post-Publication Tasks

### 1. Create GitHub Release

```bash
# Tag the release
git tag -a v2.0.0 -m "Release v2.0.0 - Complete Etsy v3 API Support"

# Push the tag
git push origin v2.0.0
```

On GitHub:
1. Go to https://github.com/profplum700/etsy-v3-api-client/releases
2. Click "Draft a new release"
3. Select tag: `v2.0.0`
4. Release title: `v2.0.0 - Complete Etsy v3 API Support`
5. Description: Copy from CHANGELOG.md
6. Attach build artifacts (optional)
7. Click "Publish release"

### 2. Update Documentation Links

Update README.md badges:

```markdown
[![npm version](https://badge.fury.io/js/%40profplum700%2Fetsy-v3-api-client.svg)](https://www.npmjs.com/package/@profplum700/etsy-v3-api-client)
[![npm downloads](https://img.shields.io/npm/dm/@profplum700/etsy-v3-api-client.svg)](https://www.npmjs.com/package/@profplum700/etsy-v3-api-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
```

### 3. Announce the Release

Share on:
- Twitter/X
- Reddit (r/javascript, r/typescript, r/node)
- Dev.to
- Hacker News (if major release)
- Your blog
- Etsy Developer Community

### 4. Monitor Initial Feedback

Watch for:
- GitHub issues
- npm downloads
- Twitter/social mentions
- Bug reports

---

## 🔄 Maintaining the Package

### Publishing Updates

For future releases:

```bash
# 1. Update version
npm version patch  # 2.0.0 -> 2.0.1 (bug fixes)
npm version minor  # 2.0.0 -> 2.1.0 (new features)
npm version major  # 2.0.0 -> 3.0.0 (breaking changes)

# 2. Update CHANGELOG.md
# Add new version section with changes

# 3. Build and test
pnpm run build
pnpm test

# 4. Commit and push
git add .
git commit -m "chore: release v2.0.1"
git push origin main
git push --tags

# 5. Publish
npm publish

# 6. Create GitHub release
```

### Deprecating Versions

If you need to deprecate a version:

```bash
# Deprecate a specific version
npm deprecate @profplum700/etsy-v3-api-client@1.0.0 "Security vulnerability - please upgrade to 2.0.0+"

# Deprecate a range
npm deprecate @profplum700/etsy-v3-api-client@"< 2.0.0" "Please upgrade to 2.0.0+"
```

### Unpublishing (Use Sparingly)

**WARNING**: Only use within 72 hours of publication, and only if absolutely necessary.

```bash
# Unpublish a specific version
npm unpublish @profplum700/etsy-v3-api-client@2.0.0

# Unpublish entire package (DANGEROUS!)
npm unpublish @profplum700/etsy-v3-api-client --force
```

---

## 🔐 Security Best Practices

### 1. Enable 2FA on npm

```bash
# Enable 2FA for publishing
npm profile enable-2fa auth-and-writes

# This requires 2FA token for:
# - npm login
# - npm publish
# - npm owner add/rm
```

### 2. Use npm Tokens for CI/CD

For automated publishing:

```bash
# Create automation token
npm token create --read-only  # For testing
npm token create              # For publishing

# Add to CI/CD secrets as NPM_TOKEN
```

GitHub Actions example:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: pnpm test
      - run: pnpm run build

      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3. Sign Git Tags

```bash
# Sign your release tags
git tag -s v2.0.0 -m "Release v2.0.0"

# Verify signature
git tag -v v2.0.0
```

---

## 📊 Monitoring Your Package

### npm Analytics

View package statistics:
- https://www.npmjs.com/package/@profplum700/etsy-v3-api-client
- Downloads tab shows weekly/monthly/yearly stats

### GitHub Insights

Monitor:
- Stars and forks
- Issues and PRs
- Traffic (views, clones)
- Dependents graph

### Tools

```bash
# Check who's depending on your package
npm view @profplum700/etsy-v3-api-client

# Check download stats
npx npm-stat @profplum700/etsy-v3-api-client

# Analyze bundle size
npx bundlephobia @profplum700/etsy-v3-api-client
```

---

## 🐛 Troubleshooting

### Common Issues

#### "You do not have permission to publish"

```bash
# Verify you're logged in
npm whoami

# Login again
npm logout
npm login

# Check package access
npm access ls-packages
```

#### "Package name too similar to existing package"

Change your package name in `package.json` and try again.

#### "Cannot publish over existing version"

You must increment the version:

```bash
npm version patch
npm publish
```

#### "402 Payment Required"

Scoped packages require payment for private publishing. Either:
- Make it public: `npm publish --access public`
- Add to package.json: `"publishConfig": { "access": "public" }`

---

## ✅ Final Pre-Publish Checklist

Before running `npm publish`, verify:

- [ ] All tests pass (334/334)
- [ ] Build is clean (no errors)
- [ ] Version number updated (2.0.0)
- [ ] CHANGELOG.md updated
- [ ] README.md is complete
- [ ] LICENSE file exists
- [ ] .gitignore excludes sensitive files
- [ ] package.json is correct
- [ ] npm account created
- [ ] npm logged in
- [ ] 2FA enabled (recommended)
- [ ] Dry run completed (`npm publish --dry-run`)
- [ ] Package tested locally
- [ ] GitHub repo is public
- [ ] No sensitive data in package

---

## 🎉 You're Ready to Publish!

```bash
# The moment of truth!
npm publish

# Watch it go live! 🚀
```

---

## 📞 Need Help?

- npm documentation: https://docs.npmjs.com/
- npm support: https://www.npmjs.com/support
- GitHub Issues: https://github.com/profplum700/etsy-v3-api-client/issues

---

**Good luck with your first publish! 🎉**

Once published, your package will be available to developers worldwide:
```bash
npm install @profplum700/etsy-v3-api-client
```
