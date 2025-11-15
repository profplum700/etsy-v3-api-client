// Main entry point - Server-side exports ONLY
// This ensures safe imports in API routes and Server Components
// For client-side functionality, import from '@profplum700/etsy-nextjs/client'

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
