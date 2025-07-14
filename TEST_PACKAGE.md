# Testing @profplum700/etsy-v3-api-client Package

This guide provides step-by-step instructions for testing the published npm package in various environments.

## Quick Start Test (Recommended)

### 1. Create a Test Directory
```bash
mkdir test-etsy-client
cd test-etsy-client
npm init -y
```

### 2. Install the Package
```bash
# Install the published package
npm install @profplum700/etsy-v3-api-client

# Also install TypeScript for testing (optional)
npm install -D typescript @types/node
```

### 3. Test Basic Import (JavaScript)
Create `test-import.js`:
```javascript
// test-import.js
const { EtsyClient, AuthHelper } = require('@profplum700/etsy-v3-api-client');

console.log('✅ CommonJS import successful');
console.log('EtsyClient:', typeof EtsyClient);
console.log('AuthHelper:', typeof AuthHelper);

// Test creating instances (without real credentials)
try {
  const client = new EtsyClient({
    keystring: 'dummy-key',
    accessToken: 'dummy-token',
    refreshToken: 'dummy-refresh',
    expiresAt: new Date(Date.now() + 3600000)
  });
  console.log('✅ EtsyClient instance created');
} catch (error) {
  console.error('❌ EtsyClient creation failed:', error.message);
}

try {
  const authHelper = new AuthHelper({
    keystring: 'dummy-key',
    redirectUri: 'https://example.com/callback',
    scopes: ['shops_r', 'listings_r']
  });
  console.log('✅ AuthHelper instance created');
} catch (error) {
  console.error('❌ AuthHelper creation failed:', error.message);
}
```

Run the test:
```bash
node test-import.js
```

Expected output:
```
✅ CommonJS import successful
EtsyClient: function
AuthHelper: function
✅ EtsyClient instance created
✅ AuthHelper instance created
```

---

## TypeScript Test

### 1. Setup TypeScript Project
```bash
# In your test directory
npx tsc --init
```

### 2. Test TypeScript Imports
Create `test-typescript.ts`:
```typescript
// test-typescript.ts
import { 
  EtsyClient, 
  AuthHelper, 
  EtsyApiError, 
  EtsyAuthError,
  EtsyRateLimitError,
  type EtsyUser,
  type EtsyShop,
  type EtsyListing,
  type EtsyTokens
} from '@profplum700/etsy-v3-api-client';

console.log('✅ ES module import successful');

// Test type checking
const config = {
  keystring: 'test-key',
  accessToken: 'test-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date(Date.now() + 3600000)
};

const client = new EtsyClient(config);
console.log('✅ EtsyClient with TypeScript types created');

const authHelper = new AuthHelper({
  keystring: 'test-key',
  redirectUri: 'https://example.com/callback',
  scopes: ['shops_r', 'listings_r']
});
console.log('✅ AuthHelper with TypeScript types created');

// Test error types
const apiError = new EtsyApiError('Test error', 404);
const authError = new EtsyAuthError('Auth error', 'INVALID_TOKEN');
const rateLimitError = new EtsyRateLimitError('Rate limit exceeded', 300);

console.log('✅ All error types instantiated');
console.log('✅ TypeScript compilation and imports successful!');
```

Compile and run:
```bash
npx tsc test-typescript.ts
node test-typescript.js
```

---

## ES Modules Test (Node.js)

### 1. Setup ES Modules
Update `package.json` in your test directory:
```json
{
  "type": "module"
}
```

### 2. Test ES Module Import
Create `test-esm.mjs`:
```javascript
// test-esm.mjs
import { 
  EtsyClient, 
  AuthHelper, 
  ETSY_SCOPES,
  COMMON_SCOPE_COMBINATIONS
} from '@profplum700/etsy-v3-api-client';

console.log('✅ ES module import successful');
console.log('Available scopes:', Object.keys(ETSY_SCOPES).length);
console.log('Scope combinations:', Object.keys(COMMON_SCOPE_COMBINATIONS));

// Test OAuth URL generation
const authHelper = new AuthHelper({
  keystring: 'test-key',
  redirectUri: 'https://example.com/callback',
  scopes: COMMON_SCOPE_COMBINATIONS.SHOP_READ_ONLY
});

const authUrl = authHelper.getAuthUrl();
console.log('✅ Auth URL generated:', authUrl.substring(0, 50) + '...');

console.log('✅ ES modules test completed successfully!');
```

Run:
```bash
node test-esm.mjs
```

---

## Browser Test

### 1. Create HTML Test File
Create `test-browser.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Etsy Client Browser Test</title>
</head>
<body>
    <h1>Etsy API Client Browser Test</h1>
    <div id="output"></div>
    
    <script type="module">
        import { 
            EtsyClient, 
            AuthHelper, 
            ETSY_SCOPES 
        } from './node_modules/@profplum700/etsy-v3-api-client/dist/index.esm.js';
        
        const output = document.getElementById('output');
        
        function log(message) {
            output.innerHTML += '<p>' + message + '</p>';
            console.log(message);
        }
        
        try {
            log('✅ Browser ES module import successful');
            
            const authHelper = new AuthHelper({
                keystring: 'test-key',
                redirectUri: window.location.origin + '/callback',
                scopes: [ETSY_SCOPES.SHOPS_READ, ETSY_SCOPES.LISTINGS_READ]
            });
            
            log('✅ AuthHelper created in browser');
            log('Auth URL: ' + authHelper.getAuthUrl().substring(0, 80) + '...');
            
            const client = new EtsyClient({
                keystring: 'test-key',
                accessToken: 'dummy-token',
                refreshToken: 'dummy-refresh',
                expiresAt: new Date(Date.now() + 3600000)
            });
            
            log('✅ EtsyClient created in browser');
            log('✅ Browser test completed successfully!');
            
        } catch (error) {
            log('❌ Browser test failed: ' + error.message);
        }
    </script>
</body>
</html>
```

