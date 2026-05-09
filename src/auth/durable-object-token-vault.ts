import {
  EtsyAuthError,
  EtsyTokens,
  TokenProvider
} from '../types';

const TOKEN_STORAGE_KEY = 'etsy-oauth-token-bundle';
const DEFAULT_REFRESH_ENDPOINT = 'https://api.etsy.com/v3/public/oauth/token';
const DEFAULT_EXPIRY_BUFFER_MS = 60_000;

type TokenVaultErrorCode =
  | 'TOKEN_VAULT_BAD_REQUEST'
  | 'TOKEN_VAULT_FETCH_FAILED'
  | 'TOKEN_VAULT_INVALID_RESPONSE'
  | 'TOKEN_VAULT_MISSING_KEYSTRING'
  | 'TOKEN_VAULT_NO_TOKENS'
  | 'TOKEN_VAULT_REFRESH_FAILED'
  | 'TOKEN_VAULT_STALE_REFRESH_RESULT'
  | 'TOKEN_VAULT_STALE_WRITE';

interface DurableObjectStorageLike {
  get<T = unknown>(_key: string): Promise<T | undefined>;
  put<T = unknown>(_key: string, _value: T): Promise<void>;
  delete(_key: string): Promise<boolean | void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  blockConcurrencyWhile?<T>(_callback: () => Promise<T>): Promise<T>;
}

export interface TokenVaultRefreshEnv {
  ETSY_API_KEY?: string;
  ETSY_KEYSTRING?: string;
  TOKEN_REFRESH_ENDPOINT?: string;
  TOKEN_EXPIRY_BUFFER_SECONDS?: string | number;
  refreshTokens?: (_tokens: EtsyTokens) => Promise<EtsyTokens>;
}

interface StoredTokenBundle {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  token_type: string;
  scope: string;
  version: number;
  updated_at: string;
}

export interface TokenVaultWriteRequest {
  tokens: EtsyTokens;
  expectedVersion?: number;
}

export interface TokenVaultTokensResponse {
  tokens: EtsyTokens | null;
  version: number | null;
  updated_at: string | null;
}

export interface TokenVaultAccessTokenResponse {
  access_token: string;
  expires_at: string;
  version: number;
}

export interface TokenVaultClientOptions {
  vault: FetcherLike;
  basePath?: string;
  fetch?: (_input: Request | string, _init?: RequestInit) => Promise<Response>;
}

export interface FetcherLike {
  fetch(_input: Request | string, _init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(_name: string): unknown;
  get(_id: unknown): FetcherLike;
}

class TokenVaultHttpError extends Error {
  public readonly code: TokenVaultErrorCode;
  public readonly status: number;

  constructor(message: string, code: TokenVaultErrorCode, status: number) {
    super(message);
    this.name = 'TokenVaultHttpError';
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function errorResponse(message: string, code: TokenVaultErrorCode, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function cloneTokens(tokens: EtsyTokens): EtsyTokens {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at),
    token_type: tokens.token_type,
    scope: tokens.scope
  };
}

function storedToTokens(stored: StoredTokenBundle): EtsyTokens {
  return {
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expires_at: new Date(stored.expires_at),
    token_type: stored.token_type,
    scope: stored.scope
  };
}

function tokensToStored(tokens: EtsyTokens, version: number, updatedAt: Date): StoredTokenBundle {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at).toISOString(),
    token_type: tokens.token_type,
    scope: tokens.scope,
    version,
    updated_at: updatedAt.toISOString()
  };
}

function parseExpiry(expiresAt: unknown): Date {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(String(expiresAt));
  if (Number.isNaN(expiry.getTime())) {
    throw new TokenVaultHttpError('Token bundle has an invalid expires_at value', 'TOKEN_VAULT_BAD_REQUEST', 400);
  }
  return expiry;
}

function normalizeTokens(value: unknown): EtsyTokens {
  const candidate = value as Partial<Record<keyof EtsyTokens, unknown>>;
  if (!candidate || typeof candidate !== 'object') {
    throw new TokenVaultHttpError('Request body must include a token bundle', 'TOKEN_VAULT_BAD_REQUEST', 400);
  }

  if (
    typeof candidate.access_token !== 'string' || candidate.access_token.length === 0 ||
    typeof candidate.refresh_token !== 'string' || candidate.refresh_token.length === 0 ||
    typeof candidate.token_type !== 'string' || candidate.token_type.length === 0 ||
    typeof candidate.scope !== 'string'
  ) {
    throw new TokenVaultHttpError('Token bundle is missing required OAuth fields', 'TOKEN_VAULT_BAD_REQUEST', 400);
  }

  return {
    access_token: candidate.access_token,
    refresh_token: candidate.refresh_token,
    expires_at: parseExpiry(candidate.expires_at),
    token_type: candidate.token_type,
    scope: candidate.scope
  };
}

