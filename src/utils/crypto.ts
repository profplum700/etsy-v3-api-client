/**
 * Universal cryptographic utilities that work in both Node.js and browser environments
 */

/**
 * Environment detection
 */
const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

/**
 * Generate cryptographically secure random bytes
 */
export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  if (isBrowser) {
    // Browser environment - use Web Crypto API
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  } else if (isNode) {
    // Node.js environment - use crypto module
    try {
      const crypto = await import(/* webpackIgnore: true */ 'crypto');
      return new Uint8Array(crypto.randomBytes(length));
    } catch {
      throw new Error('Node.js crypto module not available');
    }
  } else {
    throw new Error('Crypto functions are not available in this environment');
  }
}

/**
 * Generate a base64url-encoded random string
 */
export async function generateRandomBase64Url(length: number): Promise<string> {
  const bytes = await generateRandomBytes(length);
  return base64UrlEncode(bytes);
}

/**
 * Create SHA256 hash
 */
export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;

  if (isBrowser) {
    // Browser environment - use Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    return new Uint8Array(hashBuffer);
  } else if (isNode) {
    // Node.js environment - use crypto module
    try {
      const crypto = await import(/* webpackIgnore: true */ 'crypto');
      const hash = crypto.createHash('sha256');
      hash.update(dataBytes);
      return new Uint8Array(hash.digest());
    } catch {
      throw new Error('Node.js crypto module not available');
    }
  } else {
    throw new Error('SHA256 is not available in this environment');
  }
}

/**
 * Create SHA256 hash and encode as base64url
 */
export async function sha256Base64Url(data: string | Uint8Array): Promise<string> {
  const hash = await sha256(data);
  return base64UrlEncode(hash);
}

/**
 * Base64URL encode (without padding)
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  if (isBrowser) {
    // Browser environment - use btoa
    const binaryString = String.fromCharCode(...bytes);
    const base64 = btoa(binaryString);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } else if (isNode) {
    // Node.js environment - use Buffer
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } else {
    throw new Error('Base64URL encoding is not available in this environment');
  }
}

/**
 * Base64URL decode
 */
export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padded = str + '==='.slice((str.length + 3) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');

  if (isBrowser) {
    // Browser environment - use atob
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.split('').map(char => char.charCodeAt(0)));
  } else if (isNode) {
    // Node.js environment - use Buffer
    return new Uint8Array(Buffer.from(base64, 'base64'));
  } else {
    throw new Error('Base64URL decoding is not available in this environment');
  }
}

/**
 * Generate a code verifier for PKCE (43-128 characters, base64url)
 */
export async function generateCodeVerifier(): Promise<string> {
  return generateRandomBase64Url(32); // 32 bytes = 43 base64url characters
}

/**
 * Generate a state parameter for OAuth (32 bytes, base64url)
 */
export async function generateState(): Promise<string> {
  return generateRandomBase64Url(32);
}

/**
 * Create PKCE code challenge from code verifier
 */
export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  return sha256Base64Url(codeVerifier);
}