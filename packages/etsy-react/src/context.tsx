import React, { createContext, useContext, ReactNode } from 'react';
import type { EtsyClient } from '@profplum700/etsy-v3-api-client';

interface EtsyContextValue {
  client: EtsyClient;
}

const EtsyContext = createContext<EtsyContextValue | undefined>(undefined);

interface EtsyProviderProps {
  client: EtsyClient;
  children: ReactNode;
}

export function EtsyProvider({ client, children }: EtsyProviderProps) {
  return (
    <EtsyContext.Provider value={{ client }}>
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

export function useEtsyClient(): EtsyClient {
  const { client } = useEtsyContext();
  return client;
}
