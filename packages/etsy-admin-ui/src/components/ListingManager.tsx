import React, { useState } from 'react';
import { useListings, useUpdateListing, useDeleteListing } from '@profplum700/etsy-react';

export interface ListingManagerProps {
  shopId: string;
  className?: string;
  onListingUpdate?: (listing: unknown) => void;
  onListingDelete?: (listingId: string) => void;
}

export function ListingManager({
  shopId,
  className = '',
  onListingUpdate,
  onListingDelete,
}: ListingManagerProps): React.JSX.Element {
  const [filter, setFilter] = useState<'active' | 'inactive' | 'draft' | 'expired'>('active');
  const { data: listings, loading, error, hasMore, loadMore } = useListings(shopId, {
    state: filter,
    limit: 25,
  });

  const { mutate: updateListing } = useUpdateListing({
    onSuccess: (data) => {
      onListingUpdate?.(data);
    },
  });

  const { mutate: deleteListing } = useDeleteListing({
    onSuccess: (_, variables) => {
      onListingDelete?.(variables.listingId);
    },
  });

  if (loading && (!listings || !listings.length)) {
    return (
      <div className={`etsy-listing-manager ${className}`}>
        <div className="etsy-loading">Loading listings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`etsy-listing-manager ${className}`}>
        <div className="etsy-error">Error: {error.message}</div>
      </div>
    );
  }

  if (!listings) {
    return (
      <div className={`etsy-listing-manager ${className}`}>
        <div className="etsy-empty-state">
          <p>No listings available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`etsy-listing-manager ${className}`}>
      <div className="etsy-listing-header">
        <h2>Listings</h2>
        <div className="etsy-listing-filters">
          <button
            className={`etsy-filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`etsy-filter-btn ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilter('inactive')}
          >
            Inactive
          </button>
          <button
            className={`etsy-filter-btn ${filter === 'draft' ? 'active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Draft
          </button>
          <button
            className={`etsy-filter-btn ${filter === 'expired' ? 'active' : ''}`}
            onClick={() => setFilter('expired')}
          >
            Expired
          </button>
        </div>
      </div>

      <div className="etsy-listing-grid">
        {listings.map((listing) => (
          <div key={listing.listing_id} className="etsy-listing-card">
            <div className="etsy-listing-image">
              {listing.images?.[0] && (
                <img
                  src={listing.images[0].url_570xN}
                  alt={listing.title}
                  loading="lazy"
                />
              )}
            </div>
            <div className="etsy-listing-content">
              <h3 className="etsy-listing-title">{listing.title}</h3>
              <div className="etsy-listing-meta">
                <span className="etsy-listing-price">
                  {listing.price.currency_code} {listing.price.amount / listing.price.divisor}
                </span>
                <span className="etsy-listing-quantity">
                  Qty: {(listing as typeof listing & { quantity?: number }).quantity || 0}
                </span>
                <span className={`etsy-listing-state etsy-state-${listing.state}`}>
                  {listing.state}
                </span>
              </div>
              <div className="etsy-listing-actions">
                <button
                  className="etsy-btn etsy-btn-sm"
                  onClick={() => {
                    const newState = listing.state === 'active' ? 'inactive' : 'active';
                    updateListing({
                      shopId,
                      listingId: listing.listing_id.toString(),
                      updates: { state: newState },
                    });
                  }}
                >
                  {listing.state === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="etsy-btn etsy-btn-sm etsy-btn-danger"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this listing?')) {
                      deleteListing({ listingId: listing.listing_id.toString() });
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="etsy-listing-footer">
          <button className="etsy-btn" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {listings.length === 0 && (
        <div className="etsy-empty-state">
          <p>No {filter} listings found</p>
        </div>
      )}
    </div>
  );
}
