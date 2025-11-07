import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useQuery } from '../useQuery';
import type { UseQueryOptions, UseQueryResult } from '../types';
import type { EtsyShop, EtsyShopSection } from '@profplum700/etsy-v3-api-client';

export function useShop(
  shopId: string,
  options: UseQueryOptions<EtsyShop> = {}
): UseQueryResult<EtsyShop> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShop(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}

export function useShopSections(
  shopId: string,
  options: UseQueryOptions<EtsyShopSection[]> = {}
): UseQueryResult<EtsyShopSection[]> {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShopSections(shopId);
  }, [client, shopId]);

  return useQuery(queryFn, options);
}
