import React from 'react';
import { useShop } from '@profplum700/etsy-react';

export interface ShopDashboardProps {
  shopId: string;
  className?: string;
  onError?: (error: Error) => void;
}

export function ShopDashboard({ shopId, className = '', onError }: ShopDashboardProps): React.JSX.Element | null {
  const { data: shop, loading, error } = useShop(shopId, {
    onError: onError || ((): void => {}),
  });

  if (loading) {
    return (
      <div className={`etsy-shop-dashboard ${className}`}>
        <div className="etsy-loading">Loading shop details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`etsy-shop-dashboard ${className}`}>
        <div className="etsy-error">Error: {error.message}</div>
      </div>
    );
  }

  if (!shop) {
    return null;
  }

  return (
    <div className={`etsy-shop-dashboard ${className}`}>
      <div className="etsy-shop-header">
        <h1 className="etsy-shop-title">{shop.title}</h1>
        <p className="etsy-shop-name">@{shop.shop_name}</p>
      </div>

      <div className="etsy-shop-stats">
        <div className="etsy-stat-card">
          <div className="etsy-stat-value">{shop.listing_active_count || 0}</div>
          <div className="etsy-stat-label">Active Listings</div>
        </div>

        <div className="etsy-stat-card">
          <div className="etsy-stat-value">{shop.currency_code}</div>
          <div className="etsy-stat-label">Currency</div>
        </div>

        <div className="etsy-stat-card">
          <div className="etsy-stat-value">
            {shop.is_vacation ? 'On Vacation' : 'Open'}
          </div>
          <div className="etsy-stat-label">Status</div>
        </div>
      </div>

      {shop.announcement && (
        <div className="etsy-shop-announcement">
          <h3>Shop Announcement</h3>
          <p>{shop.announcement}</p>
        </div>
      )}

      <div className="etsy-shop-details">
        <div className="etsy-detail-row">
          <span className="etsy-detail-label">Shop URL:</span>
          <a href={shop.url} target="_blank" rel="noopener noreferrer" className="etsy-detail-value">
            {shop.url}
          </a>
        </div>
        {shop.sale_message && (
          <div className="etsy-detail-row">
            <span className="etsy-detail-label">Sale Message:</span>
            <span className="etsy-detail-value">{shop.sale_message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
