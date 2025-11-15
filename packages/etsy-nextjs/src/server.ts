// Server-side exports only
// This file contains ONLY server-side code with NO React dependencies
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
