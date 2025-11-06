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
});
