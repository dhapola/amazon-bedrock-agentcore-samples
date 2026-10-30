import React, { useState, useEffect } from 'react';
import { getItineraryItems, type ItineraryItem } from '../services/itineraryService';
import EmptyState from './EmptyState';

interface MapViewProps {
  user: any;
  messages?: any[];
  refreshTrigger?: number;
}

const MapView: React.FC<MapViewProps> = ({ user, refreshTrigger }) => {
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadItinerary = async () => {
    setLoading(true);
    try {
      const items = await getItineraryItems(user.userId);
      setItineraryItems(items);

      // Extract unique locations
      const locations = items
        .filter(item => item.location)
        .map(item => item.location as string)
        .filter((loc, idx, arr) => arr.indexOf(loc) === idx);
      setSelectedLocations(locations);
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItinerary();
  }, [user.userId, refreshTrigger]);

  if (loading) {
    return (
      <div className="panel-loading">
        <div className="panel-loading-spinner"></div>
      </div>
    );
  }

  if (itineraryItems.length === 0) {
    return (
      <EmptyState
        type="search"
        title="No locations yet"
        description="Add items to your itinerary to see them on the map"
      />
    );
  }

  const getMapUrl = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // Multiple locations - use directions mode with waypoints
    if (selectedLocations.length > 1) {
      const origin = encodeURIComponent(selectedLocations[0]);
      const destination = encodeURIComponent(selectedLocations[selectedLocations.length - 1]);
      const waypoints = selectedLocations.slice(1, -1).map(loc => encodeURIComponent(loc)).join('|');
      return waypoints
        ? `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&waypoints=${waypoints}&mode=walking`
        : `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=walking`;
    }

    // Single location
    const location = selectedLocations[0] || itineraryItems[0]?.location || 'World';
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(location)}`;
  };

  return (
    <div>
      <div className="panel-view-header">
        <h3 className="panel-view-title">Map</h3>
        {selectedLocations.length > 1 && (
          <span className="text-xs text-gray-500">
            {selectedLocations.length} locations
          </span>
        )}
      </div>

      <div className="rounded-lg overflow-hidden border border-neutral-700 mb-4">
        <iframe
          width="100%"
          height="400"
          style={{ border: 0 }}
          loading="lazy"
          src={getMapUrl()}
          title="Itinerary Map"
        />
      </div>

      {selectedLocations.length > 0 && (
        <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-500/30">
          <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-3">
            Locations:
          </div>
          <div className="space-y-2">
            {selectedLocations.map((loc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-purple-200">
                <span className="font-semibold text-purple-400">{idx + 1}.</span>
                <span>{loc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
