/**
 * The hooks work with the proxy client from createEtsyProxyClient(), so a
 * public web app can use them without the shared secret in the browser (#107).
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import {
  ETSY_PROXY_METHODS,
  EtsyAuthError,
  createEtsyProxyClient,
} from '@profplum700/etsy-v3-api-client';
import { EtsyProvider } from '../src/context';
import { useShop } from '../src/hooks/useShop';
import { useDeleteListing } from '../src/hooks/useMutations';
import type { EtsyReactClientMethod } from '../src/types';

function proxyWith(fetchImpl: typeof fetch): ReturnType<typeof createEtsyProxyClient> {
  return createEtsyProxyClient({ endpoint: '/api/etsy', fetch: fetchImpl });
}

function wrapperFor(client: ReturnType<typeof createEtsyProxyClient>) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <EtsyProvider client={client}>{children}</EtsyProvider>;
  };
}

describe('etsy-react with the proxy client', () => {
  it('covers every method the hooks call', () => {
    // A compile-time check that the two lists name the same methods...
    const fromCore: readonly EtsyReactClientMethod[] = ETSY_PROXY_METHODS;
    // ...and a runtime one that they have the same length.
    const hookMethods: Record<EtsyReactClientMethod, true> = {
      getShop: true,
      getShopSections: true,
      getListingsByShop: true,
      getListing: true,
      getShopReceipts: true,
      getShopReceipt: true,
      updateListing: true,
      createDraftListing: true,
      deleteListing: true,
      updateListingInventory: true,
      uploadListingImage: true,
      deleteListingImage: true,
      updateShopReceipt: true,
      createShopShippingProfile: true,
    };
    expect([...fromCore].sort()).toEqual(Object.keys(hookMethods).sort());
  });

  it('loads data through the proxy route', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ result: { shop_id: 42, shop_name: 'Proxy Shop' } }), { status: 200 })
    );

    const { result } = renderHook(() => useShop('42'), { wrapper: wrapperFor(proxyWith(fetchSpy)) });

    await waitFor(() => expect(result.current.data).toEqual({ shop_id: 42, shop_name: 'Proxy Shop' }));
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, { method?: string; credentials?: string; headers?: unknown; body?: unknown }];
    expect(url).toBe('/api/etsy');
    expect(JSON.parse(String(init.body))).toEqual({ method: 'getShop', args: ['42'] });
  });

  it('surfaces the typed error the server returned', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { name: 'EtsyAuthError', message: 'Sign in again', code: 'REAUTH_REQUIRED' } }),
        { status: 401 }
      )
    );

    const { result } = renderHook(() => useShop('42'), { wrapper: wrapperFor(proxyWith(fetchSpy)) });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(EtsyAuthError));
    expect((result.current.error as EtsyAuthError).code).toBe('REAUTH_REQUIRED');
  });

  it('runs mutations through the proxy route', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ result: null }), { status: 200 }));

    const { result } = renderHook(() => useDeleteListing(), { wrapper: wrapperFor(proxyWith(fetchSpy)) });
    await result.current.mutate({ listingId: '7' });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, { method?: string; credentials?: string; headers?: unknown; body?: unknown }];
    expect(JSON.parse(String(init.body))).toEqual({ method: 'deleteListing', args: ['7'] });
  });
});
