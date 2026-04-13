import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * useAsync — universal hook for API requests.
 *
 * @param {string} url            - API endpoint
 * @param {object} options        - { enabled, deps, transform, initialData }
 * @returns {{ data, loading, error, refetch }}
 *
 * Examples:
 *   const { data, loading } = useAsync('/api/sessions?status=active');
 *   const { data, refetch } = useAsync('/api/users', { deps: [filter] });
 *   const { data } = useAsync('/api/stats', { transform: r => r.stats });
 */
export default function useAsync(url, options = {}) {
  const {
    enabled = true,
    deps = [],
    transform = null,
    initialData = null,
  } = options;

  const { api } = useAuth();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      if (!mountedRef.current) return;
      const result = transform ? transform(res) : res.data ?? res;
      setData(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
      console.error(`[useAsync] ${url}:`, err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