function safeUrl(basePath: string, path: string): string {
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return `${base}${path}`;
}

function isExpiredOrNearExpiry(tokens: EtsyTokens, bufferMs: number): boolean {
  return Date.now() >= (new Date(tokens.expires_at).getTime() - bufferMs);
}

function parseExpiryBufferMs(env: TokenVaultRefreshEnv): number {
  const configured = env.TOKEN_EXPIRY_BUFFER_SECONDS;
  if (configured === undefined || configured === null || configured === '') {
    return DEFAULT_EXPIRY_BUFFER_MS;
  }
  const seconds = typeof configured === 'number' ? configured : Number(configured);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return DEFAULT_EXPIRY_BUFFER_MS;
  }
  return seconds * 1000;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TokenVaultHttpError('Request body must be valid JSON', 'TOKEN_VAULT_BAD_REQUEST', 400);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function toVersion(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TokenVaultHttpError('expectedVersion must be a non-negative integer', 'TOKEN_VAULT_BAD_REQUEST', 400);
  }
  return value;
}

async function readClientJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
  }
}

async function readVaultJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TokenVaultHttpError('Token refresh response was invalid', 'TOKEN_VAULT_INVALID_RESPONSE', 502);
  }
}

function normalizeTokensForClient(value: unknown): EtsyTokens {
  try {
    return normalizeTokens(value);
  } catch {
    throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
  }
}

function clientError(code: string, status: number): EtsyAuthError {
  return new EtsyAuthError(`Token vault request failed with status ${status}`, code);
}

/**
 * Cloudflare Durable Object-compatible OAuth token vault.
 *
 * Bind this class as a Durable Object and call it through TokenVaultClient from
 * Worker code. The vault serializes token writes, performs single-flight
 * refreshes, and rejects stale writes so an older refresh response cannot
 * overwrite a newer OAuth token bundle.
 */
export class DurableObjectTokenVault {
  private readonly state: DurableObjectStateLike;
  private readonly env: TokenVaultRefreshEnv;
  private refreshPromise?: Promise<StoredTokenBundle>;

