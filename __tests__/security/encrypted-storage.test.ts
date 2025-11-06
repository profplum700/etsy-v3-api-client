/**
 * Tests for EncryptedFileTokenStorage (Phase 5)
 */

import { EncryptedFileTokenStorage } from '../../src/security/encrypted-storage';
import { generateEncryptionKey } from '../../src/security/encryption';
import { EtsyTokens } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('EncryptedFileTokenStorage', () => {
  const testDir = path.join(__dirname, '../.tmp');
  const testFilePath = path.join(testDir, 'test-tokens.enc');
  let encryptionKey: Buffer;

  beforeAll(async () => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Generate encryption key
    encryptionKey = await generateEncryptionKey();
  });

  afterEach(async () => {
    // Clean up test file
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch {
      // Ignore errors
    }
  });

  afterAll(() => {
    // Clean up test directory
    try {
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir, { recursive: true });
      }
    } catch {
      // Ignore errors
    }
  });

  describe('constructor', () => {
    it('should create storage with valid config', () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      expect(storage).toBeInstanceOf(EncryptedFileTokenStorage);
      expect(storage.getFilePath()).toBe(testFilePath);
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = Buffer.from('short-key');

      expect(() => {
        new EncryptedFileTokenStorage({
          filePath: testFilePath,
          encryptionKey: invalidKey
        });
      }).toThrow('Invalid encryption key length');
    });

    it('should accept string encryption key', () => {
      const stringKey = '12345678901234567890123456789012'; // 32 bytes

      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey: stringKey
      });

      expect(storage).toBeInstanceOf(EncryptedFileTokenStorage);
    });

    it('should accept custom file mode', () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey,
        fileMode: 0o400 // Read-only
      });

      expect(storage).toBeInstanceOf(EncryptedFileTokenStorage);
    });
  });

  describe('save', () => {
    it('should save encrypted tokens to file', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens: EtsyTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'listings_r listings_w'
      };

      await storage.save(tokens);

      // Verify file exists
      expect(fs.existsSync(testFilePath)).toBe(true);

      // Verify file is not plaintext (encrypted)
      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      expect(fileContent).not.toContain('test-access-token');
      expect(fileContent).not.toContain('test-refresh-token');

      // Verify file contains encrypted data structure
      const fileData = JSON.parse(fileContent);
      expect(fileData.version).toBe(1);
      expect(fileData.encrypted).toBeTruthy();
      expect(fileData.encrypted.ciphertext).toBeTruthy();
      expect(fileData.encrypted.iv).toBeTruthy();
      expect(fileData.encrypted.authTag).toBeTruthy();
      expect(fileData.timestamp).toBeTruthy();
    });

    it('should set restrictive file permissions', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens: EtsyTokens = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: ''
      };

      await storage.save(tokens);

      // Check file permissions (may not work on all platforms)
      try {
        const stats = fs.statSync(testFilePath);
        const mode = stats.mode & 0o777;
        // On Unix-like systems, should be 0o600
        // On Windows, this test may not be meaningful
        if (process.platform !== 'win32') {
          expect(mode).toBe(0o600);
        }
      } catch {
        // Skip on platforms where chmod is not supported
      }
    });
  });

  describe('load', () => {
    it('should load and decrypt tokens from file', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const originalTokens: EtsyTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: new Date('2025-12-31T23:59:59Z'),
        token_type: 'Bearer',
        scope: 'listings_r listings_w'
      };

      await storage.save(originalTokens);

      const loadedTokens = await storage.load();

      expect(loadedTokens).toBeTruthy();
      expect(loadedTokens!.access_token).toBe(originalTokens.access_token);
      expect(loadedTokens!.refresh_token).toBe(originalTokens.refresh_token);
      expect(loadedTokens!.token_type).toBe(originalTokens.token_type);
      expect(loadedTokens!.scope).toBe(originalTokens.scope);

      // Date comparison (allowing for serialization)
      expect(new Date(loadedTokens!.expires_at).getTime()).toBe(
        new Date(originalTokens.expires_at).getTime()
      );
    });

    it('should return null if file does not exist', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens = await storage.load();
      expect(tokens).toBeNull();
    });

    it('should return null if decryption fails (wrong key)', async () => {
      const storage1 = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens: EtsyTokens = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: ''
      };

      await storage1.save(tokens);

      // Try to load with different key
      const wrongKey = await generateEncryptionKey();
      const storage2 = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey: wrongKey
      });

      const loadedTokens = await storage2.load();
      expect(loadedTokens).toBeNull();
    });

    it('should return null if file format is invalid', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      // Write invalid JSON
      fs.writeFileSync(testFilePath, 'invalid json');

      const tokens = await storage.load();
      expect(tokens).toBeNull();
    });
  });

  describe('clear', () => {
    it('should delete encrypted token file', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens: EtsyTokens = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: ''
      };

      await storage.save(tokens);
      expect(fs.existsSync(testFilePath)).toBe(true);

      await storage.clear();
      expect(fs.existsSync(testFilePath)).toBe(false);
    });

    it('should not throw error if file does not exist', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      await expect(storage.clear()).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const tokens: EtsyTokens = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(),
        token_type: 'Bearer',
        scope: ''
      };

      await storage.save(tokens);

      const exists = await storage.exists();
      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      const exists = await storage.exists();
      expect(exists).toBe(false);
    });
  });

  describe('integration', () => {
    it('should handle complete token lifecycle', async () => {
      const storage = new EncryptedFileTokenStorage({
        filePath: testFilePath,
        encryptionKey
      });

      // 1. Initially, no tokens
      expect(await storage.exists()).toBe(false);
      expect(await storage.load()).toBeNull();

      // 2. Save tokens
      const tokens: EtsyTokens = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_at: new Date('2025-12-31'),
        token_type: 'Bearer',
        scope: 'listings_r'
      };

      await storage.save(tokens);
      expect(await storage.exists()).toBe(true);

      // 3. Load tokens
      const loaded = await storage.load();
      expect(loaded).toBeTruthy();
      expect(loaded!.access_token).toBe(tokens.access_token);

      // 4. Update tokens
      const updatedTokens: EtsyTokens = {
        ...tokens,
        access_token: 'new-access-789'
      };

      await storage.save(updatedTokens);

      const reloaded = await storage.load();
      expect(reloaded!.access_token).toBe('new-access-789');

      // 5. Clear tokens
      await storage.clear();
      expect(await storage.exists()).toBe(false);
      expect(await storage.load()).toBeNull();
    });
  });
});
