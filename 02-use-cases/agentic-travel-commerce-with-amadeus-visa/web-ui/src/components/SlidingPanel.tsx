import React, { useEffect } from 'react';
import '../styles/sliding-panel.css';

interface SlidingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  showOverlay?: boolean;
}

const SlidingPanel: React.FC<SlidingPanelProps> = ({
  isOpen,
  onClose,
  title,
  titleIcon,
  children,
  showOverlay = false
}) => {
  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Optional overlay */}
      {showOverlay && (
        <div
          className={`sliding-panel-overlay ${isOpen ? 'visible' : ''}`}
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <div className={`sliding-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sliding-panel-header">
          <div className="sliding-panel-title">
            {titleIcon && <span className="sliding-panel-title-icon">{titleIcon}</span>}
            <span>{title}</span>
          </div>
          <button
            className="sliding-panel-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="sliding-panel-content">
          {children}
        </div>
      </div>
    </>
  );
};

export default SlidingPanel;
