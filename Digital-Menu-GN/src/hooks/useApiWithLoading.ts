import { useState, useCallback } from 'react';
import { useApi } from './useApi';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  showLoading?: boolean; // Show loading state for this request
};

/**
 * Enhanced API hook with built-in loading states
 * Provides automatic loading indicators for API calls
 */
export function useApiWithLoading() {
  const { fetchApi } = useApi();
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [globalLoading, setGlobalLoading] = useState(false);

  const fetchWithLoading = useCallback(
    async <T = unknown>(
      key: string,
      path: string,
      options: ApiOptions = {}
    ): Promise<T> => {
      const { showLoading = true, ...apiOptions } = options;

      // Set loading state
      if (showLoading) {
        setLoadingStates(prev => ({ ...prev, [key]: true }));
        setGlobalLoading(true);
      }

      try {
        const result = await fetchApi<T>(path, apiOptions);
        return result;
      } finally {
        // Clear loading state
        if (showLoading) {
          setLoadingStates(prev => ({ ...prev, [key]: false }));
          setGlobalLoading(prev => {
            // Only turn off global loading if no other requests are active
            const stillLoading = Object.values({ ...loadingStates, [key]: false }).some(Boolean);
            return stillLoading;
          });
        }
      }
    },
    [fetchApi, loadingStates]
  );

  const isLoading = useCallback((key: string) => loadingStates[key] || false, [loadingStates]);
  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return {
    fetchWithLoading,
    isLoading,
    isAnyLoading,
    globalLoading,
    loadingStates,
  };
}
