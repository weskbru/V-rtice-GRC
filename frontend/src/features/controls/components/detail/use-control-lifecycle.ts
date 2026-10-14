'use client';

import { useEffect, useState } from 'react';

import { controlsApi } from '../../api';

import type { ControlLifecycleState } from '../../types';

export interface UseControlLifecycleResult {
  lifecycle: ControlLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  reload: () => Promise<void>;
}

export function useControlLifecycle(
  controlId: string,
  etag: string | null,
): UseControlLifecycleResult {
  const [lifecycle, setLifecycle] = useState<ControlLifecycleState | null>(null);
  const [loadError, setLoadError] = useState(false);

  const requestKey = etag !== null ? `${controlId}|${etag}` : null;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = requestKey === null || resolvedRequestKey !== requestKey;

  useEffect(() => {
    if (etag === null) {
      return;
    }
    let cancelled = false;
    controlsApi
      .getLifecycle(controlId)
      .then((state) => {
        if (cancelled) return;
        setLifecycle(state);
        setLoadError(false);
        setResolvedRequestKey(`${controlId}|${etag}`);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setResolvedRequestKey(`${controlId}|${etag}`);
      });
    return () => {
      cancelled = true;
    };
  }, [controlId, etag]);

  async function reload(): Promise<void> {
    try {
      const state = await controlsApi.getLifecycle(controlId);
      setLifecycle(state);
      setLoadError(false);
    } catch {}
  }

  return { lifecycle, loading, loadError, reload };
}
