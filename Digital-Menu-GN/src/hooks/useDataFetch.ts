import { useState, useEffect, useCallback } from 'react';
import { useApiWithLoading } from './useApiWithLoading';
import { useToast } from './use-toast';

interface UseDataFetchOptions<T> {
  immediate?: boolean; // Fetch immediately on mount
  showErrorToast?: boolean; // Show error toast automatically
  loadingText?: string; // Custom loading text
  onSuccess?: (data: T) => void; // Success callback
  onError?: (error: Error) => void; // Error callback
}

/**
 * Custom hook for data fetching with loading states and error handling
 * Solves the issue of data not showing on first visit and missing loading indicators
 */
export function useDataFetch<T = unknown>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseDataFetchOptions<T> = {}
) {
  const {
    immediate = true,
    showErrorToast = true,
    loadingText = 'Loading...',
    onSuccess,
    onError,
  } = options;

  const { fetchWithLoading, isLoading } = useApiWithLoading();
  const { toast } = useToast();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const execute = useCallback(async () => {
    try {
      setError(null);
      // Drive the loading state via the shared loading registry.
      // We don't use `useApi` here because `fetcher()` can be any async function.
      await fetchWithLoading(key, '__local__', { showLoading: true });
      const data = await fetcher();
      setData(data);
      setHasLoadedOnce(true);
      onSuccess?.(data);
      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setHasLoadedOnce(true);
      onError?.(error);
      
      if (showErrorToast) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load data',
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [key, fetchWithLoading, fetcher, showErrorToast, toast, onSuccess, onError]);

  // Auto-fetch on mount
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Refetch function
  const refetch = useCallback(() => {
    return execute();
  }, [execute]);

  return {
    data,
    error,
    isLoading: isLoading(key),
    hasLoadedOnce,
    refetch,
    execute,
  };
}

/**
 * Hook for paginated data fetching
 */
export function usePaginatedDataFetch<T = unknown>(
  key: string,
  fetcher: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: UseDataFetchOptions<{ data: T[]; total: number }> = {}
) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  const {
    data,
    error,
    isLoading,
    hasLoadedOnce,
    refetch,
  } = useDataFetch(
    `${key}_page_${page}`,
    () => fetcher(page, limit),
    options
  );

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((targetPage: number) => {
    setPage(Math.max(1, targetPage));
  }, []);

  return {
    data: data?.data || [],
    total: data?.total || 0,
    currentPage: page,
    totalPages: Math.ceil((data?.total || 0) / limit),
    isLoading,
    error,
    hasLoadedOnce,
    nextPage,
    prevPage,
    goToPage,
    refetch,
  };
}
