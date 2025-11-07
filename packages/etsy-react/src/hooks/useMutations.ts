import { useCallback } from 'react';
import { useEtsyClient } from '../context';
import { useMutation } from '../useMutation';
import type { UseMutationOptions, UseMutationResult } from '../types';
import type {
  EtsyListing,
  UpdateListingParams,
  CreateDraftListingParams,
  UpdateListingInventoryParams,
  EtsyListingInventory,
  EtsyListingImage,
  EtsyShopReceipt,
  EtsyShippingProfile,
  CreateShippingProfileParams
} from '@profplum700/etsy-v3-api-client';

// Listing mutations
export function useUpdateListing(
  options?: UseMutationOptions<EtsyListing, { shopId: string; listingId: string; updates: UpdateListingParams }>
): UseMutationResult<EtsyListing, { shopId: string; listingId: string; updates: UpdateListingParams }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, listingId, updates }: { shopId: string; listingId: string; updates: UpdateListingParams }) => {
      return await client.updateListing(shopId, listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useCreateDraftListing(
  options?: UseMutationOptions<EtsyListing, { shopId: string; params: CreateDraftListingParams }>
): UseMutationResult<EtsyListing, { shopId: string; params: CreateDraftListingParams }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, params }: { shopId: string; params: CreateDraftListingParams }) => {
      return await client.createDraftListing(shopId, params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

export function useDeleteListing(
  options?: UseMutationOptions<void, { listingId: string }>
): UseMutationResult<void, { listingId: string }> {
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
  options?: UseMutationOptions<EtsyListingInventory, { listingId: string; updates: UpdateListingInventoryParams }>
): UseMutationResult<EtsyListingInventory, { listingId: string; updates: UpdateListingInventoryParams }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ listingId, updates }: { listingId: string; updates: UpdateListingInventoryParams }) => {
      return await client.updateListingInventory(listingId, updates);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}

// Image mutations
export function useUploadListingImage(
  options?: UseMutationOptions<EtsyListingImage, { shopId: string; listingId: string; image: File | Buffer; rank?: number }>
): UseMutationResult<EtsyListingImage, { shopId: string; listingId: string; image: File | Buffer; rank?: number }> {
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
  options?: UseMutationOptions<void, { shopId: string; listingId: string; listingImageId: string }>
): UseMutationResult<void, { shopId: string; listingId: string; listingImageId: string }> {
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
  options?: UseMutationOptions<EtsyShopReceipt, { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }>
): UseMutationResult<EtsyShopReceipt, { shopId: string; receiptId: string; was_shipped?: boolean; was_paid?: boolean }> {
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
  options?: UseMutationOptions<EtsyShippingProfile, { shopId: string; params: CreateShippingProfileParams }>
): UseMutationResult<EtsyShippingProfile, { shopId: string; params: CreateShippingProfileParams }> {
  const client = useEtsyClient();

  const mutationFn = useCallback(
    async ({ shopId, params }: { shopId: string; params: CreateShippingProfileParams }) => {
      return await client.createShopShippingProfile(shopId, params);
    },
    [client]
  );

  return useMutation(mutationFn, options);
}
