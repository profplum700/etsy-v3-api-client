/**
 * Secure token storage for browser environments using Web Crypto API
 * Provides encrypted localStorage with integrity validation
 */

import { TokenStorage, EtsyTokens } from '../types';

/**
 * Configuration for secure browser token storage
 */
export interface SecureTokenStorageConfig {
  /**
   * Storage key prefix (default: 'etsy_token')
   */
  keyPrefix?: string;

  /**
   * Custom encryption key derivation input
   * If not provided, a key is derived from the domain and user agent
   */
  derivationInput?: string;

  /**
   * Whether to use sessionStorage instead of localStorage
   * sessionStorage: Tokens cleared on tab close (more secure)
   * localStorage: Tokens persist across sessions (better UX)
   * @default false (uses localStorage)
   */
  useSessionStorage?: boolean;
}

/**
 * Encrypted token data structure
 */
interface EncryptedTokenData {
  /**
   * Format version for future compatibility
   */
  version: number;

  /**
   * Encrypted token data (base64)
   */
  encrypted: string;

  /**
   * Initialization vector (base64)
   */
  iv: string;

  /**
   * HMAC integrity hash (base64)
   */
  integrity: string;

  /**
   * Token expiry timestamp
   */
  expiresAt: number;

  /**
   * When this encrypted data was created
   */
  timestamp: number;
}

/**
 * Secure token storage for browser environments
 *
 * Features:
 * - AES-GCM encryption using Web Crypto API
 * - Automatic key derivation from domain/user agent
 * - Integrity validation (HMAC)
 * - Automatic expiry handling
 * - Works in all modern browsers
 *
 * @example
 * ```typescript
 * import { SecureTokenStorage } from '@profplum700/etsy-v3-api-client/browser';
 *
 * const storage = new SecureTokenStorage({
 *   useSessionStorage: false, // Persist across sessions
 * });
 *
 * // Save tokens (automatically encrypted)
 * await storage.save({
 *   access_token: 'token',
 *   refresh_token: 'refresh',
 *   expires_at: new Date(),
 *   token_type: 'Bearer',
 *   scope: 'shops_r listings_r',
 * });
 *
 * // Load tokens (automatically decrypted and validated)
 * const tokens = await storage.load();
 * ```
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM for authenticated encryption
 * - Encryption key derived from domain + user agent (unique per browser/site)
 * - HMAC integrity check prevents tampering
 * - Automatic expiry validation
 * - No encryption key stored (derived on-demand)
 */
export class SecureTokenStorage implements TokenStorage {
  private readonly keyPrefix: string;
  private readonly derivationInput: string;
  private readonly storage: Storage;
  private encryptionKey: CryptoKey | null = null;

