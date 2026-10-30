import React, { useState } from 'react';
import PerformanceMetrics from './PerformanceMetrics';
import ChatHistoryPanel from './ChatHistoryPanel';
import { type Session } from '../services/bedrockSessionService';
// CSS import removed - using inline styles only

interface User {
  username: string;
  email?: string;
  userId: string;
}

interface PerformanceMetricsType {
  toolsUsed: number;
  tokens: number;
  cost: number;
  latency: {
    min: number;
    max: number;
    avg: number;
  };
}

interface LeftNavBarProps {
  user: User;
  activeView: 'cart' | 'flights' | 'hotels' | 'map' | 'bookings' | null;
  onNavigate: (view: 'cart' | 'flights' | 'hotels' | 'map' | 'bookings') => void;
  onSignOut: () => void;
  onShowProfile: () => void;
  performanceMetrics: PerformanceMetricsType;
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onSessionsDeleted: (deletedIds: string[]) => void;
}

const LeftNavBar: React.FC<LeftNavBarProps> = ({
  user,
  activeView,
  onNavigate,
  onSignOut,
  onShowProfile,
  performanceMetrics,
  sessions,
  currentSessionId,
  onSelectSession,
  onSessionsDeleted
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const getInitial = (name: string): string => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const functionalButtons = [
    { id: 'cart' as const, icon: '🛒', label: 'View Cart' },
    { id: 'flights' as const, icon: '✈️', label: 'Flights' },
    { id: 'hotels' as const, icon: '🏨', label: 'Hotels' },
    { id: 'map' as const, icon: '🗺️', label: 'Map' },
    { id: 'bookings' as const, icon: '📅', label: 'Bookings' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '260px',
        height: '100vh',
        background: '#1a1d2e',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '4px 0 24px rgba(139, 92, 246, 0.1)',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      {/* App Title */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        background: 'rgba(139, 92, 246, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '20px',
          fontWeight: 600
        }}>
          <div style={{ fontSize: '24px' }}>✈️</div>
          <div style={{
            color: '#A78BFA',
            fontSize: '18px',
            fontWeight: 700
          }}>
            Agentic Commerce
          </div>
        </div>
      </div>

      {/* Functional Buttons */}
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)'
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#9CA3AF',
          padding: '0 8px 12px'
        }}>
          ACTIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
          {functionalButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => onNavigate(button.id)}
              title={button.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                padding: '10px',
                background: activeView === button.id
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(167, 139, 250, 0.15) 100%)'
                  : 'rgba(139, 92, 246, 0.05)',
                border: `1px solid ${activeView === button.id ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.15)'}`,
                borderRadius: '10px',
                color: '#E5E7EB',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: activeView === button.id ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                if (activeView !== button.id) {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)';
                }
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {button.icon}
            </button>
          ))}
          {/* Chat History Button */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="Chat History"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              padding: '10px',
              background: isHistoryOpen
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(167, 139, 250, 0.15) 100%)'
                : 'rgba(139, 92, 246, 0.05)',
              border: `1px solid ${isHistoryOpen ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.15)'}`,
              borderRadius: '10px',
              color: '#E5E7EB',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: isHistoryOpen ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (!isHistoryOpen) {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)';
              }
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        flex: 1
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#9CA3AF',
          padding: '0 8px 12px'
        }}>
          PERFORMANCE
        </div>
        <PerformanceMetrics metrics={performanceMetrics} />
      </div>

      {/* User Profile */}
      <div style={{
        padding: '16px 12px',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        marginTop: 'auto',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        {/* Main Profile Button */}
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            width: '100%',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 200ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 600,
            color: '#ffffff',
            flexShrink: 0
          }}>
            {getInitial(user.username || user.email || 'User')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#E5E7EB',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left'
            }}>
              {user.email || user.username}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 200ms ease',
              transform: isProfileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Expandable Menu */}
        {isProfileMenuOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '8px',
            animation: 'slideDown 200ms ease'
          }}>
            <button
              onClick={() => {
                onShowProfile();
                setIsProfileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.color = '#E5E7EB';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Profile</span>
            </button>

            <button
              onClick={() => {
                onSignOut();
                setIsProfileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#FCA5A5',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.color = '#FCA5A5';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Chat History Panel */}
      <ChatHistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onSessionsDeleted={onSessionsDeleted}
      />
    </div>
  );
};

export default LeftNavBar;