  constructor(state: DurableObjectStateLike, env: TokenVaultRefreshEnv = {}) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/$/, '') || '/';

      if (request.method === 'GET' && pathname === '/tokens') {
        return await this.handleReadTokens();
      }

      if (request.method === 'GET' && pathname === '/access-token') {
        return await this.handleReadAccessToken();
      }

      if ((request.method === 'POST' || request.method === 'PUT') && pathname === '/tokens') {
        return await this.handleWriteTokens(request);
      }

      if (request.method === 'DELETE' && pathname === '/tokens') {
        await this.state.storage.delete(TOKEN_STORAGE_KEY);
        return jsonResponse({ ok: true });
      }

      if (request.method === 'POST' && pathname === '/refresh') {
        const refreshed = await this.refreshStoredTokens();
        return this.tokensResponse(refreshed);
      }

      return errorResponse('Token vault route not found', 'TOKEN_VAULT_BAD_REQUEST', 404);
    } catch (error) {
      if (error instanceof TokenVaultHttpError) {
        return errorResponse(error.message, error.code, error.status);
      }
      return errorResponse('Token vault request failed', 'TOKEN_VAULT_FETCH_FAILED', 500);
    }
  }

  private async handleReadTokens(): Promise<Response> {
    const stored = await this.loadStoredTokens();
    if (!stored) {
      return jsonResponse({ tokens: null, version: null, updated_at: null } satisfies TokenVaultTokensResponse);
    }
    return this.tokensResponse(stored);
  }

  private async handleReadAccessToken(): Promise<Response> {
    let stored = await this.loadStoredTokens();
    if (!stored) {
      throw new TokenVaultHttpError('No tokens are stored in the vault', 'TOKEN_VAULT_NO_TOKENS', 404);
    }

    if (isExpiredOrNearExpiry(storedToTokens(stored), parseExpiryBufferMs(this.env))) {
      stored = await this.refreshStoredTokens();
    }

    return jsonResponse({
      access_token: stored.access_token,
      expires_at: stored.expires_at,
      version: stored.version
    } satisfies TokenVaultAccessTokenResponse);
  }

  private async handleWriteTokens(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (!isRecord(body)) {
      throw new TokenVaultHttpError('Request body must be an object', 'TOKEN_VAULT_BAD_REQUEST', 400);
    }

    const tokens = normalizeTokens(body.tokens);
    const expectedVersion = toVersion(body.expectedVersion);
    const stored = await this.saveTokens(tokens, expectedVersion);
    return this.tokensResponse(stored);
  }

  private tokensResponse(stored: StoredTokenBundle): Response {
    return jsonResponse({
      tokens: storedToTokens(stored),
      version: stored.version,
      updated_at: stored.updated_at
    } satisfies TokenVaultTokensResponse);
  }

  private async loadStoredTokens(): Promise<StoredTokenBundle | null> {
    const stored = await this.state.storage.get<StoredTokenBundle>(TOKEN_STORAGE_KEY);
    return stored ?? null;
  }

  private async saveTokens(tokens: EtsyTokens, expectedVersion?: number): Promise<StoredTokenBundle> {
    return this.serialize(async () => {
      const current = await this.loadStoredTokens();
      if (current && expectedVersion !== undefined && current.version !== expectedVersion) {
        throw new TokenVaultHttpError('Token write was rejected because the stored version changed', 'TOKEN_VAULT_STALE_WRITE', 409);
      }

      if (current && expectedVersion === undefined) {
        const currentExpiry = new Date(current.expires_at).getTime();
        const nextExpiry = new Date(tokens.expires_at).getTime();
        if (nextExpiry <= currentExpiry) {
          throw new TokenVaultHttpError('Token write was rejected because the bundle is stale', 'TOKEN_VAULT_STALE_WRITE', 409);
        }
      }

      const version = current ? current.version + 1 : 1;
      const stored = tokensToStored(tokens, version, new Date());
      await this.state.storage.put(TOKEN_STORAGE_KEY, stored);
      return stored;
    });
  }

  private async refreshStoredTokens(): Promise<StoredTokenBundle> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private async performRefresh(): Promise<StoredTokenBundle> {
    const before = await this.loadStoredTokens();
    if (!before) {
      throw new TokenVaultHttpError('No tokens are stored in the vault', 'TOKEN_VAULT_NO_TOKENS', 404);
    }

    const refreshed = await this.refreshTokens(storedToTokens(before));

    return this.serialize(async () => {
      const current = await this.loadStoredTokens();
      if (!current) {
        throw new TokenVaultHttpError('No tokens are stored in the vault', 'TOKEN_VAULT_NO_TOKENS', 404);
      }

      if (current.version !== before.version) {
        const currentExpiry = new Date(current.expires_at).getTime();
        const refreshedExpiry = new Date(refreshed.expires_at).getTime();
        if (currentExpiry >= refreshedExpiry) {
          return current;
        }
        throw new TokenVaultHttpError('Token refresh result was rejected because the stored version changed', 'TOKEN_VAULT_STALE_REFRESH_RESULT', 409);
      }

      const stored = tokensToStored(refreshed, current.version + 1, new Date());
      await this.state.storage.put(TOKEN_STORAGE_KEY, stored);
      return stored;
    });
  }

  private async refreshTokens(tokens: EtsyTokens): Promise<EtsyTokens> {
    if (this.env.refreshTokens) {
      return normalizeTokens(await this.env.refreshTokens(cloneTokens(tokens)));
    }

    const keystring = this.env.ETSY_API_KEY || this.env.ETSY_KEYSTRING;
    if (!keystring) {
      throw new TokenVaultHttpError('Token refresh keystring binding is not configured', 'TOKEN_VAULT_MISSING_KEYSTRING', 500);
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keystring,
      refresh_token: tokens.refresh_token
    });

    let response: Response;
    try {
      response = await fetch(this.env.TOKEN_REFRESH_ENDPOINT || DEFAULT_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });
    } catch {
      throw new TokenVaultHttpError('Token refresh request failed', 'TOKEN_VAULT_REFRESH_FAILED', 502);
    }

    if (!response.ok) {
      throw new TokenVaultHttpError('Token refresh request failed', 'TOKEN_VAULT_REFRESH_FAILED', 502);
    }

    const tokenResponse = await readVaultJson(response);
    if (!isRecord(tokenResponse)) {
      throw new TokenVaultHttpError('Token refresh response was invalid', 'TOKEN_VAULT_INVALID_RESPONSE', 502);
    }

    const expiresIn = typeof tokenResponse.expires_in === 'number' ? tokenResponse.expires_in : Number(tokenResponse.expires_in);
    if (!Number.isFinite(expiresIn)) {
      throw new TokenVaultHttpError('Token refresh response was invalid', 'TOKEN_VAULT_INVALID_RESPONSE', 502);
    }

    return normalizeTokens({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: new Date(Date.now() + (expiresIn * 1000)),
      token_type: tokenResponse.token_type,
      scope: tokenResponse.scope
    });
  }

  private async serialize<T>(callback: () => Promise<T>): Promise<T> {
    if (this.state.blockConcurrencyWhile) {
      return this.state.blockConcurrencyWhile(callback);
    }
    return callback();
  }
}

