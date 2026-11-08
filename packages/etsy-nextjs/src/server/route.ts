import { NextRequest, NextResponse } from 'next/server';

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

const NOT_IMPLEMENTED_MESSAGE =
  'createEtsyApiRoute does not call the Etsy API yet. Write your own route handler ' +
  'that calls getEtsyServerClient(). See ' +
  'https://github.com/profplum700/etsy-v3-api-client/issues/107';

/**
 * Not implemented yet: every handler answers 501 Not Implemented.
 *
 * Earlier versions returned placeholder JSON with status 200 and never called
 * Etsy. Until a real proxy exists (tracked in issue #107), write your own route
 * handler that calls `getEtsyServerClient()` for the current request.
 *
 * @deprecated Not implemented; see issue #107.
 */
export function createEtsyApiRoute(_config: EtsyApiRouteConfig): {
  GET: (request: NextRequest) => Promise<NextResponse>;
  POST: (request: NextRequest) => Promise<NextResponse>;
  PUT: (request: NextRequest) => Promise<NextResponse>;
  DELETE: (request: NextRequest) => Promise<NextResponse>;
} {
  const notImplemented = async (_request: NextRequest): Promise<NextResponse> =>
    NextResponse.json({ error: NOT_IMPLEMENTED_MESSAGE }, { status: 501 });

  return {
    GET: notImplemented,
    POST: notImplemented,
    PUT: notImplemented,
    DELETE: notImplemented,
  };
}