Open in browser:
```bash
# Start a simple HTTP server
python -m http.server 8000
# OR
npx http-server
# Then visit http://localhost:8000/test-browser.html
```

---

## Advanced Integration Test

### 1. Test with Mock Etsy API
Create `test-integration.js`:
```javascript
// test-integration.js
const { EtsyClient, AuthHelper, EtsyApiError } = require('@profplum700/etsy-v3-api-client');

async function testFullWorkflow() {
    console.log('🧪 Testing full OAuth workflow simulation...');
    
    // Step 1: Auth Helper
    const authHelper = new AuthHelper({
        keystring: 'test_key_12345',
        redirectUri: 'https://myapp.com/callback',
        scopes: ['shops_r', 'listings_r', 'profile_r']
    });
    
    console.log('✅ AuthHelper created');
    
    const authUrl = authHelper.getAuthUrl();
    console.log('✅ Auth URL generated:', authUrl.includes('oauth/connect'));
    
    // Step 2: Simulate auth callback
    const state = authHelper.getState();
    authHelper.setAuthorizationCode('mock_auth_code_12345', state);
    console.log('✅ Authorization code set');
    
    // Step 3: Client creation (with mock tokens)
    const client = new EtsyClient({
        keystring: 'test_key_12345',
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: {
            enabled: true,
            maxRequestsPerDay: 100,
            maxRequestsPerSecond: 2
        },
        caching: {
            enabled: true,
            ttl: 300
        }
    });
    
    console.log('✅ EtsyClient created with configuration');
    
    // Step 4: Test utility methods
    const tokens = client.getCurrentTokens();
    console.log('✅ Current tokens retrieved:', !!tokens);
    
    const rateLimitStatus = client.getRateLimitStatus();
    console.log('✅ Rate limit status:', rateLimitStatus.remainingRequests);
    
    const remainingRequests = client.getRemainingRequests();
    console.log('✅ Remaining requests:', remainingRequests);
    
    console.log('🎉 Integration test completed successfully!');
}

testFullWorkflow().catch(error => {
    console.error('❌ Integration test failed:', error);
});
```

Run:
```bash
node test-integration.js
```

---

## Package Structure Verification

### 1. Check Package Contents
```bash
# List package contents
npm list @profplum700/etsy-v3-api-client

# Check installed files
ls -la node_modules/@profplum700/etsy-v3-api-client/

# Verify main entry points exist
ls -la node_modules/@profplum700/etsy-v3-api-client/dist/
```

### 2. Verify Package Exports
Create `test-exports.js`:
```javascript
// test-exports.js
const pkg = require('@profplum700/etsy-v3-api-client');

console.log('Package exports:');
console.log(Object.keys(pkg));

// Test all major exports exist
const requiredExports = [
    'EtsyClient',
    'AuthHelper', 
    'TokenManager',
    'MemoryTokenStorage',
    'FileTokenStorage',
    'EtsyRateLimiter',
    'EtsyApiError',
    'EtsyAuthError', 
    'EtsyRateLimitError',
    'ETSY_SCOPES',
    'COMMON_SCOPE_COMBINATIONS',
    'VERSION',
    'LIBRARY_NAME'
];

let allExportsPresent = true;
requiredExports.forEach(exportName => {
    if (pkg[exportName]) {
        console.log(`✅ ${exportName}: ${typeof pkg[exportName]}`);
    } else {
        console.log(`❌ Missing export: ${exportName}`);
        allExportsPresent = false;
    }
});

if (allExportsPresent) {
    console.log('🎉 All required exports are present!');
} else {
    console.log('⚠️  Some exports are missing');
}
```

---

## Troubleshooting

### Common Issues

1. **Module not found error**
   ```bash
   npm ls @profplum700/etsy-v3-api-client
   # Reinstall if needed
   npm uninstall @profplum700/etsy-v3-api-client
   npm install @profplum700/etsy-v3-api-client
   ```

2. **TypeScript compilation errors**
   ```bash
   # Update TypeScript and types
   npm install -D typescript@latest @types/node@latest
   ```

3. **ES module issues**
   ```bash
   # Check Node.js version (requires 18+)
   node --version
   ```

### Expected Results

All tests should complete with ✅ symbols and no errors. If you see any ❌ symbols, the package may have installation or compatibility issues.

### Performance Check

The package should:
- Import in < 100ms
- Create instances in < 10ms  
- Generate auth URLs in < 5ms
- Have TypeScript intellisense working

---

## Next Steps

After successful testing:
1. Use the package in your real project
2. Report any issues on GitHub
3. Consider contributing improvements
4. Share feedback for future versions

## Package Information

- **Registry**: https://www.npmjs.com/package/@profplum700/etsy-v3-api-client
- **Source**: https://github.com/profplum700/etsy-v3-api-client
- **Issues**: https://github.com/profplum700/etsy-v3-api-client/issues