  constructor(config: SecureTokenStorageConfig = {}) {
    // Check browser environment
    if (typeof window === 'undefined') {
      throw new Error(
        'SecureTokenStorage is only available in browser environments. ' +
        'For Node.js, use EncryptedFileTokenStorage instead.'
      );
    }

    // Check Web Crypto API support
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        'Web Crypto API is not supported in this browser. ' +
        'Please use a modern browser (Chrome 37+, Firefox 34+, Safari 11+, Edge 79+).'
      );
    }

    this.keyPrefix = config.keyPrefix || 'etsy_token';
    this.derivationInput = config.derivationInput || this.getDefaultDerivationInput();
    this.storage = config.useSessionStorage ? sessionStorage : localStorage;
  }

  /**
   * Save tokens to encrypted storage
   */
  async save(tokens: EtsyTokens): Promise<void> {
    const key = await this.getEncryptionKey();

    // Convert tokens to JSON
    const tokenJson = JSON.stringify(tokens);
    const tokenData = new TextEncoder().encode(tokenJson);

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt with AES-GCM
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      tokenData
    );

    // Generate integrity hash
    const integrity = await this.generateIntegrity(encrypted, iv);

    // Create storage object
    const stored: EncryptedTokenData = {
      version: 1,
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      integrity: this.arrayBufferToBase64(integrity),
      expiresAt: tokens.expires_at.getTime(),
      timestamp: Date.now(),
    };

    // Save to storage
    this.storage.setItem(this.keyPrefix, JSON.stringify(stored));
  }

  /**
   * Load tokens from encrypted storage
   */
  async load(): Promise<EtsyTokens | null> {
    const stored = this.storage.getItem(this.keyPrefix);
    if (!stored) {
      return null;
    }

    try {
      const data: EncryptedTokenData = JSON.parse(stored);

      // Check version compatibility
      if (data.version !== 1) {
        console.warn('Unsupported token storage version. Clearing storage.');
        await this.clear();
        return null;
      }

      // Check expiry
      if (Date.now() > data.expiresAt) {
        console.info('Stored tokens have expired. Clearing storage.');
        await this.clear();
        return null;
      }

      // Verify integrity
      const encrypted = this.base64ToArrayBuffer(data.encrypted);
      const iv = this.base64ToArrayBuffer(data.iv);
      const storedIntegrity = this.base64ToArrayBuffer(data.integrity);
      const computedIntegrity = await this.generateIntegrity(encrypted, iv);

      if (!this.compareArrayBuffers(storedIntegrity, computedIntegrity)) {
        console.warn('Token integrity check failed. Data may have been tampered with. Clearing storage.');
        await this.clear();
        return null;
      }

      // Decrypt
      const key = await this.getEncryptionKey();
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        encrypted
      );

      // Parse tokens
      const tokenJson = new TextDecoder().decode(decrypted);
      const tokens = JSON.parse(tokenJson) as EtsyTokens;

      // Convert expires_at string back to Date
      tokens.expires_at = new Date(tokens.expires_at);

      return tokens;
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
      await this.clear();
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  async clear(): Promise<void> {
    this.storage.removeItem(this.keyPrefix);
  }

  /**
   * Get or derive encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Derive key from derivation input
    const keyMaterial = await this.deriveKeyMaterial();
    this.encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.stringToArrayBuffer('etsy-v3-api-client-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // Not extractable
      ['encrypt', 'decrypt']
    );

    return this.encryptionKey;
  }

  /**
   * Derive key material from derivation input
   */
  private async deriveKeyMaterial(): Promise<CryptoKey> {
    const keyData = this.stringToArrayBuffer(this.derivationInput);
    return window.crypto.subtle.importKey(
      'raw',
      keyData,
      'PBKDF2',
      false,
      ['deriveKey']
    );
  }

  /**
   * Generate HMAC integrity hash
   */
  private async generateIntegrity(
    encrypted: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer> {
    // Combine encrypted data and IV for integrity check
    const combined = new Uint8Array(encrypted.byteLength + iv.byteLength);
    combined.set(new Uint8Array(encrypted), 0);
    combined.set(new Uint8Array(iv), encrypted.byteLength);

    // Generate HMAC-SHA256
    const keyMaterial = await this.deriveKeyMaterial();
    const hmacKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.stringToArrayBuffer('etsy-integrity-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    return window.crypto.subtle.sign('HMAC', hmacKey, combined);
  }

  /**
   * Get default derivation input (domain + user agent)
   */
  private getDefaultDerivationInput(): string {
    const domain = window.location.hostname;
    const userAgent = navigator.userAgent;
    return `${domain}:${userAgent}`;
  }

  /**
   * Convert string to ArrayBuffer
   */
  private stringToArrayBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Compare two ArrayBuffers for equality
   */
  private compareArrayBuffers(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) {
      return false;
    }

    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);

    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Legacy browser support check
 */
export function isSecureStorageSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.encrypt === 'function' &&
    typeof window.crypto.subtle.decrypt === 'function' &&
    typeof window.crypto.subtle.deriveKey === 'function'
  );
}
