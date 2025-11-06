# Phase 5: Advanced Security Features

This document describes the advanced security features implemented in Phase 5 of the Etsy v3 API client.

## Table of Contents

- [Token Encryption at Rest](#token-encryption-at-rest)
- [Proactive Token Rotation](#proactive-token-rotation)
- [Webhook Request Signing](#webhook-request-signing)
- [Security Best Practices](#security-best-practices)

## Token Encryption at Rest

The `EncryptedFileTokenStorage` class provides AES-256-GCM authenticated encryption for OAuth tokens stored on disk.

### Features

- **AES-256-GCM Encryption**: Industry-standard authenticated encryption
- **Secure Key Management**: Support for environment variables and key derivation
- **File Permissions**: Automatic restrictive permissions (0o600)
- **Tamper Protection**: GCM mode provides authentication and integrity checking

### Basic Usage

```typescript
import { EtsyClient, EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';

// Create encrypted storage with a 32-byte encryption key
const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY // Must be 32 bytes
});

// Use with Etsy client
const client = new EtsyClient(
  {
    keystring: process.env.ETSY_API_KEY,
    accessToken: '...',
    refreshToken: '...',
    expiresAt: new Date()
  },
  storage
);
```

### Generating Encryption Keys

```typescript
import { generateEncryptionKey } from '@profplum700/etsy-v3-api-client';

// Generate a random 32-byte encryption key
const key = await generateEncryptionKey();
console.log(key.toString('base64')); // Store this securely

// Or derive a key from a password
import { deriveKeyFromPassword } from '@profplum700/etsy-v3-api-client';

const key = await deriveKeyFromPassword(
  'your-secure-password',
  'random-salt', // Store salt securely
  100000 // iterations
);
```

### Manual Encryption/Decryption

```typescript
import { encryptAES256GCM, decryptAES256GCM } from '@profplum700/etsy-v3-api-client';

// Encrypt sensitive data
const data = JSON.stringify({ secret: 'sensitive-info' });
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8');

const encrypted = await encryptAES256GCM(data, key);
console.log(encrypted);
// {
//   ciphertext: 'base64...',
//   iv: 'base64...',
//   authTag: 'base64...',
//   algorithm: 'aes-256-gcm'
// }

// Decrypt data
const decrypted = await decryptAES256GCM(encrypted, key);
console.log(decrypted); // Original data
```

### Security Considerations

1. **Key Storage**: Never commit encryption keys to version control
2. **Key Length**: Must be exactly 32 bytes for AES-256
3. **Environment Variables**: Store keys in environment variables or key management services
4. **File Permissions**: Encrypted files are automatically set to 0o600 (owner read/write only)
5. **Backup**: Losing the encryption key means losing access to encrypted tokens

## Proactive Token Rotation

Enhanced token rotation automatically refreshes OAuth tokens before they expire.

### Features

- **Proactive Rotation**: Rotate tokens before expiration
- **Configurable Thresholds**: Set when to rotate (default: 15 minutes before expiry)
- **Automatic Scheduling**: Background rotation checks
- **Rotation Callbacks**: Get notified when tokens are rotated

### Basic Usage

```typescript
import { EtsyClient, TokenManager } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient(config, storage, {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000, // 15 minutes
  onRotation: async (oldTokens, newTokens) => {
    console.log('Tokens rotated successfully');
    // Notify other services, log event, etc.
  }
});
```

### Automatic Rotation Scheduler

```typescript
const rotationConfig = {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000, // Rotate 15 mins before expiry
  autoSchedule: true, // Enable automatic background checks
  checkInterval: 60 * 1000, // Check every 1 minute
  onRotation: async (oldTokens, newTokens) => {
    // Update distributed cache, notify services, etc.
    await notifyTokenChange(newTokens);
  }
};

const tokenManager = new TokenManager(config, storage, rotationConfig);

// Scheduler starts automatically
// To manually stop:
tokenManager.stopRotationScheduler();
```

### Manual Token Rotation

```typescript
const tokenManager = new TokenManager(config, storage, rotationConfig);

// Check if rotation is needed
if (tokenManager.needsProactiveRotation()) {
  // Manually rotate token
  const newTokens = await tokenManager.rotateToken();
  console.log('Token rotated:', newTokens);
}
```

### Dynamic Configuration

```typescript
const tokenManager = new TokenManager(config, storage);

// Update rotation configuration at runtime
tokenManager.updateRotationConfig({
  enabled: true,
  rotateBeforeExpiry: 30 * 60 * 1000, // Change to 30 minutes
  autoSchedule: true,
  onRotation: async (oldTokens, newTokens) => {
    console.log('Token rotation event');
  }
});

// Get current configuration
const currentConfig = tokenManager.getRotationConfig();
```

### Rotation Callback Use Cases

```typescript
// Multi-service notification
const rotationConfig = {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000,
  onRotation: async (oldTokens, newTokens) => {
    // Update Redis cache
    await redis.set('etsy:tokens', JSON.stringify(newTokens));

    // Notify microservices
    await notificationService.broadcast({
      event: 'token.rotated',
      data: newTokens
    });

    // Log for audit trail
    logger.info('OAuth tokens rotated', {
      oldExpiry: oldTokens.expires_at,
      newExpiry: newTokens.expires_at
    });
  }
};
```

## Webhook Request Signing

The `WebhookSecurity` class provides HMAC-based request signing for webhook payloads.

### Features

- **HMAC Signing**: SHA-256, SHA-512, or SHA-1 algorithms
- **Timing-Safe Verification**: Protection against timing attacks
- **Timestamp Support**: Replay attack prevention
- **Flexible Encoding**: Hex or Base64 output

### Basic Usage

```typescript
import { WebhookSecurity } from '@profplum700/etsy-v3-api-client';

const security = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET,
  algorithm: 'sha256' // default
});

// Sign outgoing webhook request
const payload = {
  event: 'order.created',
  data: { orderId: 12345, total: 99.99 }
};

const signature = security.signRequest(payload);

// Send webhook with signature
fetch('https://partner.example.com/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature
  },
  body: JSON.stringify(payload)
});
```

### Verifying Webhook Signatures

```typescript
// In your webhook endpoint
import { WebhookSecurity } from '@profplum700/etsy-v3-api-client';

const security = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET
});

app.post('/webhook', (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-webhook-signature'];

  if (security.verifySignature(payload, signature)) {
    // Signature valid - process webhook
    processWebhook(req.body);
    res.sendStatus(200);
  } else {
    // Invalid signature - reject
    res.sendStatus(401);
  }
});
```

### Replay Attack Prevention

```typescript
const security = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET
});

// Sender: Sign with timestamp
const payload = { event: 'payment.completed', amount: 100 };
const { timestamp, signature } = security.signRequestWithTimestamp(payload);

// Send both timestamp and signature in headers
fetch('https://partner.example.com/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString()
  },
  body: JSON.stringify(payload)
});

// Receiver: Verify with timestamp (max 5 minutes old)
app.post('/webhook', (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-webhook-signature'];
  const timestamp = parseInt(req.headers['x-webhook-timestamp']);

  const isValid = security.verifySignatureWithTimestamp(
    payload,
    signature,
    timestamp,
    300 // Max age: 5 minutes
  );

  if (isValid) {
    processWebhook(req.body);
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});
```

### Different Algorithms

```typescript
// SHA-256 (default, recommended)
const sha256Security = new WebhookSecurity({
  secret: 'my-secret',
  algorithm: 'sha256'
});

// SHA-512 (more secure, larger signature)
const sha512Security = new WebhookSecurity({
  secret: 'my-secret',
  algorithm: 'sha512'
});

// SHA-1 (legacy support only, not recommended)
const sha1Security = new WebhookSecurity({
  secret: 'my-secret',
  algorithm: 'sha1'
});
```

### Secret Rotation

```typescript
const security = new WebhookSecurity({
  secret: 'old-secret'
});

// When rotating webhook secrets
security.updateSecret('new-secret');

// All subsequent signatures will use new secret
const signature = security.signRequest(payload);
```

## Security Best Practices

### 1. Encryption Key Management

```typescript
// ✅ Good: Use environment variables
const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY
});

// ❌ Bad: Hard-coded keys
const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: 'my-secret-key-12345678901234567' // Never do this!
});

// ✅ Good: Use key derivation for passwords
const key = await deriveKeyFromPassword(
  process.env.PASSWORD,
  process.env.SALT,
  100000
);
```

### 2. Token Rotation

```typescript
// ✅ Good: Proactive rotation with callbacks
const config = {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000,
  onRotation: async (oldTokens, newTokens) => {
    await updateDistributedCache(newTokens);
    await notifyServices(newTokens);
  }
};

// ✅ Good: Enable automatic scheduling in long-running apps
const config = {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000,
  autoSchedule: true,
  checkInterval: 60 * 1000
};
```

### 3. Webhook Security

```typescript
// ✅ Good: Use timestamps for replay protection
const { timestamp, signature } = security.signRequestWithTimestamp(payload);

// ✅ Good: Verify age of requests
const isValid = security.verifySignatureWithTimestamp(
  payload,
  signature,
  timestamp,
  300 // Only accept requests less than 5 minutes old
);

// ✅ Good: Use strong secrets
const security = new WebhookSecurity({
  secret: crypto.randomBytes(32).toString('hex') // Generate strong secret
});
```

### 4. Error Handling

```typescript
try {
  const storage = new EncryptedFileTokenStorage({
    filePath: './tokens.enc',
    encryptionKey: process.env.ENCRYPTION_KEY
  });

  const tokens = await storage.load();
  if (!tokens) {
    // No tokens found - initiate OAuth flow
    await initiateOAuthFlow();
  }
} catch (error) {
  if (error.message.includes('Invalid encryption key')) {
    console.error('Encryption key is invalid - check environment variables');
  } else if (error.message.includes('decryption failed')) {
    console.error('Token file may be corrupted or encrypted with different key');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 5. Production Checklist

- [ ] Store encryption keys in environment variables or KMS
- [ ] Never commit encryption keys or encrypted files to version control
- [ ] Use proactive token rotation to avoid expired token errors
- [ ] Implement webhook signature verification
- [ ] Use timestamp-based signatures for replay protection
- [ ] Set appropriate maxAge for webhook timestamp verification
- [ ] Rotate webhook secrets periodically
- [ ] Monitor token rotation failures
- [ ] Implement proper error handling and logging
- [ ] Use encrypted storage for all persistent tokens

## Examples

### Complete Production Setup

```typescript
import {
  EtsyClient,
  EncryptedFileTokenStorage,
  TokenManager,
  WebhookSecurity,
  generateEncryptionKey
} from '@profplum700/etsy-v3-api-client';

// 1. Setup encrypted storage
const storage = new EncryptedFileTokenStorage({
  filePath: '/secure/path/tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY
});

// 2. Setup token rotation
const rotationConfig = {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000,
  autoSchedule: true,
  checkInterval: 60 * 1000,
  onRotation: async (oldTokens, newTokens) => {
    await redis.set('etsy:tokens', JSON.stringify(newTokens));
    logger.info('Tokens rotated', { expires: newTokens.expires_at });
  }
};

// 3. Create Etsy client
const client = new EtsyClient(
  {
    keystring: process.env.ETSY_API_KEY,
    accessToken: '...',
    refreshToken: '...',
    expiresAt: new Date()
  },
  storage,
  rotationConfig
);

// 4. Setup webhook security
const webhookSecurity = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET,
  algorithm: 'sha256'
});

// 5. Use in webhook endpoint
app.post('/etsy/webhook', async (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-webhook-signature'];
  const timestamp = parseInt(req.headers['x-webhook-timestamp']);

  if (webhookSecurity.verifySignatureWithTimestamp(payload, signature, timestamp, 300)) {
    await handleEtsyWebhook(req.body);
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});
```

## Troubleshooting

### Encryption Key Issues

**Problem**: `Invalid encryption key length` error

**Solution**: Ensure your encryption key is exactly 32 bytes:

```typescript
// Generate a new 32-byte key
const key = await generateEncryptionKey();
console.log(key.toString('hex')); // Store this

// Or use a 32-character string
const key = '12345678901234567890123456789012'; // Exactly 32 chars
```

### Decryption Failures

**Problem**: Tokens fail to decrypt

**Solution**: Check if you're using the correct encryption key and that the file hasn't been corrupted.

### Token Rotation Not Working

**Problem**: Tokens are not being rotated automatically

**Solution**: Ensure `autoSchedule` is enabled and check rotation configuration:

```typescript
const config = tokenManager.getRotationConfig();
console.log(config);
```

### Webhook Signature Verification Fails

**Problem**: Valid signatures are being rejected

**Solution**: Ensure payload is serialized identically on both sides:

```typescript
// Use same serialization method
const payload = JSON.stringify(data); // No spaces
// OR
const payload = JSON.stringify(data, null, 2); // With formatting

// Be consistent!
```

## Migration Guide

### From FileTokenStorage to EncryptedFileTokenStorage

```typescript
// Before (Phase 1-4)
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';
const storage = new FileTokenStorage('./tokens.json');

// After (Phase 5)
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';
const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY
});
```

### Adding Token Rotation to Existing Client

```typescript
// Before
const client = new EtsyClient(config, storage);

// After
const client = new EtsyClient(config, storage, {
  enabled: true,
  rotateBeforeExpiry: 15 * 60 * 1000,
  autoSchedule: true
});
```

## Additional Resources

- [Etsy API Documentation](https://developers.etsy.com/documentation/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
