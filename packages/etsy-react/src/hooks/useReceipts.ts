import { useState, useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useQuery } from '../useQuery';
import type { UseQueryOptions, UsePaginatedQueryResult } from '../types';

interface ReceiptsOptions {
  was_paid?: boolean;
  was_shipped?: boolean;
  limit?: number;
  offset?: number;
  min_created?: number;
  max_created?: number;
  min_last_modified?: number;
  max_last_modified?: number;
  sort_on?: 'created' | 'updated';
  sort_order?: 'up' | 'down';
}

export function useReceipts(
  shopId: string,
  receiptsOptions: ReceiptsOptions = {},
  queryOptions: UseQueryOptions<any[]> = {}
): UsePaginatedQueryResult<any> {
  const client = useEtsyClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [allData, setAllData] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const limit = receiptsOptions.limit || 25;

  const queryFn = useCallback(async () => {
    const offset = currentPage * limit;
    const response = await client.getShopReceipts(shopId, {
      ...receiptsOptions,
      limit,
      offset,
    });

    // Handle both array response and paginated response
    const results = Array.isArray(response) ? response : (response as any).results || [];
    const count = Array.isArray(response) ? response.length : (response as any).count || 0;
    const totalPagesCalc = Math.ceil(count / limit);

    setTotalPages(totalPagesCalc);
    setHasMore(offset + results.length < count);

    if (currentPage === 0) {
      setAllData(results);
    } else {
      setAllData((prev) => [...prev, ...results]);
    }

    return results;
  }, [client, shopId, receiptsOptions, limit, currentPage]);

  const result = useQuery(queryFn, queryOptions);

  const loadMore = useCallback(async () => {
    if (hasMore && !result.loading) {
      setCurrentPage((prev) => prev + 1);
      await result.refetch();
    }
  }, [hasMore, result]);

  return {
    ...result,
    data: allData,
    hasMore,
    loadMore,
    currentPage,
    totalPages,
  };
}

export function useReceipt(
  shopId: string,
  receiptId: string,
  options: UseQueryOptions<any> = {}
): any {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getShopReceipt(shopId, receiptId);
  }, [client, shopId, receiptId]);

  return useQuery(queryFn, options);
}
