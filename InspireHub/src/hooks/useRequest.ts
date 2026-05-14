import { useState, useCallback, useRef, useEffect } from 'react';

interface UseRequestOptions<T> {
  /** Auto-fetch on mount */
  manual?: boolean;
  /** Initial data value */
  initialData?: T;
  /** Called on success */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (err: unknown) => void;
}

interface UseRequestReturn<T, P extends unknown[]> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  run: (...params: P) => Promise<T | undefined>;
  mutate: (newData: T | undefined) => void;
}

/**
 * Unified async request hook with loading/error management.
 *
 * Usage:
 *   const { data, loading, error, run } = useRequest(() => articleApi.getList());
 *   const { run: deleteArticle } = useRequest((id) => articleApi.delete(id), { manual: true });
 */
const useRequest = <T, P extends unknown[] = []>(
  fetcher: (...args: P) => Promise<T>,
  options: UseRequestOptions<T> = {}
): UseRequestReturn<T, P> => {
  const { manual = false, initialData, onSuccess, onError } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(!manual);
  const [error, setError] = useState<unknown>(null);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    fetcherRef.current = fetcher;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async (...params: P): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(...params);
      if (mountedRef.current) {
        setData(result);
        onSuccessRef.current?.(result);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        onErrorRef.current?.(err);
      }
      return undefined;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-fetch on mount (non-manual mode)
  useEffect(() => {
    if (!manual) {
      const fetch = async () => {
        try {
          const result = await fetcherRef.current(...([] as unknown as P));
          if (mountedRef.current) {
            setData(result);
            setLoading(false);
            onSuccessRef.current?.(result);
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err);
            setLoading(false);
            onErrorRef.current?.(err);
          }
        }
      };
      fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutate = useCallback((newData: T | undefined) => {
    setData(newData);
  }, []);

  return { data, loading, error, run, mutate };
};

export default useRequest;
