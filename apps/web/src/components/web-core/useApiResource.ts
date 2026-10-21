'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiResource<T> {
  data: T | null;
  error: unknown;
  status: ResourceStatus;
  /** Re-runs the loader (keeps showing the previous data meanwhile). */
  reload: () => void;
  /** Local updates after mutations (optimistic UI). */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Loads one resource. `key` identifies it: a new key reloads, `null` waits (e.g. until the auth
 * state is known). Late responses for an old key are ignored.
 */
export function useApiResource<T>(key: string | null, load: () => Promise<T>): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<ResourceStatus>('idle');
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, status, reload, setData };
}
