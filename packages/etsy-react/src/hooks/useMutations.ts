import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useMutation } from '../useMutation';
import type { UseMutationOptions, UseMutationResult } from '../types';

// Listing mutations
export function useUpdateListing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; listingId: string; updates: any }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; listingId: string; updates: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ shopId, listingId, updates }: { shopId: string; listingId: string; updates: any }) => {
      return await client.updateListing(shopId, listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useCreateDraftListing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; params: any }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; params: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ shopId, params }: { shopId: string; params: any }) => {
      return await client.createDraftListing(shopId, params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useDeleteListing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { listingId: string }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { listingId: string }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ listingId }: { listingId: string }) => {
      return await client.deleteListing(listingId);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Inventory mutations
export function useUpdateInventory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { listingId: string; updates: any }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { listingId: string; updates: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ listingId, updates }: { listingId: string; updates: any }) => {
      return await client.updateListingInventory(listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Image mutations
export function useUploadListingImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; listingId: string; image: File | Buffer; rank?: number }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; listingId: string; image: File | Buffer; rank?: number }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, listingId, image, rank }: { shopId: string; listingId: string; image: File | Buffer; rank?: number }) => {
      return await client.uploadListingImage(shopId, listingId, image, rank ? { rank } : undefined);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useDeleteListingImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; listingId: string; listingImageId: string }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; listingId: string; listingImageId: string }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, listingId, listingImageId }: { shopId: string; listingId: string; listingImageId: string }) => {
      return await client.deleteListingImage(shopId, listingId, listingImageId);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Receipt mutations
export function useUpdateReceipt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, receiptId, was_shipped, was_paid }: { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }) => {
      return await client.updateShopReceipt(shopId, receiptId, { was_shipped, was_paid });
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Shipping mutations
export function useCreateShippingProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: UseMutationOptions<any, { shopId: string; params: any }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, { shopId: string; params: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ shopId, params }: { shopId: string; params: any }) => {
      return await client.createShopShippingProfile(shopId, params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}
