/**
 * OAuth 2.0 Authentication Helper for Etsy API v3
 * Inspired by the Python etsyv3 library authentication flow
 */

import { createHash, randomBytes } from 'crypto';
import { AuthHelperConfig, EtsyTokens, EtsyTokenResponse, EtsyAuthError } from '../types';

/**
 * Helper class for OAuth 2.0 authentication flow with Etsy API v3
 * 
 * Usage:
 * 1. Create AuthHelper instance
 * 2. Call getAuthUrl() to get authorization URL
 * 3. User visits URL and authorizes
 * 4. Call setAuthorizationCode() with code and state from callback
 * 5. Call getAccessToken() to exchange code for tokens
 */
export class AuthHelper {
  private readonly keystring: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  private readonly codeVerifier: string;
  private readonly state: string;
  private authorizationCode?: string;
  private receivedState?: string;

  constructor(config: AuthHelperConfig) {
    this.keystring = config.keystring;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes;
    this.codeVerifier = config.codeVerifier || this.generateCodeVerifier();
    this.state = config.state || this.generateState();
  }

  /**
   * Generate a cryptographically secure code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate a cryptographically secure state parameter
   */
  private generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Create code challenge from code verifier using SHA256
   */
  private createCodeChallenge(codeVerifier: string): string {
    return createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  /**
   * Get the authorization URL for the OAuth 2.0 flow
   * User should visit this URL to authorize the application
   */
  public getAuthUrl(): string {
    const codeChallenge = this.createCodeChallenge(this.codeVerifier);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.keystring,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: this.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `https://www.etsy.com/oauth/connect?${params.toString()}`;
  }

  /**
   * Set the authorization code and state received from the callback
   * This should be called in your redirect URI handler
   */
  public setAuthorizationCode(code: string, state: string): void {
    if (state !== this.state) {
      throw new EtsyAuthError('State parameter mismatch', 'INVALID_STATE');
    }

    this.authorizationCode = code;
    this.receivedState = state;
  }

  /**
   * Exchange the authorization code for access tokens
   * Must be called after setAuthorizationCode()
   */
  public async getAccessToken(): Promise<EtsyTokens> {
    if (!this.authorizationCode) {
      throw new EtsyAuthError('Authorization code not set. Call setAuthorizationCode() first.', 'NO_AUTH_CODE');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.keystring,
      redirect_uri: this.redirectUri,
      code: this.authorizationCode,
      code_verifier: this.codeVerifier
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
          `Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`,
          'TOKEN_EXCHANGE_FAILED'
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
    } catch (error) {
      if (error instanceof EtsyAuthError) {
        throw error;
      }
      throw new EtsyAuthError(
        `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TOKEN_EXCHANGE_ERROR'
      );
    }
  }

  /**
   * Get current state parameter (useful for validation)
   */
  public getState(): string {
    return this.state;
  }

  /**
   * Get current code verifier (useful for debugging)
   */
  public getCodeVerifier(): string {
    return this.codeVerifier;
  }

  /**
   * Get current scopes
   */
  public getScopes(): string[] {
    return [...this.scopes];
  }

  /**
   * Get redirect URI
   */
  public getRedirectUri(): string {
    return this.redirectUri;
  }

  /**
   * Fetch implementation that works in both Node.js and browser
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    // Use global fetch if available (modern browsers and Node.js 18+)
    if (typeof globalThis.fetch !== 'undefined') {
      return globalThis.fetch(url, options);
    }

    // Check for fetch on global object (test environment)
    if (typeof (global as any).fetch !== 'undefined') {
      return (global as any).fetch(url, options);
    }

    // Fallback to node-fetch for older Node.js versions
    try {
      const nodeFetch = await import('node-fetch');
      const fetch = nodeFetch.default || nodeFetch;
      return fetch(url, options as any) as Promise<any>;
    } catch (error) {
      throw new EtsyAuthError(
        'Fetch is not available. Please provide a fetch implementation or use Node.js 18+ or a modern browser.',
        'FETCH_NOT_AVAILABLE'
      );
    }
  }
}

/**
 * Validate required scopes for common operations
 */
export const ETSY_SCOPES = {
  // Read operations
  LISTINGS_READ: 'listings_r',
  SHOPS_READ: 'shops_r',
  PROFILE_READ: 'profile_r',
  FAVORITES_READ: 'favorites_r',
  FEEDBACK_READ: 'feedback_r',
  TREASURY_READ: 'treasury_r',
  
  // Write operations
  LISTINGS_WRITE: 'listings_w',
  SHOPS_WRITE: 'shops_w',
  PROFILE_WRITE: 'profile_w',
  FAVORITES_WRITE: 'favorites_w',
  FEEDBACK_WRITE: 'feedback_w',
  TREASURY_WRITE: 'treasury_w',
  
  // Delete operations
  LISTINGS_DELETE: 'listings_d',
  SHOPS_DELETE: 'shops_d',
  PROFILE_DELETE: 'profile_d',
  FAVORITES_DELETE: 'favorites_d',
  FEEDBACK_DELETE: 'feedback_d',
  TREASURY_DELETE: 'treasury_d',
  
  // Transaction operations
  TRANSACTIONS_READ: 'transactions_r',
  TRANSACTIONS_WRITE: 'transactions_w',
  
  // Billing operations
  BILLING_READ: 'billing_r',
  
  // Cart operations
  CART_READ: 'cart_r',
  CART_WRITE: 'cart_w',
  
  // Recommend operations
  RECOMMEND_READ: 'recommend_r',
  RECOMMEND_WRITE: 'recommend_w',
  
  // Address operations
  ADDRESS_READ: 'address_r',
  ADDRESS_WRITE: 'address_w',
  
  // Email operations
  EMAIL_READ: 'email_r'
} as const;

/**
 * Common scope combinations for different use cases
 */
export const COMMON_SCOPE_COMBINATIONS = {
  // Read-only access to shop and listings
  SHOP_READ_ONLY: [
    ETSY_SCOPES.SHOPS_READ,
    ETSY_SCOPES.LISTINGS_READ,
    ETSY_SCOPES.PROFILE_READ
  ],
  
  // Full shop management
  SHOP_MANAGEMENT: [
    ETSY_SCOPES.SHOPS_READ,
    ETSY_SCOPES.SHOPS_WRITE,
    ETSY_SCOPES.LISTINGS_READ,
    ETSY_SCOPES.LISTINGS_WRITE,
    ETSY_SCOPES.LISTINGS_DELETE,
    ETSY_SCOPES.PROFILE_READ,
    ETSY_SCOPES.TRANSACTIONS_READ
  ],
  
  // Minimal access for basic operations
  BASIC_ACCESS: [
    ETSY_SCOPES.SHOPS_READ,
    ETSY_SCOPES.LISTINGS_READ
  ]
} as const;