/**
 * TokenProvider implementation that talks to a DurableObjectTokenVault stub.
 */
export class TokenVaultClient implements TokenProvider {
  private readonly vault: FetcherLike;
  private readonly basePath: string;
  private readonly requestFetch: (_input: Request | string, _init?: RequestInit) => Promise<Response>;
  private currentTokens: EtsyTokens | null = null;

  constructor(options: TokenVaultClientOptions | FetcherLike) {
    if ('fetch' in options && typeof options.fetch === 'function' && !('vault' in options)) {
      this.vault = options;
      this.basePath = 'https://token-vault.local';
      this.requestFetch = options.fetch.bind(options);
      return;
    }

    const normalized = options as TokenVaultClientOptions;
    this.vault = normalized.vault;
    this.basePath = normalized.basePath || 'https://token-vault.local';
    this.requestFetch = normalized.fetch || normalized.vault.fetch.bind(normalized.vault);
  }

  static fromNamespace(namespace: DurableObjectNamespaceLike, name: string, basePath?: string): TokenVaultClient {
    const stub = namespace.get(namespace.idFromName(name));
    return new TokenVaultClient({ vault: stub, basePath });
  }

  async getAccessToken(): Promise<string> {
    const response = await this.fetchVault('/access-token', { method: 'GET' });
    const body = await readClientJson(response);
    if (!isRecord(body) || typeof body.access_token !== 'string') {
      throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
    }
    return body.access_token;
  }

  getCurrentTokens(): EtsyTokens | null {
    return this.currentTokens ? cloneTokens(this.currentTokens) : null;
  }

  isTokenExpired(): boolean {
    return !this.currentTokens || isExpiredOrNearExpiry(this.currentTokens, 0);
  }

  async loadCurrentTokens(): Promise<EtsyTokens | null> {
    const response = await this.fetchVault('/tokens', { method: 'GET' });
    const payload = await this.readTokensResponse(response);
    this.currentTokens = payload.tokens ? cloneTokens(payload.tokens) : null;
    return this.getCurrentTokens();
  }

  async saveTokens(tokens: EtsyTokens, expectedVersion?: number): Promise<EtsyTokens> {
    const response = await this.fetchVault('/tokens', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, expectedVersion })
    });
    const payload = await this.readTokensResponse(response);
    if (!payload.tokens) {
      throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
    }
    this.currentTokens = cloneTokens(payload.tokens);
    return this.getCurrentTokens() as EtsyTokens;
  }

  async clearTokens(): Promise<void> {
    await this.fetchVault('/tokens', { method: 'DELETE' });
    this.currentTokens = null;
  }

  async refreshToken(): Promise<EtsyTokens> {
    const response = await this.fetchVault('/refresh', { method: 'POST' });
    const payload = await this.readTokensResponse(response);
    if (!payload.tokens) {
      throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
    }
    this.currentTokens = cloneTokens(payload.tokens);
    return this.getCurrentTokens() as EtsyTokens;
  }

  private async fetchVault(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.requestFetch(safeUrl(this.basePath, path), init);
    } catch {
      throw new EtsyAuthError('Token vault request failed', 'TOKEN_VAULT_FETCH_FAILED');
    }

    if (!response.ok) {
      const code = await this.extractErrorCode(response);
      throw clientError(code, response.status);
    }

    return response;
  }

  private async readTokensResponse(response: Response): Promise<TokenVaultTokensResponse> {
    const body = await readClientJson(response);
    if (!isRecord(body)) {
      throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
    }

    const tokens = body.tokens === null ? null : normalizeTokensForClient(body.tokens);
    const version = body.version === null ? null : body.version;
    const updatedAt = body.updated_at === null ? null : body.updated_at;
    if ((version !== null && typeof version !== 'number') || (updatedAt !== null && typeof updatedAt !== 'string')) {
      throw new EtsyAuthError('Token vault returned an invalid response', 'TOKEN_VAULT_INVALID_RESPONSE');
    }

    return { tokens, version, updated_at: updatedAt };
  }

  private async extractErrorCode(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string') {
        return body.error.code;
      }
    } catch {
      // Ignore response bodies. Vault diagnostics must not copy token material.
    }
    return 'TOKEN_VAULT_REQUEST_FAILED';
  }
}
