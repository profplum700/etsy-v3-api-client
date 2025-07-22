/**
 * Environment detection utilities for universal compatibility
 */

/**
 * Check if we're running in a browser environment
 */
export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * Check if we're running in a Node.js environment
 */
export const isNode = typeof process !== 'undefined' && process.versions?.node;

/**
 * Check if we're running in a Web Worker
 */
export const isWebWorker = typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === 'function' && typeof navigator !== 'undefined';

/**
 * Check if fetch is available natively
 */
export const hasFetch = typeof fetch !== 'undefined';

/**
 * Check if Web Crypto API is available
 */
export const hasWebCrypto = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';

/**
 * Check if localStorage is available
 */
export const hasLocalStorage = ((): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
})();

/**
 * Check if sessionStorage is available
 */
export const hasSessionStorage = ((): boolean => {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
})();

/**
 * Get environment information
 */
export function getEnvironmentInfo(): { isBrowser: boolean; isNode: boolean; isWebWorker: boolean; hasFetch: boolean; hasWebCrypto: boolean; hasLocalStorage: boolean; hasSessionStorage: boolean; userAgent: string; nodeVersion?: string } {
  return {
    isBrowser,
    isNode: Boolean(isNode),
    isWebWorker,
    hasFetch,
    hasWebCrypto,
    hasLocalStorage,
    hasSessionStorage,
    userAgent: isBrowser ? navigator.userAgent : 'Node.js',
    nodeVersion: isNode ? process.version : undefined,
  };
}

/**
 * Assert that we're in a compatible environment for crypto operations
 */
export function assertCryptoSupport(): void {
  if (!hasWebCrypto && !isNode) {
    throw new Error('Crypto operations require Web Crypto API in browsers or Node.js crypto module');
  }
}

/**
 * Assert that we have fetch support
 */
export function assertFetchSupport(): void {
  if (!hasFetch) {
    throw new Error('Fetch API is not available. Please use Node.js 18+ or a modern browser.');
  }
}

/**
 * Get appropriate storage mechanism for the current environment
 */
export function getAvailableStorage(): 'localStorage' | 'sessionStorage' | 'memory' | 'file' {
  if (isNode) {
    return 'file';
  } else if (hasLocalStorage) {
    return 'localStorage';
  } else if (hasSessionStorage) {
    return 'sessionStorage';
  } else {
    return 'memory';
  }
}