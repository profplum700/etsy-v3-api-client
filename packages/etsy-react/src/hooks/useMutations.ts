import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useMutation } from '../useMutation';
import type { UseMutationOptions, UseMutationResult } from '../types';

// Listing mutations
export function useUpdateListing(
  options?: UseMutationOptions<any, { shopId: string; listingId: string; updates: any }>
): UseMutationResult<any, { shopId: string; listingId: string; updates: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, listingId, updates }: { shopId: string; listingId: string; updates: any }) => {
      return await client.updateListing(shopId, listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useCreateDraftListing(
  options?: UseMutationOptions<any, { shopId: string; params: any }>
): UseMutationResult<any, { shopId: string; params: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, params }: { shopId: string; params: any }) => {
      return await client.createDraftListing(shopId, params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useDeleteListing(
  options?: UseMutationOptions<any, { listingId: string }>
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
  options?: UseMutationOptions<any, { listingId: string; updates: any }>
): UseMutationResult<any, { listingId: string; updates: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ listingId, updates }: { listingId: string; updates: any }) => {
      return await client.updateListingInventory(listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Image mutations
export function useUploadListingImage(
  options?: UseMutationOptions<any, { shopId: string; listingId: string; image: File | Buffer; rank?: number; overwrite?: boolean }>
): UseMutationResult<any, { shopId: string; listingId: string; image: File | Buffer; rank?: number; overwrite?: boolean }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, listingId, image, rank, overwrite }: { shopId: string; listingId: string; image: File | Buffer; rank?: number; overwrite?: boolean }) => {
      return await client.uploadListingImage(shopId, listingId, image, rank, overwrite);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useDeleteListingImage(
  options?: UseMutationOptions<any, { shopId: string; listingId: string; listingImageId: string }>
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
  options?: UseMutationOptions<any, { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }>
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
  options?: UseMutationOptions<any, { params: any }>
): UseMutationResult<any, { params: any }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ params }: { params: any }) => {
      return await client.createShopShippingProfile(params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}
