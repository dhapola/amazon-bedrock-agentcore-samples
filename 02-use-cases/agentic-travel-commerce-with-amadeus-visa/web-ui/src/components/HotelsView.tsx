import React, { useState, useEffect } from 'react';
import { getItineraryItems, deleteItineraryItem, type ItineraryItem } from '../services/itineraryService';
import { getBookings } from '../services/bookingsService';
import EmptyState from './EmptyState';

interface HotelsViewProps {
  user: any;
  messages?: any[];
  refreshTrigger?: number;
}

const HotelsView: React.FC<HotelsViewProps> = ({ user, refreshTrigger }) => {
  const [hotelItems, setHotelItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  const loadHotels = async () => {
    setLoading(true);
    try {
      const items = await getItineraryItems(user.userId);
      const bookings = await getBookings(user.userId);
      const purchasedIds = new Set(bookings.map(b => b.id));

      const hotels = items.filter(item =>
        item.type === 'hotel' && !purchasedIds.has(item.id)
      );
      setHotelItems(hotels);
    } catch (error) {
      console.error('Error loading hotels:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHotels();
  }, [user.userId, refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (removingItems.has(id)) return;

    try {
      setRemovingItems(prev => new Set(prev).add(id));
      await deleteItineraryItem(id);
      await loadHotels();
    } catch (error) {
      console.error('Error removing hotel:', error);
    } finally {
      setRemovingItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="panel-loading">
        <div className="panel-loading-spinner"></div>
      </div>
    );
  }

  if (hotelItems.length === 0) {
    return (
      <EmptyState
        type="itinerary"
        title="No hotels yet"
        description="Ask the agent to find accommodations!"
      />
    );
  }

  return (
    <div>
      <div className="panel-view-header">
        <h3 className="panel-view-title">Hotels</h3>
        <button
          className="panel-refresh-button"
          onClick={loadHotels}
          disabled={loading}
        >
          <span>{loading ? '⟳' : '↻'}</span>
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-3">
        {hotelItems.map(item => (
          <div key={item.id} className="panel-item-card">
            <div className="flex items-start gap-3">
              <div className="text-xl w-8 h-8 flex items-center justify-center bg-neutral-700 rounded-lg">
                🏨
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-200 truncate">{item.title}</div>
                {item.location && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    {item.location}
                  </div>
                )}
                {(item.details || item.description) && (
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{item.details || item.description}</p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700">
                  {item.date && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      {item.date}
                    </div>
                  )}
                  {item.price && (
                    <div className="text-sm font-semibold text-primary-400">{item.price}</div>
                  )}
                </div>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center bg-neutral-700 rounded text-gray-400 hover:text-red-400 hover:bg-neutral-600 transition-colors disabled:opacity-50"
                onClick={() => handleDelete(item.id)}
                disabled={removingItems.has(item.id)}
                title="Remove from itinerary"
              >
                {removingItems.has(item.id) ? (
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
        ))}
      </div>
    </div>
  );
};

export default HotelsView;
