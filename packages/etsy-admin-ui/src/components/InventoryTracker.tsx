import React from 'react';
import { useListings } from '@profplum700/etsy-react';
import type { EtsyListing } from '@profplum700/etsy-v3-api-client';

export interface InventoryTrackerProps {
  shopId: string;
  className?: string;
  lowStockThreshold?: number;
}

export function InventoryTracker({
  shopId,
  className = '',
  lowStockThreshold = 5,
}: InventoryTrackerProps): React.JSX.Element {
  const { data: listings, loading, error } = useListings(shopId, {
    state: 'active',
    limit: 100,
  });

  if (loading && (!listings || !listings.length)) {
    return (
      <div className={`etsy-inventory-tracker ${className}`}>
        <div className="etsy-loading">Loading inventory...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`etsy-inventory-tracker ${className}`}>
        <div className="etsy-error">Error: {error.message}</div>
      </div>
    );
  }

  if (!listings) {
    return (
      <div className={`etsy-inventory-tracker ${className}`}>
        <div className="etsy-empty-state">
          <p>No listings available</p>
        </div>
      </div>
    );
  }

  // Note: quantity is not directly on EtsyListing type but may be returned by API
  const getQuantity = (listing: EtsyListing): number => {
    return (listing as EtsyListing & { quantity?: number }).quantity || 0;
  };

  const lowStockItems = listings.filter(
    (listing) => getQuantity(listing) <= lowStockThreshold && getQuantity(listing) > 0
  );
  const outOfStockItems = listings.filter((listing) => getQuantity(listing) === 0);
  const inStockItems = listings.filter((listing) => getQuantity(listing) > lowStockThreshold);

  const totalInventory = listings.reduce((sum, listing) => sum + getQuantity(listing), 0);

  return (
    <div className={`etsy-inventory-tracker ${className}`}>
      <div className="etsy-inventory-header">
        <h2>Inventory Tracker</h2>
      </div>

      <div className="etsy-inventory-summary">
        <div className="etsy-inventory-stat">
          <div className="etsy-stat-value">{totalInventory}</div>
          <div className="etsy-stat-label">Total Items</div>
        </div>
        <div className="etsy-inventory-stat">
          <div className="etsy-stat-value etsy-stat-success">{inStockItems.length}</div>
          <div className="etsy-stat-label">In Stock</div>
        </div>
        <div className="etsy-inventory-stat">
          <div className="etsy-stat-value etsy-stat-warning">{lowStockItems.length}</div>
          <div className="etsy-stat-label">Low Stock</div>
        </div>
        <div className="etsy-inventory-stat">
          <div className="etsy-stat-value etsy-stat-danger">{outOfStockItems.length}</div>
          <div className="etsy-stat-label">Out of Stock</div>
        </div>
      </div>

      {outOfStockItems.length > 0 && (
        <div className="etsy-inventory-section">
          <h3 className="etsy-section-title">Out of Stock</h3>
          <div className="etsy-inventory-list">
            {outOfStockItems.map((listing) => (
              <div key={listing.listing_id} className="etsy-inventory-item etsy-item-danger">
                <div className="etsy-item-info">
                  <span className="etsy-item-title">{listing.title}</span>
                  <span className="etsy-item-id">#{listing.listing_id}</span>
                </div>
                <div className="etsy-item-quantity">
                  <span className="etsy-quantity-badge etsy-badge-danger">0</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div className="etsy-inventory-section">
          <h3 className="etsy-section-title">Low Stock (≤{lowStockThreshold})</h3>
          <div className="etsy-inventory-list">
            {lowStockItems.map((listing) => (
              <div key={listing.listing_id} className="etsy-inventory-item etsy-item-warning">
                <div className="etsy-item-info">
                  <span className="etsy-item-title">{listing.title}</span>
                  <span className="etsy-item-id">#{listing.listing_id}</span>
                </div>
                <div className="etsy-item-quantity">
                  <span className="etsy-quantity-badge etsy-badge-warning">
                    {getQuantity(listing)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {listings.length === 0 && (
        <div className="etsy-empty-state">
          <p>No active listings found</p>
        </div>
      )}
    </div>
  );
}
