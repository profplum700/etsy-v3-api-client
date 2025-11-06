'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { EtsyClient } from '@profplum700/etsy-v3-api-client';

interface EtsyNextClientContextValue {
  client: EtsyClient;
  apiEndpoint?: string;
}

const EtsyNextClientContext = createContext<EtsyNextClientContextValue | undefined>(undefined);

interface EtsyNextClientProviderProps {
  client: EtsyClient;
  apiEndpoint?: string;
  children: ReactNode;
}

/**
 * Client-side provider for Etsy client
 * Use this in your client components
 */
export function EtsyNextClientProvider({
  client,
  apiEndpoint,
  children
}: EtsyNextClientProviderProps) {
  return (
    <EtsyNextClientContext.Provider value={{ client, apiEndpoint }}>
      {children}
    </EtsyNextClientContext.Provider>
  );
}

export function useEtsyNextClient(): EtsyNextClientContextValue {
  const context = useContext(EtsyNextClientContext);
  if (!context) {
    throw new Error('useEtsyNextClient must be used within an EtsyNextClientProvider');
  }
  return context;
}
