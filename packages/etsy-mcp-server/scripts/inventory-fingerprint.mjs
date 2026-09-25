function major(price) {
  if (!price || !Number.isFinite(price.amount) || !Number.isFinite(price.divisor) || price.divisor <= 0) {
    throw new Error("Etsy returned invalid price data.");
  }
  return price.amount / price.divisor;
}

function normalizedProperties(product) {
  return (product.property_values ?? []).map((property) => ({
    property_id: property.property_id,
    property_name: property.property_name,
    scale_id: property.scale_id ?? null,
    scale_name: property.scale_name ?? null,
    value_ids: [...(property.value_ids ?? [])],
    values: [...(property.values ?? [])],
  })).sort((left, right) => left.property_id - right.property_id);
}

/** Fingerprint all non-target prices and inventory fields for batch readback. */
export function inventoryFingerprint(inventory, targetOfferings = new Set()) {
  const products = (inventory.products ?? []).filter((product) => !product.is_deleted).map((product) => ({
    product_id: String(product.product_id),
    sku: product.sku ?? null,
    property_values: normalizedProperties(product),
    offerings: (product.offerings ?? []).filter((offering) => !offering.is_deleted).map((offering) => ({
      offering_id: String(offering.offering_id),
      price: targetOfferings.has(`${product.product_id}:${offering.offering_id}`)
        ? "TARGET_PRICE"
        : major(offering.price),
      currency_code: offering.price.currency_code,
      quantity: offering.quantity,
      is_enabled: offering.is_enabled,
      readiness_state_id: offering.readiness_state_id ?? null,
    })).sort((left, right) => left.offering_id.localeCompare(right.offering_id)),
  })).sort((left, right) => left.product_id.localeCompare(right.product_id));
  const flags = Object.fromEntries(["price_on_property", "quantity_on_property", "sku_on_property", "readiness_state_on_property"]
    .map((key) => [key, inventory[key] ?? null]));
  return JSON.stringify({ products, flags });
}
