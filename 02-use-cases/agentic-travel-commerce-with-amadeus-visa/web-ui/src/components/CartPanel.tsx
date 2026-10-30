import { useState, useEffect } from 'react'
import { getCartItems, removeCartItems, type CartItem } from '../services/cartService'
import EmptyState from './EmptyState'

interface User {
  username: string
  email?: string
  userId: string
}

interface CartPanelProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onCartUpdate?: () => void
  onPurchaseConfirm?: (cartItems: CartItem[]) => void
  refreshTrigger?: number // Add refresh trigger for manual refresh
}

const CartPanel = ({ user, isOpen, onClose, onCartUpdate, onPurchaseConfirm, refreshTrigger }: CartPanelProps) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())

  // Load cart items when panel opens
  const loadCartItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const items = await getCartItems(user.userId)
      setCartItems(items)
    } catch (err) {
      console.error('Error loading cart items:', err)
      setError('Failed to load cart items')
    } finally {
      setLoading(false)
    }
  }

  // Remove item from cart
  const handleRemoveItem = async (item: CartItem) => {
    const identifier = item.item_type === 'product' ? item.asin :
                      item.item_type === 'hotel' ? item.details?.hotel_id :
                      item.details?.flight_id || item.asin || 'unknown'

    if (!identifier || removingItems.has(identifier)) return

    try {
      setRemovingItems(prev => new Set(prev).add(identifier))

      // Create proper object based on item type for removeCartItems signature
      const identifiers: { asins?: string[], flight_ids?: string[], hotel_ids?: string[] } = {}
      if (item.item_type === 'flight' && item.details?.flight_id) {
        identifiers.flight_ids = [item.details.flight_id]
      } else if (item.item_type === 'hotel' && item.details?.hotel_id) {
        identifiers.hotel_ids = [item.details.hotel_id]
      } else if (item.asin) {
        identifiers.asins = [item.asin]
      }

      await removeCartItems(user.userId, identifiers)
      
      // Remove item from local state
      setCartItems(prev => prev.filter(i => {
        if (i.item_type === 'product') return i.asin !== identifier
        if (i.item_type === 'hotel') return i.details?.hotel_id !== identifier
        if (i.item_type === 'flight') return i.details?.flight_id !== identifier
        return true
      }))
      
      // Notify parent to update cart count
      if (onCartUpdate) {
        onCartUpdate()
      }
    } catch (err) {
      console.error('Error removing item:', err)
      setError('Failed to remove item')
    } finally {
      setRemovingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(identifier)
        return newSet
      })
    }
  }

  // Get item icon based on type
  const getItemIcon = (itemType?: string) => {
    switch (itemType) {
      case 'hotel':
        return '🏨'
      case 'flight':
        return '✈️'
      default:
        return '📦'
    }
  }

  // Get item type label
  const getItemTypeLabel = (itemType?: string) => {
    switch (itemType) {
      case 'hotel':
        return 'Hotel'
      case 'flight':
        return 'Flight'
      default:
        return 'Product'
    }
  }

  // Format price for display
  const formatPrice = (price: string) => {
    if (price.includes('$')) return price
    return `$${price}`
  }

  // Format reviews for display
  const formatReviews = (reviews?: string) => {
    if (!reviews || reviews === '') return 'No reviews'
    return `${reviews} ⭐`
  }

  // Load cart items when panel opens
  useEffect(() => {
    if (isOpen) {
      loadCartItems()
    }
  }, [isOpen, user.userId])

  // Refresh when refreshTrigger changes (triggered after purchase)
  useEffect(() => {
    if (refreshTrigger) {
      console.log('🔄 CartPanel: Refreshing cart after purchase')
      loadCartItems()
    }
  }, [refreshTrigger])

  // Auto-refresh cart while panel is open (poll every 3 seconds)
  useEffect(() => {
    if (!isOpen) return

    console.log('🔄 CartPanel: Starting auto-refresh polling (every 3 seconds)')
    const intervalId = setInterval(() => {
      console.log('🔄 CartPanel: Auto-refreshing cart...')
      loadCartItems()
    }, 3000) // Refresh every 3 seconds

    return () => {
      console.log('🔄 CartPanel: Stopping auto-refresh polling')
      clearInterval(intervalId)
    }
  }, [isOpen])

  // Calculate total items
  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className={`modern-cart-panel ${isOpen ? 'open' : ''}`}>
      <div className="modern-cart-header">
        <div className="modern-cart-title">
          <span>🛒</span>
          <span>Travel Cart</span>
          {totalItems > 0 && (
            <span style={{
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button className="modern-cart-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

        <div className="modern-cart-items modern-scroll-smooth">
          {loading ? (
            <div className="modern-loading">
              <div className="modern-spinner"></div>
            </div>
          ) : error ? (
            <div className="modern-cart-empty">
              <div className="modern-cart-empty-icon">⚠️</div>
              <div className="modern-cart-empty-title">{error}</div>
              <button className="modern-btn modern-btn-primary" onClick={loadCartItems}>
                Retry
              </button>
            </div>
          ) : cartItems.length === 0 ? (
            <EmptyState type="cart" />
          ) : (
            <>
              {cartItems.map((item) => {
                const identifier: string = (item.item_type === 'product' ? item.asin :
                                  item.item_type === 'hotel' ? item.details?.hotel_id :
                                  item.details?.flight_id || item.asin) || 'unknown'

                return (
                  <div key={identifier} className="modern-cart-item modern-hover-lift">
                    <div className="modern-cart-item-icon">{getItemIcon(item.item_type)}</div>
                    <div className="modern-cart-item-details">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.125rem 0.5rem',
                          background: 'var(--primary-100)',
                          color: 'var(--primary-700)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.625rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {getItemTypeLabel(item.item_type)}
                        </span>
                        {item.qty > 1 && item.item_type !== 'product' && (
                          <span style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            background: 'var(--warning-100)',
                            color: 'var(--warning-600)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.625rem',
                            fontWeight: '700'
                          }}>
                            ⚠️ DUPLICATE
                          </span>
                        )}
                      </div>
                      <h4 className="modern-cart-item-title">{item.title}</h4>
                      <div className="modern-cart-item-price">{formatPrice(item.price)}</div>

                      {item.item_type === 'hotel' && item.details && (
                        <div className="modern-cart-item-meta">
                          {item.details.city_code && <span>📍 {item.details.city_code}</span>}
                          {item.details.rating && <span>⭐ {item.details.rating}</span>}
                        </div>
                      )}

                      {item.item_type === 'flight' && item.details && (
                        <div className="modern-cart-item-meta">
                          <span>🛫 {item.details.origin} → {item.details.destination}</span>
                          {item.details.airline && <span>✈️ {item.details.airline}</span>}
                        </div>
                      )}
                    </div>

                    <button
                      className="modern-cart-item-remove"
                      onClick={() => handleRemoveItem(item)}
                      disabled={removingItems.has(identifier)}
                      title="Remove from cart"
                    >
                      {removingItems.has(identifier) ? (
                        <div className="modern-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 6V4A2 2 0 0 1 10 2H14A2 2 0 0 1 16 4V6M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </>
          )}

        </div>

        {!loading && !error && cartItems.length > 0 && (
          <div className="modern-cart-footer">
            <div className="modern-cart-total">
              <span className="modern-cart-total-label">Total</span>
              <span className="modern-cart-total-amount">
                ${cartItems.reduce((sum, item) => sum + parseFloat(item.price.replace('$', '').replace(',', '')), 0).toFixed(2)}
              </span>
            </div>
            <button
              className="modern-cart-checkout-btn"
              onClick={() => {
                if (onPurchaseConfirm) {
                  onPurchaseConfirm(cartItems)
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Confirm Purchase
            </button>
          </div>
        )}
    </div>
  )
}

export default CartPanel
