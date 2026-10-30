import { useState, useEffect } from 'react';
import { getAgentMetrics } from '../services/metricsService';
import { PerformanceMetrics } from '../components/PerformanceMetrics';

interface UsePerformanceMetricsResult {
  metrics: PerformanceMetrics;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom React hook for fetching and managing performance metrics
 *
 * @param userId - User ID for filtering metrics
 * @param sessionId - Optional session ID for filtering metrics
 * @param refreshInterval - Auto-refresh interval in milliseconds (default: 30000ms = 30s)
 * @returns Metrics data, loading state, error state, and refresh function
 */
export function usePerformanceMetrics(
  userId: string,
  sessionId?: string,
  refreshInterval: number = 30000
): UsePerformanceMetricsResult {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    toolsUsed: 0,
    tokens: 0,
    cost: 0,
    latency: {
      min: 0,
      max: 0,
      avg: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAgentMetrics(userId, sessionId);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMetrics();
  }, [userId, sessionId]);

  // Auto-refresh on interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      fetchMetrics();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [userId, sessionId, refreshInterval]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics
  };
}

export default usePerformanceMetrics;
