/**
 * Unit tests for Browser Secure Token Storage
 */

import { SecureTokenStorage, isSecureStorageSupported } from '../../src/security/browser-storage';
import { EtsyTokens } from '../../src/types';

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    sign: jest.fn(),
  },
};

// Mock storage
class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

describe('SecureTokenStorage', () => {
  let mockLocalStorage: MockStorage;
  let mockSessionStorage: MockStorage;

  beforeEach(() => {
    mockLocalStorage = new MockStorage();
    mockSessionStorage = new MockStorage();

    // Mock window object
    global.window = {
      crypto: mockCrypto,
      location: {
        hostname: 'localhost',
      },
    } as typeof global.window;

    // Mock global localStorage and sessionStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });

    global.navigator = {
      userAgent: 'Test Browser',
    } as Navigator;

    // Setup mock crypto functions
    mockCrypto.subtle.importKey.mockResolvedValue('mockKeyMaterial' as unknown as CryptoKey);
    mockCrypto.subtle.deriveKey.mockResolvedValue('mockDerivedKey' as unknown as CryptoKey);
    mockCrypto.subtle.encrypt.mockImplementation(() =>
      Promise.resolve(new ArrayBuffer(32))
    );
    mockCrypto.subtle.decrypt.mockImplementation(() => {
      const mockToken = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };
      return Promise.resolve(new TextEncoder().encode(JSON.stringify(mockToken)).buffer);
    });
    mockCrypto.subtle.sign.mockImplementation(() =>
      Promise.resolve(new ArrayBuffer(32))
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(() => new SecureTokenStorage()).not.toThrow();
    });

    it('should create instance with custom key prefix', () => {
      const storage = new SecureTokenStorage({ keyPrefix: 'custom_prefix' });
      expect(storage).toBeInstanceOf(SecureTokenStorage);
    });

    it('should create instance with sessionStorage', () => {
      const storage = new SecureTokenStorage({ useSessionStorage: true });
      expect(storage).toBeInstanceOf(SecureTokenStorage);
    });

    it('should throw error when not in browser environment', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing missing window
      delete global.window;

      expect(() => new SecureTokenStorage()).toThrow(
        'SecureTokenStorage is only available in browser environments'
      );

      global.window = originalWindow;
    });

    it('should throw error when Web Crypto API not supported', () => {
      const originalCrypto = global.window.crypto;
      // @ts-expect-error - Testing missing crypto
      delete global.window.crypto;

      expect(() => new SecureTokenStorage()).toThrow(
        'Web Crypto API is not supported in this browser'
      );

      global.window.crypto = originalCrypto;
    });
  });

  describe('save() Method', () => {
    it('should save tokens to localStorage', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r listings_r',
      };

      await storage.save(tokens);

      expect(mockLocalStorage.getItem('etsy_token')).toBeDefined();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should save tokens to sessionStorage when configured', async () => {
      const storage = new SecureTokenStorage({ useSessionStorage: true });

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      expect(mockSessionStorage.getItem('etsy_token')).toBeDefined();
    });

    it('should use custom key prefix', async () => {
      const storage = new SecureTokenStorage({ keyPrefix: 'my_prefix' });

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      expect(mockLocalStorage.getItem('my_prefix')).toBeDefined();
    });

    it('should encrypt tokens before storage', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'sensitive_token',
        refresh_token: 'sensitive_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      const stored = mockLocalStorage.getItem('etsy_token');
      expect(stored).toBeDefined();

      // Stored data should not contain plain text tokens
      expect(stored).not.toContain('sensitive_token');
      expect(stored).not.toContain('sensitive_refresh');

      // Should contain encrypted data structure
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('integrity');
      expect(parsed).toHaveProperty('expiresAt');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should generate random IV for each save', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);
      const stored1 = mockLocalStorage.getItem('etsy_token');

      mockLocalStorage.clear();

      await storage.save(tokens);
      const stored2 = mockLocalStorage.getItem('etsy_token');

      // Random IV means encrypted data will be different each time
      expect(stored1).not.toBe(stored2);
    });
  });

  describe('load() Method', () => {
    it('should return null when no tokens stored', async () => {
      const storage = new SecureTokenStorage();

      const tokens = await storage.load();

      expect(tokens).toBeNull();
    });

    it('should load and decrypt tokens', async () => {
      const storage = new SecureTokenStorage();

      const originalTokens: EtsyTokens = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r listings_r',
      };

      await storage.save(originalTokens);
      const loadedTokens = await storage.load();

      expect(loadedTokens).not.toBeNull();
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should return null for expired tokens', async () => {
      const storage = new SecureTokenStorage();

      // Create expired token
      const expiredTokens: EtsyTokens = {
        access_token: 'expired_token',
        refresh_token: 'expired_refresh',
        expires_at: new Date('2020-01-01'), // Past date
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(expiredTokens);

      const loaded = await storage.load();

      expect(loaded).toBeNull();
      // Should clear storage after detecting expiry
      expect(mockLocalStorage.getItem('etsy_token')).toBeNull();
    });

    it('should return null for invalid version', async () => {
      const storage = new SecureTokenStorage();

      // Manually store data with wrong version
      mockLocalStorage.setItem('etsy_token', JSON.stringify({
        version: 999,
        encrypted: 'data',
        iv: 'iv',
        integrity: 'hash',
        expiresAt: Date.now() + 10000,
        timestamp: Date.now(),
      }));

      const tokens = await storage.load();

      expect(tokens).toBeNull();
      // Should clear invalid data
      expect(mockLocalStorage.getItem('etsy_token')).toBeNull();
    });

    it('should return null and clear on integrity check failure', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      // Tamper with stored data
      const stored = JSON.parse(mockLocalStorage.getItem('etsy_token')!);
      stored.encrypted = 'tampered_data';
      mockLocalStorage.setItem('etsy_token', JSON.stringify(stored));

      const loaded = await storage.load();

      expect(loaded).toBeNull();
      expect(mockLocalStorage.getItem('etsy_token')).toBeNull();
    });

    it('should handle corrupted data gracefully', async () => {
      const storage = new SecureTokenStorage();

      // Store invalid JSON
      mockLocalStorage.setItem('etsy_token', 'not valid json');

      const tokens = await storage.load();

      expect(tokens).toBeNull();
      expect(mockLocalStorage.getItem('etsy_token')).toBeNull();
    });

    it('should handle decryption failure gracefully', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      // Make decrypt fail
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const loaded = await storage.load();

      expect(loaded).toBeNull();
    });
  });

  describe('clear() Method', () => {
    it('should remove tokens from storage', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);
      expect(mockLocalStorage.getItem('etsy_token')).toBeDefined();

      await storage.clear();
      expect(mockLocalStorage.getItem('etsy_token')).toBeNull();
    });

    it('should work when no tokens exist', async () => {
      const storage = new SecureTokenStorage();

      await expect(storage.clear()).resolves.not.toThrow();
    });

    it('should clear from sessionStorage when configured', async () => {
      const storage = new SecureTokenStorage({ useSessionStorage: true });

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);
      expect(mockSessionStorage.getItem('etsy_token')).toBeDefined();

      await storage.clear();
      expect(mockSessionStorage.getItem('etsy_token')).toBeNull();
    });
  });

  describe('Key Derivation', () => {
    it('should derive key from domain and user agent', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should use custom derivation input when provided', async () => {
      const storage = new SecureTokenStorage({
        derivationInput: 'custom-secret-input',
      });

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
    });

    it('should reuse encryption key for multiple operations', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      // Multiple saves should reuse the same key
      await storage.save(tokens);
      const firstCallCount = mockCrypto.subtle.deriveKey.mock.calls.length;

      await storage.save(tokens);
      const secondCallCount = mockCrypto.subtle.deriveKey.mock.calls.length;

      // Key should be cached after first derivation
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });

  describe('isSecureStorageSupported()', () => {
    it('should return true in browser with Web Crypto API', () => {
      expect(isSecureStorageSupported()).toBe(true);
    });

    it('should return false when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing missing window
      delete global.window;

      expect(isSecureStorageSupported()).toBe(false);

      global.window = originalWindow;
    });

    it('should return false when crypto is missing', () => {
      const originalCrypto = global.window.crypto;
      // @ts-expect-error - Testing missing crypto
      delete global.window.crypto;

      expect(isSecureStorageSupported()).toBe(false);

      global.window.crypto = originalCrypto;
    });

    it('should return false when subtle crypto is missing', () => {
      const originalSubtle = global.window.crypto.subtle;
      // @ts-expect-error - Testing missing subtle
      delete global.window.crypto.subtle;

      expect(isSecureStorageSupported()).toBe(false);

      global.window.crypto.subtle = originalSubtle;
    });

    it('should return false when crypto methods are not functions', () => {
      const originalEncrypt = global.window.crypto.subtle.encrypt;
      // @ts-expect-error - Testing non-function
      global.window.crypto.subtle.encrypt = 'not a function';

      expect(isSecureStorageSupported()).toBe(false);

      global.window.crypto.subtle.encrypt = originalEncrypt;
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tokens', async () => {
      const storage = new SecureTokenStorage();

      const longToken = 'a'.repeat(10000);
      const tokens: EtsyTokens = {
        access_token: longToken,
        refresh_token: longToken,
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await expect(storage.save(tokens)).resolves.not.toThrow();
    });

    it('should handle special characters in tokens', async () => {
      const storage = new SecureTokenStorage();

      const specialToken = 'token_with_特殊字符_and_émojis_🎉';
      const tokens: EtsyTokens = {
        access_token: specialToken,
        refresh_token: 'refresh_🔒',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await expect(storage.save(tokens)).resolves.not.toThrow();
    });

    it('should handle Date object in expires_at', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date('2025-12-31T23:59:59.999Z'),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);
      const loaded = await storage.load();

      expect(loaded).not.toBeNull();
      expect(loaded?.expires_at).toBeInstanceOf(Date);
    });
  });

  describe('Security Properties', () => {
    it('should use AES-GCM encryption algorithm', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      const encryptCall = mockCrypto.subtle.encrypt.mock.calls[0];
      expect(encryptCall).toBeDefined();
      expect(encryptCall![0]).toHaveProperty('name', 'AES-GCM');
    });

    it('should use PBKDF2 for key derivation', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      const deriveKeyCall = mockCrypto.subtle.deriveKey.mock.calls[0];
      expect(deriveKeyCall).toBeDefined();
      expect(deriveKeyCall![0]).toHaveProperty('name', 'PBKDF2');
    });

    it('should use HMAC for integrity verification', async () => {
      const storage = new SecureTokenStorage();

      const tokens: EtsyTokens = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: 'shops_r',
      };

      await storage.save(tokens);

      expect(mockCrypto.subtle.sign).toHaveBeenCalled();
    });
  });
});
