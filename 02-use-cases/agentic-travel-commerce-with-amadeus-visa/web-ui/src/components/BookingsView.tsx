import React, { useState, useEffect } from 'react';
import { getBookings, type BookingItem } from '../services/bookingsService';
import EmptyState from './EmptyState';

interface BookingsViewProps {
  user: any;
  refreshTrigger?: number;
}

const getIcon = (type: string): string => {
  const icons: Record<string, string> = {
    flight: '✈️',
    hotel: '🏨',
    activity: '🎭',
    restaurant: '🍽️',
    transport: '🚗'
  };
  return icons[type] || '📍';
};

const BookingsView: React.FC<BookingsViewProps> = ({ user, refreshTrigger }) => {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const items = await getBookings(user.userId);
      setBookings(items);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [user.userId, refreshTrigger]);

  if (loading) {
    return (
      <div className="panel-loading">
        <div className="panel-loading-spinner"></div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        type="bookings"
        title="No bookings yet"
        description="Complete a purchase to see your bookings here!"
      />
    );
  }

  return (
    <div>
      <div className="panel-view-header">
        <h3 className="panel-view-title">Your Bookings</h3>
        <button
          className="panel-refresh-button"
          onClick={loadBookings}
          disabled={loading}
        >
          <span>{loading ? '⟳' : '↻'}</span>
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="panel-item-card">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{getIcon(booking.item_type)}</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-200">{booking.title}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {booking.item_type === 'flight' && booking.origin && booking.destination && (
                    <span>{booking.origin} → {booking.destination}</span>
                  )}
                  {booking.item_type === 'hotel' && booking.city_code && (
                    <span>{booking.city_code}</span>
                  )}
                  {booking.departure_date && <span> • {booking.departure_date}</span>}
                </div>
                {booking.purchase_date && (
                  <div className="text-xs text-gray-500 mt-1">
                    Purchased: {new Date(booking.purchase_date).toLocaleDateString()}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-700">
                  <span className="text-sm font-semibold text-primary-400">{booking.price}</span>
                  <span className="text-xs text-gray-500">Order: {booking.order_id}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookingsView;
