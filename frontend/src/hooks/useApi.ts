import { useState, useCallback } from 'react';
import { handleApiError } from '../services/api';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export function useApi<T, P = void>(
  apiFunc: (params: P) => Promise<{ data: T }>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const execute = useCallback(
    async (params: P) => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await apiFunc(params);
        setData(response.data);
        options.onSuccess?.(response.data);
        return response.data;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunc, options]
  );
  
  return { data, loading, error, execute, setData };
}

export function useApiQuery<T>(
  apiFunc: () => Promise<{ data: T }>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiFunc();
      setData(response.data);
      options.onSuccess?.(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      options.onError?.(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunc, options]);
  
  return { data, loading, error, fetch, setData };
}
