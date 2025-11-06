import { NextRequest, NextResponse } from 'next/server';
import { getEtsyServerClient } from './client';

export interface EtsyApiRouteConfig {
  apiKey: string;
  redirectUri?: string;
  scopes?: string[];
  rateLimit?: {
    requests: number;
    window: number; // in milliseconds
  };
  cache?: {
    enabled: boolean;
    ttl: number; // in seconds
  };
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Create API route handlers for Etsy API
 * Provides automatic rate limiting, caching, and error handling
 */
export function createEtsyApiRoute(config: EtsyApiRouteConfig) {
  const { rateLimit, cache } = config;

  // Rate limiting helper
  function checkRateLimit(identifier: string): boolean {
    if (!rateLimit) return true;

    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + rateLimit.window,
      });
      return true;
    }

    if (entry.count >= rateLimit.requests) {
      return false;
    }

    entry.count++;
    return true;
  }

  async function handleRequest(
    request: NextRequest,
    handler: (client: any, request: NextRequest) => Promise<any>
  ): Promise<NextResponse> {
    try {
      // Rate limiting
      if (rateLimit) {
        const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
        if (!checkRateLimit(identifier)) {
          return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
          );
        }
      }

      // Get client
      const client = await getEtsyServerClient();

      // Execute handler
      const result = await handler(client, request);

      // Return response with cache headers
      const response = NextResponse.json(result);

      if (cache?.enabled) {
        response.headers.set(
          'Cache-Control',
          `public, s-maxage=${cache.ttl}, stale-while-revalidate`
        );
      }

      return response;
    } catch (error) {
      console.error('Etsy API route error:', error);

      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  return {
    GET: async (request: NextRequest) => {
      return handleRequest(request, async (client) => {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
          throw new Error('Endpoint parameter is required');
        }

        // Parse additional parameters
        const params: Record<string, any> = {};
        searchParams.forEach((value, key) => {
          if (key !== 'endpoint') {
            params[key] = value;
          }
        });

        // Make API call
        // Note: This is a simplified implementation
        // You would need to map endpoints to client methods
        return { message: 'GET endpoint', endpoint, params };
      });
    },

    POST: async (request: NextRequest) => {
      return handleRequest(request, async (client) => {
        const body = await request.json();
        const { endpoint, data } = body;

        if (!endpoint) {
          throw new Error('Endpoint parameter is required');
        }

        // Make API call
        return { message: 'POST endpoint', endpoint, data };
      });
    },

    PUT: async (request: NextRequest) => {
      return handleRequest(request, async (client) => {
        const body = await request.json();
        const { endpoint, data } = body;

        if (!endpoint) {
          throw new Error('Endpoint parameter is required');
        }

        // Make API call
        return { message: 'PUT endpoint', endpoint, data };
      });
    },

    DELETE: async (request: NextRequest) => {
      return handleRequest(request, async (client) => {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
          throw new Error('Endpoint parameter is required');
        }

        // Make API call
        return { message: 'DELETE endpoint', endpoint };
      });
    },
  };
}
