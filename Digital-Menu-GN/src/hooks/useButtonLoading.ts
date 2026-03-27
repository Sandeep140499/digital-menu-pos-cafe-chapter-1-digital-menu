import { useState, useCallback } from 'react';

/**
 * Simple hook for button loading states
 * Provides loading state and async handler wrapper
 */
export function useButtonLoading<T extends any[] = []>(
  asyncHandler: (...args: T) => Promise<any>
) {
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (...args: T) => {
      setLoading(true);
      try {
        const result = await asyncHandler(...args);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [asyncHandler]
  );

  return { loading, execute };
}
