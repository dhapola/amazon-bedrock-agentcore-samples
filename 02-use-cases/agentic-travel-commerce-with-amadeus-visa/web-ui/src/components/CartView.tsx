import React, { useState, useEffect } from 'react';
import { getCartItems, removeCartItems, type CartItem } from '../services/cartService';
import EmptyState from './EmptyState';

interface CartViewProps {
  user: any;
  onCartUpdate?: () => void;
  onPurchaseConfirm?: (items: CartItem[]) => void;
  refreshTrigger?: number;
}

const CartView: React.FC<CartViewProps> = ({
  user,
  onCartUpdate,
  onPurchaseConfirm,
  refreshTrigger
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  const loadCartItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await getCartItems(user.userId);
      setCartItems(items);
    } catch (err) {
      console.error('Error loading cart items:', err);
      setError('Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (item: CartItem) => {
    const identifier = item.item_type === 'product' ? item.asin :
                      item.item_type === 'hotel' ? item.details?.hotel_id :
                      item.details?.flight_id || item.asin || 'unknown';

    if (!identifier || removingItems.has(identifier)) return;

    try {
      setRemovingItems(prev => new Set(prev).add(identifier));

      const identifiers: { asins?: string[], flight_ids?: string[], hotel_ids?: string[] } = {};
      if (item.item_type === 'flight' && item.details?.flight_id) {
        identifiers.flight_ids = [item.details.flight_id];
      } else if (item.item_type === 'hotel' && item.details?.hotel_id) {
        identifiers.hotel_ids = [item.details.hotel_id];
      } else if (item.asin) {
        identifiers.asins = [item.asin];
      }

      await removeCartItems(user.userId, identifiers);

      setCartItems(prev => prev.filter(i => {
        if (i.item_type === 'product') return i.asin !== identifier;
        if (i.item_type === 'hotel') return i.details?.hotel_id !== identifier;
        if (i.item_type === 'flight') return i.details?.flight_id !== identifier;
        return true;
      }));

      if (onCartUpdate) {
        onCartUpdate();
      }
    } catch (err) {
      console.error('Error removing item:', err);
      setError('Failed to remove item');
    } finally {
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(identifier);
        return newSet;
      });
    }
  };

  const getItemIcon = (itemType?: string) => {
    switch (itemType) {
      case 'hotel':
        return '🏨';
      case 'flight':
        return '✈️';
      default:
        return '📦';
    }
  };

  const getItemTypeLabel = (itemType?: string) => {
    switch (itemType) {
      case 'hotel':
        return 'Hotel';
      case 'flight':
        return 'Flight';
      default:
        return 'Product';
    }
  };

  const formatPrice = (price: string) => {
    if (price.includes('$')) return price;
    return `$${price}`;
  };

  useEffect(() => {
    loadCartItems();
  }, [user.userId, refreshTrigger]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cartItems.reduce((sum, item) =>
    sum + parseFloat(item.price.replace('$', '').replace(',', '')), 0
  ).toFixed(2);

  if (loading) {
    return (
      <div className="panel-loading">
        <div className="panel-loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-empty">
        <div className="panel-empty-icon">⚠️</div>
        <div className="panel-empty-text">{error}</div>
        <button
          className="panel-refresh-button mt-4"
          onClick={loadCartItems}
        >
          Retry
        </button>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return <EmptyState type="cart" title="Your cart is empty" description="Add items to your cart to see them here" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {cartItems.map((item) => {
          const identifier: string = (item.item_type === 'product' ? item.asin :
                            item.item_type === 'hotel' ? item.details?.hotel_id :
                            item.details?.flight_id || item.asin) || 'unknown';

          return (
            <div key={identifier} className="panel-item-card">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getItemIcon(item.item_type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-bold uppercase">
                      {getItemTypeLabel(item.item_type)}
                    </span>
                    {item.qty > 1 && item.item_type !== 'product' && (
                      <span className="inline-block px-2 py-0.5 bg-warning-100 text-warning-600 rounded text-xs font-bold">
                        ⚠️ DUPLICATE
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-200 text-sm">{item.title}</h4>
                  <div className="text-sm font-bold text-primary-400 mt-1">{formatPrice(item.price)}</div>

                  {item.item_type === 'hotel' && item.details && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                      {item.details.city_code && <span>📍 {item.details.city_code}</span>}
                      {item.details.rating && <span>⭐ {item.details.rating}</span>}
                    </div>
                  )}

                  {item.item_type === 'flight' && item.details && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                      <span>🛫 {item.details.origin} → {item.details.destination}</span>
                      {item.details.airline && <span>✈️ {item.details.airline}</span>}
                    </div>
                  )}
                </div>

                <button
                  className="w-8 h-8 flex items-center justify-center bg-neutral-700 rounded text-gray-400 hover:text-red-400 hover:bg-neutral-600 transition-colors disabled:opacity-50"
                  onClick={() => handleRemoveItem(item)}
                  disabled={removingItems.has(identifier)}
                  title="Remove from cart"
                >
                  {removingItems.has(identifier) ? (
                    <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-primary-400 rounded-full animate-spin"></div>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 6V4A2 2 0 0 1 10 2H14A2 2 0 0 1 16 4V6M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-neutral-700 pt-4 mt-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 font-medium">Total ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
          <span className="text-2xl font-bold text-primary-400">${totalPrice}</span>
        </div>
        <button
          className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          onClick={() => {
            if (onPurchaseConfirm) {
              onPurchaseConfirm(cartItems);
            }
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Confirm Purchase
        </button>
      </div>
    </div>
  );
};

export default CartView;
