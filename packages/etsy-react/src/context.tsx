import React, { createContext, useContext, ReactNode } from 'react';
import type { EtsyClient } from '@profplum700/etsy-v3-api-client';
import type { EtsyReactClient } from './types';

interface EtsyContextValue {
  /**
   * Typed as `EtsyClient` for compatibility. When the provider was given a
   * proxy client, only the `EtsyReactClient` methods exist on it.
   */
  client: EtsyClient;
}

const EtsyContext = createContext<EtsyContextValue | undefined>(undefined);

interface EtsyProviderProps {
  /**
   * The client the hooks call. Pass `createEtsyProxyClient({ endpoint })` in a
   * public web app, so the shared secret and tokens stay on your server. Pass
   * an `EtsyClient` only where everyone who can load the app may see the
   * shared secret, such as an internal tool.
   */
  client: EtsyReactClient;
  children: ReactNode;
}

export function EtsyProvider({ client, children }: EtsyProviderProps): React.JSX.Element {
  return (
    <EtsyContext.Provider value={{ client: client as EtsyClient }}>
      {children}
    </EtsyContext.Provider>
  );
}

export function useEtsyContext(): EtsyContextValue {
  const context = useContext(EtsyContext);
  if (!context) {
    throw new Error('useEtsyContext must be used within an EtsyProvider');
  }
  return context;
}

/**
 * The client from the nearest `EtsyProvider`. Typed as `EtsyClient` by
 * default for compatibility; with a proxy client, use
 * `useEtsyClient<EtsyReactClient>()` to see only the methods it has.
 */
export function useEtsyClient<T extends EtsyReactClient = EtsyClient>(): T {
  const { client } = useEtsyContext();
  return client as unknown as T;
}
