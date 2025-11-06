/**
 * Encryption utilities for secure token storage
 * Provides AES-256-GCM encryption for tokens at rest
 */

import { isNode } from '../utils/environment';

/**
 * Encryption result containing encrypted data and metadata
 */
export interface EncryptedData {
  /**
   * Encrypted data as base64 string
   */
  ciphertext: string;

  /**
   * Initialization vector (IV) as base64 string
   */
  iv: string;

  /**
   * Authentication tag as base64 string (for GCM mode)
   */
  authTag: string;

  /**
   * Algorithm used for encryption
   */
  algorithm: string;
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - Data to encrypt (string)
 * @param key - Encryption key (must be 32 bytes for AES-256)
 * @returns Encrypted data with IV and auth tag
 */
export async function encryptAES256GCM(
  data: string,
  key: Buffer | string
): Promise<EncryptedData> {
  if (!isNode) {
    throw new Error('AES-256-GCM encryption is only available in Node.js environments');
  }

  const crypto = await import('crypto');

  // Validate key length
  const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'utf8');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes for AES-256');
  }

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  // Encrypt data
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: 'aes-256-gcm'
  };
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Encrypted data with IV and auth tag
 * @param key - Decryption key (must be 32 bytes for AES-256)
 * @returns Decrypted data as string
 */
export async function decryptAES256GCM(
  encryptedData: EncryptedData,
  key: Buffer | string
): Promise<string> {
  if (!isNode) {
    throw new Error('AES-256-GCM decryption is only available in Node.js environments');
  }

  const crypto = await import('crypto');

  // Validate key length
  const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'utf8');
  if (keyBuffer.length !== 32) {
    throw new Error('Decryption key must be exactly 32 bytes for AES-256');
  }

  // Validate algorithm
  if (encryptedData.algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
  }

  // Convert base64 strings to buffers
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  // Decrypt data
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate a secure encryption key
 *
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns Random encryption key as Buffer
 */
export async function generateEncryptionKey(length: number = 32): Promise<Buffer> {
  if (!isNode) {
    throw new Error('Key generation is only available in Node.js environments');
  }

  const crypto = await import('crypto');
  return crypto.randomBytes(length);
}

/**
 * Derive an encryption key from a password using PBKDF2
 *
 * @param password - Password to derive key from
 * @param salt - Salt for key derivation (should be random and stored)
 * @param iterations - Number of iterations (default: 100000)
 * @param keyLength - Key length in bytes (default: 32 for AES-256)
 * @returns Derived encryption key
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Buffer | string,
  iterations: number = 100000,
  keyLength: number = 32
): Promise<Buffer> {
  if (!isNode) {
    throw new Error('Key derivation is only available in Node.js environments');
  }

  const crypto = await import('crypto');
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'utf8');

  return new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, saltBuffer, iterations, keyLength, 'sha256', (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Validate encryption key format and length
 *
 * @param key - Key to validate
 * @param requiredLength - Required key length in bytes (default: 32)
 * @returns true if key is valid
 * @throws Error if key is invalid
 */
export function validateEncryptionKey(
  key: Buffer | string,
  requiredLength: number = 32
): boolean {
  const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'utf8');

  if (keyBuffer.length !== requiredLength) {
    throw new Error(
      `Invalid encryption key length: expected ${requiredLength} bytes, got ${keyBuffer.length} bytes`
    );
  }

  return true;
}
