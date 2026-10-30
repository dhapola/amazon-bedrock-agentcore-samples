import React from 'react';

interface EmptyStateProps {
  type: 'cart' | 'chat' | 'itinerary' | 'bookings' | 'search';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, title, description, action }) => {
  const getIllustration = () => {
    switch (type) {
      case 'cart':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" fill="var(--primary-50)" />
            <path
              d="M35 40L42 70H78L85 40H35Z"
              stroke="var(--primary-600)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="50" cy="80" r="4" fill="var(--primary-600)" />
            <circle cx="70" cy="80" r="4" fill="var(--primary-600)" />
            <path
              d="M30 35H38L40 40"
              stroke="var(--primary-600)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M55 50L58 55L65 48"
              stroke="var(--accent-600)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />
          </svg>
        );

      case 'chat':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" fill="var(--primary-50)" />
            <rect x="35" y="35" width="50" height="40" rx="8" stroke="var(--primary-600)" strokeWidth="3" fill="none" />
            <circle cx="60" cy="50" r="8" fill="var(--primary-600)" />
            <path d="M50 62Q55 58 60 62T70 62" stroke="var(--primary-600)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path
              d="M60 75L55 85H65L60 75Z"
              fill="var(--primary-600)"
            />
          </svg>
        );

      case 'itinerary':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" fill="var(--primary-50)" />
            <path
              d="M70 35L50 45L30 35L50 25L70 35Z"
              fill="var(--primary-600)"
            />
            <path
              d="M30 40V65L50 75L70 65V40"
              stroke="var(--primary-600)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M50 45V75" stroke="var(--primary-400)" strokeWidth="2" />
            <circle cx="75" cy="75" r="8" fill="var(--accent-600)" />
            <path d="M72 75L74 77L78 72" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'bookings':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" fill="var(--primary-50)" />
            <rect x="35" y="40" width="50" height="45" rx="4" stroke="var(--primary-600)" strokeWidth="3" fill="none" />
            <line x1="45" y1="35" x2="45" y2="45" stroke="var(--primary-600)" strokeWidth="3" strokeLinecap="round" />
            <line x1="75" y1="35" x2="75" y2="45" stroke="var(--primary-600)" strokeWidth="3" strokeLinecap="round" />
            <line x1="42" y1="52" x2="78" y2="52" stroke="var(--primary-300)" strokeWidth="2" />
            <circle cx="48" cy="60" r="3" fill="var(--primary-600)" />
            <circle cx="60" cy="60" r="3" fill="var(--primary-600)" />
            <circle cx="72" cy="60" r="3" fill="var(--primary-600)" />
            <circle cx="48" cy="70" r="3" fill="var(--primary-400)" />
            <circle cx="60" cy="70" r="3" fill="var(--primary-400)" />
          </svg>
        );

      case 'search':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" fill="var(--primary-50)" />
            <circle cx="55" cy="55" r="18" stroke="var(--primary-600)" strokeWidth="3" fill="none" />
            <path d="M68 68L80 80" stroke="var(--primary-600)" strokeWidth="4" strokeLinecap="round" />
            <path
              d="M50 48L52 50L58 44"
              stroke="var(--accent-600)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  const getDefaultContent = () => {
    switch (type) {
      case 'cart':
        return {
          title: 'Your cart is empty',
          description: 'Add flights, hotels, or activities to get started with your travel plans.'
        };
      case 'chat':
        return {
          title: 'Start a conversation',
          description: 'Ask me about destinations, book flights, or plan your perfect trip!'
        };
      case 'itinerary':
        return {
          title: 'No itinerary yet',
          description: 'Start planning your trip by searching for destinations and activities.'
        };
      case 'bookings':
        return {
          title: 'No bookings yet',
          description: 'Your confirmed bookings will appear here once you complete a purchase.'
        };
      case 'search':
        return {
          title: 'No results found',
          description: 'Try adjusting your search criteria or browse our popular destinations.'
        };
      default:
        return { title: '', description: '' };
    }
  };

  const content = {
    title: title || getDefaultContent().title,
    description: description || getDefaultContent().description
  };

  return (
    <div className="modern-cart-empty modern-fade-in" style={{ padding: 'var(--space-3xl)' }}>
      <div className="modern-cart-empty-icon modern-scale-in">
        {getIllustration()}
      </div>
      <div className="modern-cart-empty-title modern-slide-up">
        {content.title}
      </div>
      <div className="modern-cart-empty-text modern-slide-up" style={{ animationDelay: '0.1s' }}>
        {content.description}
      </div>
      {action && (
        <button
          className="modern-btn modern-btn-primary modern-slide-up"
          onClick={action.onClick}
          style={{ marginTop: 'var(--space-lg)', animationDelay: '0.2s' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
