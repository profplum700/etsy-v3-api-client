import React, { useState } from 'react';
import { useReceipts, useUpdateReceipt } from '@profplum700/etsy-react';

export interface OrderFulfillmentProps {
  shopId: string;
  className?: string;
  onOrderUpdate?: (receipt: any) => void;
}

export function OrderFulfillment({
  shopId,
  className = '',
  onOrderUpdate,
}: OrderFulfillmentProps) {
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'unshipped'>('unshipped');

  const receiptsOptions: any = {};
  if (filter === 'unpaid') {
    receiptsOptions.was_paid = false;
  } else if (filter === 'unshipped') {
    receiptsOptions.was_paid = true;
    receiptsOptions.was_shipped = false;
  }

  const { data: receipts, loading, error, hasMore, loadMore } = useReceipts(
    shopId,
    receiptsOptions,
    {}
  );

  const { mutate: updateReceipt } = useUpdateReceipt({
    onSuccess: (data) => {
      onOrderUpdate?.(data);
    },
  });

  if (loading && !receipts.length) {
    return (
      <div className={`etsy-order-fulfillment ${className}`}>
        <div className="etsy-loading">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`etsy-order-fulfillment ${className}`}>
        <div className="etsy-error">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className={`etsy-order-fulfillment ${className}`}>
      <div className="etsy-order-header">
        <h2>Orders</h2>
        <div className="etsy-order-filters">
          <button
            className={`etsy-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`etsy-filter-btn ${filter === 'unpaid' ? 'active' : ''}`}
            onClick={() => setFilter('unpaid')}
          >
            Unpaid
          </button>
          <button
            className={`etsy-filter-btn ${filter === 'unshipped' ? 'active' : ''}`}
            onClick={() => setFilter('unshipped')}
          >
            Unshipped
          </button>
        </div>
      </div>

      <div className="etsy-order-list">
        {receipts.map((receipt) => (
          <div key={receipt.receipt_id} className="etsy-order-card">
            <div className="etsy-order-header">
              <h3 className="etsy-order-id">Order #{receipt.receipt_id}</h3>
              <span className="etsy-order-date">
                {new Date(receipt.create_timestamp * 1000).toLocaleDateString()}
              </span>
            </div>

            <div className="etsy-order-buyer">
              <strong>{receipt.name}</strong>
              {receipt.first_line && <div>{receipt.first_line}</div>}
              {receipt.city && receipt.state && (
                <div>
                  {receipt.city}, {receipt.state} {receipt.zip}
                </div>
              )}
            </div>

            <div className="etsy-order-details">
              <div className="etsy-order-total">
                <strong>Total:</strong> {receipt.grandtotal.currency_code}{' '}
                {receipt.grandtotal.amount / receipt.grandtotal.divisor}
              </div>
              <div className="etsy-order-status">
                <span className={`etsy-badge ${receipt.was_paid ? 'etsy-badge-success' : 'etsy-badge-warning'}`}>
                  {receipt.was_paid ? 'Paid' : 'Unpaid'}
                </span>
                <span className={`etsy-badge ${receipt.was_shipped ? 'etsy-badge-success' : 'etsy-badge-warning'}`}>
                  {receipt.was_shipped ? 'Shipped' : 'Unshipped'}
                </span>
              </div>
            </div>

            {receipt.message_from_buyer && (
              <div className="etsy-order-message">
                <strong>Buyer message:</strong>
                <p>{receipt.message_from_buyer}</p>
              </div>
            )}

            <div className="etsy-order-actions">
              {!receipt.was_paid && (
                <button
                  className="etsy-btn etsy-btn-sm"
                  onClick={() => {
                    updateReceipt({
                      shopId,
                      receiptId: receipt.receipt_id.toString(),
                      was_paid: true,
                    });
                  }}
                >
                  Mark as Paid
                </button>
              )}
              {receipt.was_paid && !receipt.was_shipped && (
                <button
                  className="etsy-btn etsy-btn-sm etsy-btn-primary"
                  onClick={() => {
                    updateReceipt({
                      shopId,
                      receiptId: receipt.receipt_id.toString(),
                      was_shipped: true,
                    });
                  }}
                >
                  Mark as Shipped
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="etsy-order-footer">
          <button className="etsy-btn" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {receipts.length === 0 && (
        <div className="etsy-empty-state">
          <p>No orders found</p>
        </div>
      )}
    </div>
  );
}
