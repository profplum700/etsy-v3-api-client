/**
 * Encrypted token storage implementation
 * Provides AES-256-GCM encrypted storage for OAuth tokens
 */

import { TokenStorage, EtsyTokens } from '../types';
import { isNode } from '../utils/environment';
import { encryptAES256GCM, decryptAES256GCM, validateEncryptionKey, EncryptedData } from './encryption';

/**
 * Configuration for encrypted file token storage
 */
export interface EncryptedStorageConfig {
  /**
   * Path to the encrypted token file
   */
  filePath: string;

  /**
   * Encryption key (must be 32 bytes for AES-256)
   * This should be stored securely (e.g., environment variable, key management service)
   */
  encryptionKey: string | Buffer;

  /**
   * File permissions mode (default: 0o600 - owner read/write only)
   */
  fileMode?: number;
}

/**
 * Encrypted file format
 */
interface EncryptedFileData {
  /**
   * Format version for future compatibility
   */
  version: number;

  /**
   * Encrypted token data
   */
  encrypted: EncryptedData;

  /**
   * Timestamp when the file was created/updated
   */
  timestamp: number;
}

/**
 * Encrypted file-based token storage for Node.js environments
 *
 * This implementation provides:
 * - AES-256-GCM authenticated encryption
 * - Tokens encrypted at rest
 * - Protection against file system access attacks
 * - Restrictive file permissions (owner read/write only)
 *
 * @example
 * ```typescript
 * const storage = new EncryptedFileTokenStorage({
 *   filePath: './tokens.enc',
 *   encryptionKey: process.env.ENCRYPTION_KEY // 32-byte key from env
 * });
 *
 * const client = new EtsyClient(config, storage);
 * ```
 *
 * SECURITY NOTES:
 * - Encryption key must be 32 bytes (256 bits) for AES-256
 * - Store encryption key securely (environment variable, KMS, etc.)
 * - Never commit encryption key or encrypted files to version control
 * - File permissions are set to 0o600 (owner read/write only)
 * - Uses authenticated encryption (GCM mode) to prevent tampering
 */
export class EncryptedFileTokenStorage implements TokenStorage {
  private filePath: string;
  private encryptionKey: Buffer;
  private fileMode: number;

  constructor(config: EncryptedStorageConfig) {
    if (!isNode) {
      throw new Error('EncryptedFileTokenStorage is only available in Node.js environments');
    }

    this.filePath = config.filePath;
    this.fileMode = config.fileMode ?? 0o600;

    // Validate and store encryption key
    const keyBuffer = Buffer.isBuffer(config.encryptionKey)
      ? config.encryptionKey
      : Buffer.from(config.encryptionKey, 'utf8');

    validateEncryptionKey(keyBuffer, 32);
    this.encryptionKey = keyBuffer;
  }

  /**
   * Save tokens to encrypted file
   *
   * @param tokens - Tokens to save
   */
  async save(tokens: EtsyTokens): Promise<void> {
    if (!isNode) {
      throw new Error('EncryptedFileTokenStorage is only available in Node.js');
    }

    try {
      // Serialize tokens to JSON
      const tokenData = JSON.stringify(tokens);

      // Encrypt token data
      const encrypted = await encryptAES256GCM(tokenData, this.encryptionKey);

      // Create encrypted file data
      const fileData: EncryptedFileData = {
        version: 1,
        encrypted,
        timestamp: Date.now()
      };

      // Write encrypted data to file
      const fileContent = JSON.stringify(fileData, null, 2);
      await this._writeFile(this.filePath, fileContent);

      // Set restrictive file permissions (owner read/write only)
      await this._setFilePermissions(this.filePath, this.fileMode);
    } catch (error) {
      throw new Error(
        `Failed to save encrypted tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load tokens from encrypted file
   *
   * @returns Tokens if file exists and is valid, null otherwise
   */
  async load(): Promise<EtsyTokens | null> {
    if (!isNode) {
      return null;
    }

    try {
      // Read encrypted file
      const fileContent = await this._readFile(this.filePath);
      const fileData: EncryptedFileData = JSON.parse(fileContent);

      // Validate file format version
      if (fileData.version !== 1) {
        throw new Error(`Unsupported encrypted file format version: ${fileData.version}`);
      }

      // Decrypt token data
      const decryptedData = await decryptAES256GCM(fileData.encrypted, this.encryptionKey);
      const tokens = JSON.parse(decryptedData);

      // Convert expires_at string back to Date
      if (tokens.expires_at) {
        tokens.expires_at = new Date(tokens.expires_at);
      }

      return tokens;
    } catch (error) {
      // File doesn't exist, is invalid, or decryption failed
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // File doesn't exist - this is not an error
        return null;
      }

      // For other errors (invalid format, decryption failure), log and return null
      console.error(
        'Failed to load encrypted tokens:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return null;
    }
  }

  /**
   * Clear encrypted token file
   */
  async clear(): Promise<void> {
    if (!isNode) {
      return;
    }

    try {
      await this._deleteFile(this.filePath);
    } catch (error) {
      // File doesn't exist or already deleted - ignore
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.error(
          'Failed to clear encrypted tokens:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  /**
   * Get file path (for testing/debugging)
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if encrypted token file exists
   */
  async exists(): Promise<boolean> {
    if (!isNode) {
      return false;
    }

    try {
      await this._stat(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods that will be excluded from browser builds
  private async _writeFile(filePath: string, data: string): Promise<void> {
    if (typeof process === 'undefined') return;
    const fs = await import('fs');
    await fs.promises.writeFile(filePath, data, 'utf8');
  }

  private async _setFilePermissions(filePath: string, mode: number): Promise<void> {
    if (typeof process === 'undefined') return;
    try {
      const fs = await import('fs');
      await fs.promises.chmod(filePath, mode);
    } catch {
      // Chmod may not be supported on all platforms (e.g., Windows)
      // Fail silently as the file is still created
    }
  }

  private async _readFile(filePath: string): Promise<string> {
    if (typeof process === 'undefined') throw new Error('Not available');
    const fs = await import('fs');
    return await fs.promises.readFile(filePath, 'utf8');
  }

  private async _deleteFile(filePath: string): Promise<void> {
    if (typeof process === 'undefined') return;
    const fs = await import('fs');
    await fs.promises.unlink(filePath);
  }

  private async _stat(filePath: string): Promise<unknown> {
    if (typeof process === 'undefined') throw new Error('Not available');
    const fs = await import('fs');
    return await fs.promises.stat(filePath);
  }
}
