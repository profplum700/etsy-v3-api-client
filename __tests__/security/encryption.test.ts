/**
 * Tests for encryption utilities (Phase 5)
 */

import {
  encryptAES256GCM,
  decryptAES256GCM,
  generateEncryptionKey,
  deriveKeyFromPassword,
  validateEncryptionKey
} from '../../src/security/encryption';

describe('Encryption Utilities', () => {
  describe('encryptAES256GCM and decryptAES256GCM', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const data = 'sensitive token data';
      const key = await generateEncryptionKey();

      const encrypted = await encryptAES256GCM(data, key);
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = await decryptAES256GCM(encrypted, key);
      expect(decrypted).toBe(data);
    });

    it('should encrypt complex JSON data', async () => {
      const data = JSON.stringify({
        access_token: 'token123',
        refresh_token: 'refresh456',
        expires_at: new Date().toISOString()
      });
      const key = await generateEncryptionKey();

      const encrypted = await encryptAES256GCM(data, key);
      const decrypted = await decryptAES256GCM(encrypted, key);
      expect(decrypted).toBe(data);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
    });

    it('should fail decryption with wrong key', async () => {
      const data = 'sensitive data';
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      const encrypted = await encryptAES256GCM(data, key1);

      await expect(decryptAES256GCM(encrypted, key2)).rejects.toThrow();
    });

    it('should fail decryption with tampered data', async () => {
      const data = 'sensitive data';
      const key = await generateEncryptionKey();

      const encrypted = await encryptAES256GCM(data, key);

      // Tamper with the ciphertext by modifying the binary data
      const ciphertextBuffer = Buffer.from(encrypted.ciphertext, 'base64');
      if (ciphertextBuffer.length > 0) {
        ciphertextBuffer[0] = ciphertextBuffer[0] ^ 0xFF; // Flip all bits of first byte
      }

      const tampered = {
        ...encrypted,
        ciphertext: ciphertextBuffer.toString('base64')
      };

      await expect(decryptAES256GCM(tampered, key)).rejects.toThrow();
    });

    it('should throw error for invalid key length', async () => {
      const data = 'test data';
      const invalidKey = Buffer.from('short-key');

      await expect(encryptAES256GCM(data, invalidKey)).rejects.toThrow('must be exactly 32 bytes');
    });

    it('should work with string keys of correct length', async () => {
      const data = 'test data';
      const key = '12345678901234567890123456789012'; // 32 characters

      const encrypted = await encryptAES256GCM(data, key);
      const decrypted = await decryptAES256GCM(encrypted, key);
      expect(decrypted).toBe(data);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 32-byte key by default', async () => {
      const key = await generateEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate keys of custom length', async () => {
      const key16 = await generateEncryptionKey(16);
      expect(key16.length).toBe(16);

      const key64 = await generateEncryptionKey(64);
      expect(key64.length).toBe(64);
    });

    it('should generate unique keys', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('deriveKeyFromPassword', () => {
    it('should derive a key from password', async () => {
      const password = 'my-secure-password';
      const salt = 'random-salt-12345';

      const key = await deriveKeyFromPassword(password, salt);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should derive consistent keys with same password and salt', async () => {
      const password = 'my-password';
      const salt = 'my-salt';

      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);

      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys with different passwords', async () => {
      const salt = 'same-salt';

      const key1 = await deriveKeyFromPassword('password1', salt);
      const key2 = await deriveKeyFromPassword('password2', salt);

      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive different keys with different salts', async () => {
      const password = 'same-password';

      const key1 = await deriveKeyFromPassword(password, 'salt1');
      const key2 = await deriveKeyFromPassword(password, 'salt2');

      expect(key1.equals(key2)).toBe(false);
    });

    it('should support custom key length', async () => {
      const password = 'password';
      const salt = 'salt';

      const key16 = await deriveKeyFromPassword(password, salt, 100000, 16);
      expect(key16.length).toBe(16);

      const key64 = await deriveKeyFromPassword(password, salt, 100000, 64);
      expect(key64.length).toBe(64);
    });
  });

  describe('validateEncryptionKey', () => {
    it('should validate correct key length', () => {
      const key = Buffer.alloc(32);
      expect(() => validateEncryptionKey(key)).not.toThrow();
      expect(validateEncryptionKey(key)).toBe(true);
    });

    it('should throw error for incorrect key length', () => {
      const key = Buffer.alloc(16);
      expect(() => validateEncryptionKey(key)).toThrow('expected 32 bytes, got 16 bytes');
    });

    it('should validate string keys', () => {
      const key = '12345678901234567890123456789012'; // 32 characters
      expect(() => validateEncryptionKey(key)).not.toThrow();
    });

    it('should support custom required length', () => {
      const key16 = Buffer.alloc(16);
      expect(() => validateEncryptionKey(key16, 16)).not.toThrow();

      const key32 = Buffer.alloc(32);
      expect(() => validateEncryptionKey(key32, 32)).not.toThrow();
    });
  });
});
