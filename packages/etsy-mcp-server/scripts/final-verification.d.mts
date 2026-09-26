export function finalVerificationRows<T extends { state: string }>(preflight: readonly T[]): T[];
export function verifyFinalListingSnapshots<T extends { row: { listing_id: string | number } }, S>(
  rows: readonly T[],
  readSnapshot: (listingId: string | number, rows: readonly T[]) => Promise<S>,
  verifyRow: (row: T, snapshot: S) => void | Promise<void>,
): Promise<void>;
