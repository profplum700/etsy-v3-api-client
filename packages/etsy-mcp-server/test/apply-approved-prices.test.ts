import { describe, expect, it } from "vitest";
import { inventoryFingerprint } from "../scripts/inventory-fingerprint.mjs";

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

  it("treats both approved variation price changes as expected in final verification", () => {
    const before = inventoryFingerprint(inventory(34, 38), targets);
    const after = inventoryFingerprint(inventory(31.5, 60.5), targets);

    expect(after).toBe(before);
  });

  it("still detects unrelated inventory changes after masking approved targets", () => {
    const before = inventoryFingerprint(inventory(34, 38), targets);
    const after = inventoryFingerprint(inventory(31.5, 60.5, 3), targets);

    expect(after).not.toBe(before);
  });
});
