/**
 * How one EtsyClient call reacts to 401 and 429 answers, and when it reads the
 * access token. See docs/statechart/ for the model these tests follow.
 */

import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '../src/types';
import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(data) };
}

function errorResponse(status: number, statusText: string, headers: Record<string, string> = {}) {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(headers),
    text: vi.fn().mockResolvedValue(statusText),
  };
}

function sentAuthorization(ctx: MockClientContext, call: number): string | undefined {
  const options = ctx.mockFetch.mock.calls[call]![1] as { headers: Record<string, string> };
  return options.headers['Authorization'];
}

const blob = () => new Blob(['fake image data'], { type: 'image/jpeg' });

describe('EtsyClient auth and rate-limit retries', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
    ctx.mockTokenManager.getAccessToken
      .mockReset()
      .mockResolvedValueOnce('test-access-token')
      .mockResolvedValue('new-access-token');
  });

  describe('a 401 from Etsy', () => {
    it('refreshes once and retries a read with the new token', async () => {
      ctx.mockFetch
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(jsonResponse({ user_id: 1 }));

      await expect(ctx.client.getUser()).resolves.toEqual({ user_id: 1 });

      expect(ctx.mockTokenManager.refreshToken).toHaveBeenCalledTimes(1);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(2);
      expect(sentAuthorization(ctx, 0)).toBe('Bearer test-access-token');
      expect(sentAuthorization(ctx, 1)).toBe('Bearer new-access-token');
    });

    it('surfaces a second 401 as EtsyApiError without another refresh', async () => {
      ctx.mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'));

      const error = await ctx.client.getUser().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyApiError);
      expect((error as EtsyApiError).statusCode).toBe(401);
      expect(ctx.mockTokenManager.refreshToken).toHaveBeenCalledTimes(1);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not refresh when no refresh token is held', async () => {
      ctx.mockTokenManager.getCurrentTokens.mockReturnValue({
        access_token: 'test-access-token',
        refresh_token: '',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: '',
      });
      ctx.mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'));

      await expect(ctx.client.getUser()).rejects.toMatchObject({ statusCode: 401 });

      expect(ctx.mockTokenManager.refreshToken).not.toHaveBeenCalled();
      expect(ctx.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries without refreshing when another call already replaced the token', async () => {
      ctx.mockTokenManager.getCurrentTokens.mockReturnValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: '',
      });
      ctx.mockFetch
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(jsonResponse({ user_id: 1 }));

      await expect(ctx.client.getUser()).resolves.toEqual({ user_id: 1 });

      expect(ctx.mockTokenManager.refreshToken).not.toHaveBeenCalled();
      expect(sentAuthorization(ctx, 1)).toBe('Bearer new-access-token');
    });

    it('surfaces the refresh failure when the refresh after a 401 fails', async () => {
      const refused = new EtsyAuthError('Token refresh failed: 400 Bad Request', 'TOKEN_REFRESH_FAILED');
      ctx.mockTokenManager.refreshToken.mockRejectedValueOnce(refused);
      ctx.mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'));

      await expect(ctx.client.getUser()).rejects.toBe(refused);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes once and retries a write', async () => {
      ctx.mockFetch
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });

      await expect(ctx.client.deleteListing('789')).resolves.toBeUndefined();

      expect(ctx.mockTokenManager.refreshToken).toHaveBeenCalledTimes(1);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('refreshes once and retries an upload', async () => {
      ctx.mockFetch
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(jsonResponse({ listing_image_id: 9 }));

      await expect(ctx.client.uploadListingImage('123', '789', blob())).resolves.toEqual({ listing_image_id: 9 });

      expect(ctx.mockTokenManager.refreshToken).toHaveBeenCalledTimes(1);
      expect(sentAuthorization(ctx, 1)).toBe('Bearer new-access-token');
    });

    it('surfaces a second 401 on an upload without another refresh', async () => {
      ctx.mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'));

      await expect(ctx.client.uploadListingImage('123', '789', blob())).rejects.toMatchObject({ statusCode: 401 });

      expect(ctx.mockTokenManager.refreshToken).toHaveBeenCalledTimes(1);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('reading the access token', () => {
    it('reads the token after the rate-limit wait, before each send', async () => {
      ctx.mockFetch.mockResolvedValue(jsonResponse({ user_id: 1 }));

      await ctx.client.getUser();

      const slot = ctx.mockRateLimiter.acquireRequestSlot.mock.invocationCallOrder[0]!;
      const token = ctx.mockTokenManager.getAccessToken.mock.invocationCallOrder[0]!;
      expect(token).toBeGreaterThan(slot);
    });

    it('reads the token again for a read retried after a 429', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 0 });
      ctx.mockFetch
        .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
        .mockResolvedValueOnce(jsonResponse({ user_id: 1 }));

      await expect(ctx.client.getUser()).resolves.toEqual({ user_id: 1 });

      expect(ctx.mockTokenManager.getAccessToken).toHaveBeenCalledTimes(2);
      expect(sentAuthorization(ctx, 0)).toBe('Bearer test-access-token');
      expect(sentAuthorization(ctx, 1)).toBe('Bearer new-access-token');
    });

    it('passes a token storage error through unchanged and frees the slot', async () => {
      const storageError = new Error('disk full');
      ctx.mockTokenManager.getAccessToken.mockReset().mockRejectedValue(storageError);

      await expect(ctx.client.getUser()).rejects.toBe(storageError);
      await expect(ctx.client.uploadListingImage('123', '789', blob())).rejects.toBe(storageError);

      expect(ctx.mockFetch).not.toHaveBeenCalled();
      expect(ctx.mockRateLimiter.releaseRequestSlot).toHaveBeenCalledTimes(2);
    });
  });

  describe('the single-send path', () => {
    it('frees the slot and passes a network error through', async () => {
      const networkError = new Error('socket hang up');
      ctx.mockFetch.mockRejectedValue(networkError);

      await expect(ctx.client.uploadListingImage('123', '789', blob())).rejects.toBe(networkError);
      expect(ctx.mockRateLimiter.releaseRequestSlot).toHaveBeenCalledTimes(1);
    });

    it('passes a refresh failure after a 401 through unchanged', async () => {
      const refused = new EtsyAuthError('Token refresh failed: 400 Bad Request', 'TOKEN_REFRESH_FAILED');
      ctx.mockTokenManager.refreshToken.mockRejectedValueOnce(refused);
      ctx.mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'));

      await expect(ctx.client.uploadListingImage('123', '789', blob())).rejects.toBe(refused);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('a 429 on a write', () => {
    it('throws EtsyRateLimitError with Retry-After and does not replay', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 7000 });
      ctx.mockFetch.mockResolvedValue(errorResponse(429, 'Too Many Requests', { 'retry-after': '5' }));

      const error = await ctx.client.deleteListing('789').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect((error as EtsyRateLimitError).retryAfter).toBe(5);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to the recorded cooldown when Etsy sends no Retry-After', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 1500 });
      ctx.mockFetch.mockResolvedValue(errorResponse(429, 'Too Many Requests'));

      const error = await ctx.client.deleteListing('789').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect((error as EtsyRateLimitError).retryAfter).toBe(2);
    });

    it('counts an upload 429 as this call\'s first attempt, not the shared counter', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 1000 });
      ctx.mockFetch.mockResolvedValue(errorResponse(429, 'Too Many Requests'));

      await ctx.client.uploadListingImage('123', '789', blob()).catch(() => undefined);

      expect(ctx.mockRateLimiter.handleRateLimitResponse).toHaveBeenCalledWith(expect.anything(), 1, 1);
    });

    it('ignores a Retry-After that is not a number of seconds', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 2000 });
      ctx.mockFetch.mockResolvedValue(
        errorResponse(429, 'Too Many Requests', { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' })
      );

      const error = await ctx.client.deleteListing('789').catch((e: unknown) => e);

      expect((error as EtsyRateLimitError).retryAfter).toBe(2);
    });

    it('throws EtsyRateLimitError for an upload and does not replay', async () => {
      ctx.mockRateLimiter.handleRateLimitResponse.mockResolvedValue({ shouldRetry: true, delayMs: 1000 });
      ctx.mockFetch.mockResolvedValue(errorResponse(429, 'Too Many Requests', { 'retry-after': '3' }));

      const error = await ctx.client.uploadListingImage('123', '789', blob()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect((error as EtsyRateLimitError).retryAfter).toBe(3);
      expect(ctx.mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
