/**
 * Token Management and Refresh Logic
 * Handles automatic token refresh and storage
 */

import { EtsyTokens, EtsyTokenResponse, EtsyAuthError, EtsyClientConfig, TokenRefreshCallback, TokenStorage } from '../types';
import { isNode, hasLocalStorage, hasSessionStorage, assertFetchSupport } from '../utils/environment';

/**
 * In-memory token storage implementation
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokens: EtsyTokens | null = null;

  async save(tokens: EtsyTokens): Promise<void> {
    this.tokens = { ...tokens };
  }

  async load(): Promise<EtsyTokens | null> {
    return this.tokens ? { ...this.tokens } : null;
  }

  async clear(): Promise<void> {
    this.tokens = null;
  }
}

/**
 * Token manager handles token lifecycle and refresh
 */
export class TokenManager {
  private keystring: string;
  private currentTokens: EtsyTokens | null = null;
  private refreshCallback?: TokenRefreshCallback;
  private storage?: TokenStorage;
  private refreshPromise?: Promise<EtsyTokens>;

  constructor(config: EtsyClientConfig, storage?: TokenStorage) {
    this.keystring = config.keystring;
    this.refreshCallback = config.refreshSave;
    this.storage = storage;
    
    // Initialize with provided tokens
    this.currentTokens = {
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expires_at: config.expiresAt,
      token_type: 'Bearer',
      scope: ''
    };
  }

  /**
   * Get current access token, refreshing if necessary
   */
  public async getAccessToken(): Promise<string> {
    if (!this.currentTokens) {
      // Try to load from storage
      if (this.storage) {
        this.currentTokens = await this.storage.load();
      }
      
      if (!this.currentTokens) {
        throw new EtsyAuthError('No tokens available', 'NO_TOKENS');
      }
    }

    // Check if token is expired or will expire soon (1 minute buffer)
    const now = new Date();
    const expiresAt = new Date(this.currentTokens.expires_at);
    const bufferTime = 60 * 1000; // 1 minute in milliseconds
    
    if (now.getTime() >= (expiresAt.getTime() - bufferTime)) {
      // Token is expired or will expire soon, refresh it
      await this.refreshToken();
    }

    return this.currentTokens.access_token;
  }

