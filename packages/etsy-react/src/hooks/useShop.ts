import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useQuery } from '../useQuery';
import type { UseQueryOptions, UseQueryResult } from '../types';

export function useShop(
  shopId: string,
  options: UseQueryOptions<any> = {}
): UseQueryResult<any> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShop(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}

export function useShopSections(
  shopId: string,
  options: UseQueryOptions<any[]> = {}
): UseQueryResult<any[]> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShopSections(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}
