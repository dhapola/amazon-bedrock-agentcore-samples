import React, { useState, useEffect, useRef } from 'react';
import { type Session, deleteSession } from '../services/bedrockSessionService';

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onSessionsDeleted: (deletedIds: string[]) => void;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onSessionsDeleted,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset selection when panel opens/closes
  useEffect(() => {
    if (!isOpen) setSelectedIds(new Set());
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const deletedList = Array.from(selectedIds);
      for (const id of deletedList) {
        await deleteSession(id);
      }
      setSelectedIds(new Set());
      onSessionsDeleted(deletedList);
    } catch (err) {
      console.error('Error deleting sessions:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMins / 60;
    const diffDays = diffHours / 24;

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${Math.floor(diffMins)}m ago`;
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString();
  };

  const nonTempSessions = sessions.filter(s => !s.isTemporary);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: '260px',
        top: 0,
        width: '320px',
        height: '100vh',
        background: '#1e2235',
        borderRight: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInFromLeft 200ms ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ color: '#E5E7EB', fontSize: '16px', fontWeight: 600 }}>Chat History</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9CA3AF',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#E5E7EB'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Delete bar */}
      {selectedIds.size > 0 && (
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(239, 68, 68, 0.08)',
        }}>
          <span style={{ color: '#FCA5A5', fontSize: '13px' }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '6px',
              color: '#FCA5A5',
              fontSize: '12px',
              fontWeight: 500,
              padding: '6px 12px',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (!deleting) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                e.currentTarget.style.color = '#FFFFFF';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#FCA5A5';
            }}
          >
            {deleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </button>
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {nonTempSessions.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6B7280',
            fontSize: '14px',
          }}>
            No conversation history yet
          </div>
        ) : (
          nonTempSessions.map((session) => {
            const isSelected = selectedIds.has(session.id);
            const isCurrent = session.id === currentSessionId;

            return (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  marginBottom: '4px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isCurrent
                    ? 'rgba(139, 92, 246, 0.15)'
                    : isSelected
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'transparent',
                  border: `1px solid ${
                    isCurrent
                      ? 'rgba(139, 92, 246, 0.4)'
                      : isSelected
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'transparent'
                  }`,
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent && !isSelected) {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent && !isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => toggleSelect(session.id, e)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: `2px solid ${isSelected ? '#8B5CF6' : 'rgba(156, 163, 175, 0.4)'}`,
                    background: isSelected ? '#8B5CF6' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 150ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                {/* Session info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isCurrent ? '#A78BFA' : '#E5E7EB',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {session.title || 'Untitled'}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#6B7280',
                    marginTop: '2px',
                  }}>
                    {formatTime(session.updatedAt || session.createdAt)}
                  </div>
                </div>

                {isCurrent && (
                  <div style={{
                    fontSize: '10px',
                    color: '#A78BFA',
                    background: 'rgba(139, 92, 246, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    Active
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatHistoryPanel;
