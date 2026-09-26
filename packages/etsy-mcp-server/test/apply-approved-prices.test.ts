import { describe, expect, it } from "vitest";
import { inventoryFingerprint } from "../scripts/inventory-fingerprint.mjs";
import { finalVerificationRows, verifyFinalListingSnapshots } from "../scripts/final-verification.mjs";

function inventory(firstPrice: number, secondPrice: number, quantity = 4) {
  return {
    products: [{
      product_id: 10,
      sku: "synthetic",
      property_values: [],
      offerings: [
        { offering_id: 101, price: { amount: firstPrice * 100, divisor: 100, currency_code: "GBP" }, quantity, is_enabled: true },
        { offering_id: 102, price: { amount: secondPrice * 100, divisor: 100, currency_code: "GBP" }, quantity: 4, is_enabled: true },
        { offering_id: 103, price: { amount: 12_000, divisor: 100, currency_code: "GBP" }, quantity: 1, is_enabled: true },
      ],
    }],
    price_on_property: [1],
  };
}

describe("approved price batch inventory fingerprints", () => {
  const targets = new Set(["10:101", "10:102"]);

  it("includes already-at-target approved rows in final verification", () => {
    const ready = { state: "READY", row: { listing_id: 1 } };
    const alreadyAtTarget = { state: "VERIFIED", row: { listing_id: 2 } };
    const stale = { state: "STALE", row: { listing_id: 3 } };

    expect(finalVerificationRows([ready, alreadyAtTarget, stale])).toEqual([ready, alreadyAtTarget]);
  });

  it("verifies same-listing targets from one shared final inventory snapshot", async () => {
    const rows = [
      { state: "READY", row: { listing_id: 1, offering_id: 101 } },
      { state: "READY", row: { listing_id: 1, offering_id: 102 } },
    ];
    let reads = 0;
    const observed: number[] = [];

    await verifyFinalListingSnapshots(
      rows,
      async () => {
        reads += 1;
        return reads === 1 ? new Map([[101, 31.5], [102, 60.5]]) : new Map([[101, 38], [102, 60.5]]);
      },
      (candidate, snapshot) => { observed.push(snapshot.get(candidate.row.offering_id)!); },
    );

    expect(reads).toBe(1);
    expect(observed).toEqual([31.5, 60.5]);
  });

  it("treats both approved variation price changes as expected in final verification", () => {
    const before = inventoryFingerprint(inventory(34, 38), targets);
    const after = inventoryFingerprint(inventory(31.5, 60.5), targets);

    expect(after).toBe(before);
  });

  it("masks only the active target during immediate write/readback verification", () => {
    const oneTarget = new Set(["10:101"]);
    const before = inventoryFingerprint(inventory(34, 38), oneTarget);

    expect(inventoryFingerprint(inventory(31.5, 38), oneTarget)).toBe(before);
    expect(inventoryFingerprint(inventory(31.5, 39), oneTarget)).not.toBe(before);
  });

  it("still detects unrelated inventory changes after masking approved targets", () => {
    const before = inventoryFingerprint(inventory(34, 38), targets);
    const after = inventoryFingerprint(inventory(31.5, 60.5, 3), targets);

    expect(after).not.toBe(before);
  });
});
