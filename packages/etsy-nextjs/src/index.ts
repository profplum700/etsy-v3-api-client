// Default export: Server-side only (safe for API routes, Server Components, and Server Actions)
// This prevents "createContext is not a function" build errors when importing in API routes
// For client-side features, import from '@profplum700/etsy-nextjs/client'

export {
  configureEtsyServerClient,
  getEtsyServerClient,
  createEtsyServerClient,
  type EtsyServerClientConfig,
} from './server/client';

export {
  createEtsyApiRoute,
  type EtsyApiRouteConfig,
} from './server/route';

export {
  createOAuthRoute,
  type OAuthTokenResponse,
} from './server/oauth';
