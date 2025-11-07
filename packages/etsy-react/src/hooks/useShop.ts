import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useQuery } from '../useQuery';
import type { UseQueryOptions, UseQueryResult } from '../types';

export function useShop(
  shopId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: UseQueryOptions<any> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseQueryResult<any> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShop(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}

export function useShopSections(
  shopId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: UseQueryOptions<any[]> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseQueryResult<any[]> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShopSections(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}