  /**
   * Refresh the access token using the refresh token
   */
  public async refreshToken(): Promise<EtsyTokens> {
    // If refresh is already in progress, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.currentTokens) {
      throw new EtsyAuthError('No tokens available to refresh', 'NO_REFRESH_TOKEN');
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const newTokens = await this.refreshPromise;
      this.currentTokens = newTokens;
      
      // Save to storage if available
      if (this.storage) {
        await this.storage.save(newTokens);
      }
      
      // Call refresh callback if provided
      if (this.refreshCallback) {
        this.refreshCallback(
          newTokens.access_token,
          newTokens.refresh_token,
          newTokens.expires_at
        );
      }
      
      return newTokens;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  /**
   * Perform the actual token refresh request
   */
  private async performTokenRefresh(): Promise<EtsyTokens> {
    if (!this.currentTokens) {
      throw new EtsyAuthError('No tokens available', 'NO_TOKENS');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.keystring,
      refresh_token: this.currentTokens.refresh_token
    });

    try {
      const response = await this.fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new EtsyAuthError(
          `Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`,
          'TOKEN_REFRESH_FAILED'
        );
      }

      const tokenResponse: EtsyTokenResponse = await response.json();
      
      return {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
        token_type: tokenResponse.token_type,
        scope: tokenResponse.scope
      };
    } catch (_error) {
      if (_error instanceof EtsyAuthError) {
        throw _error;
      }
      throw new EtsyAuthError(
        `Token refresh failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'TOKEN_REFRESH_ERROR'
      );
    }
  }

  /**
   * Get current tokens (may be expired)
   */
  public getCurrentTokens(): EtsyTokens | null {
    return this.currentTokens ? { ...this.currentTokens } : null;
  }

  /**
   * Update tokens manually
   */
  public updateTokens(tokens: EtsyTokens): void {
    this.currentTokens = { ...tokens };
  }

  /**
   * Check if current token is expired
   */
  public isTokenExpired(): boolean {
    if (!this.currentTokens) {
      return true;
    }

    const now = new Date();
    const expiresAt = new Date(this.currentTokens.expires_at);
    return now.getTime() >= expiresAt.getTime();
  }

  /**
   * Check if token will expire soon (within specified minutes)
   */
  public willTokenExpireSoon(minutes: number = 5): boolean {
    if (!this.currentTokens) {
      return true;
    }

    const now = new Date();
    const expiresAt = new Date(this.currentTokens.expires_at);
    const bufferTime = minutes * 60 * 1000; // minutes to milliseconds
    
    return now.getTime() >= (expiresAt.getTime() - bufferTime);
  }

  /**
   * Clear all tokens
   */
  public async clearTokens(): Promise<void> {
    this.currentTokens = null;
    
    if (this.storage) {
      await this.storage.clear();
    }
  }

  /**
   * Get time until token expiration
   */
  public getTimeUntilExpiration(): number | null {
    if (!this.currentTokens) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(this.currentTokens.expires_at);
    return expiresAt.getTime() - now.getTime();
  }

  /**
   * Fetch implementation that works in both Node.js and browser
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    assertFetchSupport();
    return fetch(url, options);
  }
}

/**
 * Create appropriate token storage based on current environment
 */
export function createDefaultTokenStorage(options?: {
  filePath?: string;
  storageKey?: string;
  preferSession?: boolean;
}): TokenStorage {
  if (isNode) {
    return new FileTokenStorage(options?.filePath || './etsy-tokens.json');
  } else if (options?.preferSession && hasSessionStorage) {
    return new SessionStorageTokenStorage(options?.storageKey);
  } else if (hasLocalStorage) {
    return new LocalStorageTokenStorage(options?.storageKey);
  } else if (hasSessionStorage) {
    return new SessionStorageTokenStorage(options?.storageKey);
  } else {
    return new MemoryTokenStorage();
  }
}

/**
 * Browser localStorage token storage implementation
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private storageKey: string;

  constructor(storageKey: string = 'etsy_tokens') {
    if (!hasLocalStorage) {
      throw new Error('localStorage is not available in this environment');
    }
    this.storageKey = storageKey;
  }

  async save(tokens: EtsyTokens): Promise<void> {
    const data = JSON.stringify(tokens);
    localStorage.setItem(this.storageKey, data);
  }

  async load(): Promise<EtsyTokens | null> {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      
      const tokens = JSON.parse(data);
      
      // Convert expires_at string back to Date
      if (tokens.expires_at) {
        tokens.expires_at = new Date(tokens.expires_at);
      }
      
      return tokens;
    } catch {
      // Invalid data
      return null;
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }
}

/**
 * Browser sessionStorage token storage implementation
 */
export class SessionStorageTokenStorage implements TokenStorage {
  private storageKey: string;

  constructor(storageKey: string = 'etsy_tokens') {
    if (!hasSessionStorage) {
      throw new Error('sessionStorage is not available in this environment');
    }
    this.storageKey = storageKey;
  }

  async save(tokens: EtsyTokens): Promise<void> {
    const data = JSON.stringify(tokens);
    sessionStorage.setItem(this.storageKey, data);
  }

  async load(): Promise<EtsyTokens | null> {
    try {
      const data = sessionStorage.getItem(this.storageKey);
      if (!data) return null;
      
      const tokens = JSON.parse(data);
      
      // Convert expires_at string back to Date
      if (tokens.expires_at) {
        tokens.expires_at = new Date(tokens.expires_at);
      }
      
      return tokens;
    } catch {
      // Invalid data
      return null;
    }
  }

  async clear(): Promise<void> {
    sessionStorage.removeItem(this.storageKey);
  }
}

/**
 * File-based token storage for Node.js environments
 */
export class FileTokenStorage implements TokenStorage {
  private filePath: string;

  constructor(filePath: string) {
    if (!isNode) {
      throw new Error('FileTokenStorage is only available in Node.js environments');
    }
    this.filePath = filePath;
  }

  async save(tokens: EtsyTokens): Promise<void> {
    if (!isNode) {
      throw new Error('FileTokenStorage is only available in Node.js');
    }
    try {
      const fs = await import(/* webpackIgnore: true */ 'fs');
      const data = JSON.stringify(tokens, null, 2);
      await fs.promises.writeFile(this.filePath, data, 'utf8');
    } catch {
      throw new Error('Failed to save tokens to file');
    }
  }

  async load(): Promise<EtsyTokens | null> {
    if (!isNode) {
      return null;
    }
    try {
      const fs = await import(/* webpackIgnore: true */ 'fs');
      const data = await fs.promises.readFile(this.filePath, 'utf8');
      const tokens = JSON.parse(data);
      
      // Convert expires_at string back to Date
      if (tokens.expires_at) {
        tokens.expires_at = new Date(tokens.expires_at);
      }
      
      return tokens;
    } catch {
      // File doesn't exist or is invalid
      return null;
    }
  }

  async clear(): Promise<void> {
    if (!isNode) {
      return;
    }
    try {
      const fs = await import(/* webpackIgnore: true */ 'fs');
      await fs.promises.unlink(this.filePath);
    } catch {
      // File doesn't exist, ignore
    }
  }
}