import { NextRequest } from 'next/server';
import { createEtsyApiRoute } from '../src/server/route';

describe('createEtsyApiRoute', () => {
  it('should create API route handlers', () => {
    const handlers = createEtsyApiRoute({
      apiKey: 'test-api-key',
    });

    expect(handlers).toHaveProperty('GET');
    expect(handlers).toHaveProperty('POST');
    expect(handlers).toHaveProperty('PUT');
    expect(handlers).toHaveProperty('DELETE');
    expect(typeof handlers.GET).toBe('function');
    expect(typeof handlers.POST).toBe('function');
    expect(typeof handlers.PUT).toBe('function');
    expect(typeof handlers.DELETE).toBe('function');
  });

  it('should accept rate limit configuration', () => {
    const handlers = createEtsyApiRoute({
      apiKey: 'test-api-key',
      rateLimit: {
        requests: 100,
        window: 60000,
      },
    });

    expect(handlers).toBeDefined();
  });

  it('should accept cache configuration', () => {
    const handlers = createEtsyApiRoute({
      apiKey: 'test-api-key',
      cache: {
        enabled: true,
        ttl: 300,
      },
    });

    expect(handlers).toBeDefined();
  });

  it('answers 501 on every method instead of placeholder data', async () => {
    const handlers = createEtsyApiRoute({ apiKey: 'test-api-key', cache: { enabled: true, ttl: 300 } });

    for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
      const response = await handlers[method](
        new NextRequest('http://localhost/api/etsy?endpoint=/shops/1', { method })
      );
      expect(response.status).toBe(501);
      expect(response.headers.get('cache-control')).toBeNull();
      const body = await response.json();
      expect(body.error).toContain('does not call the Etsy API yet');
    }
  });
});
