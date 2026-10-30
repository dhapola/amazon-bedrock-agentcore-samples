import React from 'react';

export interface PerformanceMetrics {
  toolsUsed: number;
  tokens: number;
  cost: number;
  latency: {
    min: number;
    max: number;
    avg: number;
  };
}

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ metrics }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  const formatLatency = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  return (
    <div className="metrics-grid">
      {/* Tools Used */}
      <div className="metric-card">
        <div className="metric-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
        <div className="metric-content">
          <div className="metric-label">Tools Used</div>
          <div className="metric-value">{formatNumber(metrics.toolsUsed)}</div>
        </div>
      </div>

      {/* Tokens */}
      <div className="metric-card">
        <div className="metric-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
        </div>
        <div className="metric-content">
          <div className="metric-label">Tokens</div>
          <div className="metric-value">{formatNumber(metrics.tokens)}</div>
        </div>
      </div>

      {/* Cost */}
      <div className="metric-card">
        <div className="metric-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <div className="metric-content">
          <div className="metric-label">Cost</div>
          <div className="metric-value">{formatCost(metrics.cost)}</div>
        </div>
      </div>

      {/* Latency */}
      <div className="metric-card">
        <div className="metric-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div className="metric-content">
          <div className="metric-label">Latency</div>
          <div className="metric-latency">
            <span>
              <div className="metric-latency-label">Min</div>
              <div className="metric-latency-value">{formatLatency(metrics.latency.min)}</div>
            </span>
            <span>
              <div className="metric-latency-label">Max</div>
              <div className="metric-latency-value">{formatLatency(metrics.latency.max)}</div>
            </span>
            <span>
              <div className="metric-latency-label">Avg</div>
              <div className="metric-latency-value">{formatLatency(metrics.latency.avg)}</div>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PerformanceMetrics);
