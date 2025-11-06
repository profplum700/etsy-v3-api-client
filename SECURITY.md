# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Features

### Authentication & Token Security

✅ **OAuth 2.0 PKCE Flow**
- Implements industry-standard OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Protects against authorization code interception attacks
- Uses cryptographically secure random generation for state and code verifier

✅ **Automatic Token Refresh**
- Tokens are automatically refreshed before expiration (60-second buffer)
- Prevents race conditions with single concurrent refresh lock
- Failed refresh attempts throw proper errors

✅ **Secure Token Storage**
- Multiple storage backends with appropriate security levels:
  - `MemoryTokenStorage`: Non-persistent, cleared on process exit
  - `SessionStorageTokenStorage`: Browser session-only, cleared on tab close
  - `LocalStorageTokenStorage`: Browser persistent storage
  - `FileTokenStorage`: Node.js file-based storage
- Tokens are stored in JSON format (not encrypted at rest)

### Cryptographic Operations

✅ **Secure Random Generation**
- Uses `crypto.getRandomValues()` (browser) or `crypto.randomBytes()` (Node.js)
- CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- Proper entropy for OAuth state parameters and PKCE code verifiers

✅ **SHA-256 Hashing**
- Uses Web Crypto API (browser) or Node.js crypto module
- Proper implementation for PKCE code challenges
- No custom crypto implementations

### Data Protection

✅ **No Hardcoded Credentials**
- All API keys and tokens provided by user configuration
- Zero hardcoded credentials in source code
- Sensitive files excluded via `.gitignore`

✅ **Minimal Logging**
- Debug logging only in development environments
- No sensitive data (tokens, API keys) logged in production
- Error messages don't expose credentials

⚠️ **Token Storage Security Considerations**
- Tokens stored in localStorage/sessionStorage are accessible to XSS attacks
- FileTokenStorage writes tokens to disk without encryption
- Users should implement additional security measures for production use

## Security Best Practices

### For Library Users

#### 1. Protect Your API Keys
```typescript
// ❌ BAD - Hardcoded credentials
const client = new EtsyClient({
  keystring: 'abc123xyz',  // Don't do this!
  // ...
});

// ✅ GOOD - Use environment variables
const client = new EtsyClient({
  keystring: process.env.ETSY_API_KEY!,
  // ...
});
```

#### 2. Use Secure Token Storage
```typescript
// For sensitive production applications:
// - Implement custom encrypted storage
// - Use secure backend token management
// - Never expose tokens in client-side code

class EncryptedTokenStorage implements TokenStorage {
  async save(tokens: EtsyTokens): Promise<void> {
    // Encrypt tokens before storage
    const encrypted = await encryptData(JSON.stringify(tokens));
    // Store encrypted data
  }
  // ... implement load() and clear()
}
```

#### 3. Implement Rate Limiting
```typescript
// Built-in rate limiting is enabled by default
const client = new EtsyClient({
  // ...
  rateLimiting: {
    enabled: true,
    maxRequestsPerDay: 10000,
    maxRequestsPerSecond: 10
  }
});
```

#### 4. Handle Errors Securely
```typescript
try {
  await client.getShop();
} catch (error) {
  if (error instanceof EtsyAuthError) {
    // Don't log the full error in production - may contain tokens
    console.error('Authentication failed');
    // Log to secure logging service instead
  }
}
```

#### 5. Secure File Storage (Node.js)
```typescript
// FileTokenStorage doesn't set restrictive permissions
// Manually set permissions after file creation:
import { chmod } from 'fs/promises';

const storage = new FileTokenStorage('./tokens.json');
// After token storage, set restrictive permissions
await chmod('./tokens.json', 0o600); // Owner read/write only
```

#### 6. XSS Protection (Browser)
- Sanitize all user inputs before display
- Use Content Security Policy (CSP) headers
- Avoid storing tokens in localStorage if possible (prefer sessionStorage)
- Consider using HttpOnly cookies for token storage (requires backend)

#### 7. HTTPS Only
```typescript
// The library uses HTTPS by default for Etsy API
// Ensure your redirect URIs also use HTTPS
const authHelper = new AuthHelper({
  redirectUri: 'https://your-app.com/callback', // ✅ HTTPS
  // NOT: 'http://your-app.com/callback' // ❌ HTTP
});
```

## Known Security Considerations

### 1. Token Storage Encryption
**Status**: Not Implemented
**Impact**: Medium
**Mitigation**: Tokens are stored in plaintext. Users should:
- Implement custom encrypted storage for production
- Use secure backend token management
- Set restrictive file permissions (Node.js)
- Use sessionStorage over localStorage (browser)

### 2. File Permissions
**Status**: Not Configured
**Impact**: Low-Medium
**Mitigation**: `FileTokenStorage` doesn't set file permissions. Users should:
- Manually set restrictive permissions (0o600) on token files
- Store token files outside web-accessible directories
- Use encrypted file systems for sensitive deployments

### 3. XSS Vulnerability in Browser
**Status**: Inherent to localStorage/sessionStorage
**Impact**: High (if XSS exists in application)
**Mitigation**:
- This library doesn't protect against XSS in your application
- Users must implement proper XSS protection:
  - Content Security Policy
  - Input sanitization
  - Output encoding
- Consider httpOnly cookies for production

### 4. Debug Logging
**Status**: Disabled in Production by Default
**Impact**: Low
**Mitigation**: Debug logging is environment-aware:
- Only enabled when `NODE_ENV=development` or `localhost`
- Never logs sensitive data (tokens, API keys)
- Users can implement custom logger for additional control

## Reporting a Vulnerability

If you discover a security vulnerability in this library, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security details to: profplum700@users.noreply.github.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 7 days
- Work on a fix and coordinated disclosure
- Credit you in the security advisory (unless you prefer to remain anonymous)

## Security Checklist for Production

- [ ] API keys stored in environment variables
- [ ] Tokens never hardcoded or committed to version control
- [ ] Custom encrypted token storage implemented (if needed)
- [ ] File permissions set to 0o600 for token files (Node.js)
- [ ] HTTPS enforced for all OAuth redirects
- [ ] XSS protection implemented (browser applications)
- [ ] Content Security Policy configured
- [ ] Rate limiting enabled
- [ ] Error handling doesn't expose sensitive data
- [ ] Logging configured for security events
- [ ] Regular dependency updates scheduled
- [ ] Security monitoring in place

## Dependencies

This library has **zero production dependencies**, which significantly reduces the attack surface from supply chain vulnerabilities.

Development dependencies are regularly audited:
```bash
npm audit
```

## Updates and Patches

Security patches are released as soon as possible after a vulnerability is discovered and verified. Users should:
- Subscribe to GitHub Security Advisories
- Keep the library updated to the latest version
- Monitor the CHANGELOG for security-related updates

## Additional Resources

- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/rfc8252)
- [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Etsy API Security Documentation](https://developers.etsy.com/documentation)

---

**Last Updated**: 2025-01-06
**Version**: 2.0.0
