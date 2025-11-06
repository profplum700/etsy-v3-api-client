/**
 * Security Module
 *
 * Advanced security features for the Etsy API client:
 * - Token encryption at rest (AES-256-GCM)
 * - Webhook request signing (HMAC)
 * - Encrypted token storage
 */

// Encryption utilities
export {
  encryptAES256GCM,
  decryptAES256GCM,
  generateEncryptionKey,
  deriveKeyFromPassword,
  validateEncryptionKey
} from './encryption';

export type { EncryptedData } from './encryption';

// Encrypted storage
export { EncryptedFileTokenStorage } from './encrypted-storage';

export type { EncryptedStorageConfig } from './encrypted-storage';

// Webhook security
export {
  WebhookSecurity,
  createWebhookSecurity
} from './webhook-security';

export type { WebhookSecurityConfig } from './webhook-security';
