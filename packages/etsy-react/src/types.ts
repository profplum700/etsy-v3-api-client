import type { EtsyClient } from '@profplum700/etsy-v3-api-client';

export interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

export interface UsePaginatedQueryResult<T> extends UseQueryResult<T[]> {
  hasMore: boolean;
  loadMore: () => Promise<void>;
  currentPage: number;
  totalPages: number | null;
}

/**
 * The methods the hooks call. `EtsyProvider` accepts any object with them:
 * an `EtsyClient` in a trusted environment, or in a public web app the proxy
 * client from `createEtsyProxyClient()` in `@profplum700/etsy-v3-api-client`,
 * which forwards each call to your server so the shared secret stays there.
 */
export type EtsyReactClientMethod =
  | 'getShop'
  | 'getShopSections'
  | 'getListingsByShop'
  | 'getListing'
  | 'getShopReceipts'
  | 'getShopReceipt'
  | 'updateListing'
  | 'createDraftListing'
  | 'deleteListing'
  | 'updateListingInventory'
  | 'uploadListingImage'
  | 'deleteListingImage'
  | 'updateShopReceipt'
  | 'createShopShippingProfile';

/** A client the hooks can use. See `EtsyReactClientMethod`. */
export type EtsyReactClient = Pick<EtsyClient, EtsyReactClientMethod>;
