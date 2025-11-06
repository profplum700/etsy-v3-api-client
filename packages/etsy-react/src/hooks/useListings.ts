import { useState, useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useQuery } from '../useQuery';
import type { UseQueryOptions, UsePaginatedQueryResult } from '../types';

interface ListingsOptions {
  state?: 'active' | 'inactive' | 'draft' | 'expired';
  limit?: number;
  offset?: number;
  sort_on?: 'created' | 'updated' | 'price';
  sort_order?: 'asc' | 'desc';
}

export function useListings(
  shopId: string,
  listingsOptions: ListingsOptions = {},
  queryOptions: UseQueryOptions<any[]> = {}
): UsePaginatedQueryResult<any> {
  const client = useEtsyClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [allData, setAllData] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const limit = listingsOptions.limit || 25;

  const queryFn = useCallback(async () => {
    const offset = currentPage * limit;
    const response = await client.getListingsByShop(shopId, {
      ...listingsOptions,
      limit,
      offset,
    });

    // Update pagination state
    const results = response.results || [];
    const count = response.count || 0;
    const totalPagesCalc = Math.ceil(count / limit);

    setTotalPages(totalPagesCalc);
    setHasMore(offset + results.length < count);

    if (currentPage === 0) {
      setAllData(results);
    } else {
      setAllData((prev) => [...prev, ...results]);
    }

    return results;
  }, [client, shopId, listingsOptions, limit, currentPage]);

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

export function useListing(
  listingId: string,
  options: UseQueryOptions<any> = {}
): any {
  const client = useEtsyClient();

  const queryFn = useCallback(async () => {
    return await client.getListing(listingId);
  }, [client, listingId]);

  return useQuery(queryFn, options);
}
