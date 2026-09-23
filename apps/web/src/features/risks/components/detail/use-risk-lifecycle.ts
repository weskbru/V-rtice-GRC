'use client';

import { useEffect, useState } from 'react';

import { risksApi } from '../../api';

import type { RiskLifecycleState } from '../../types';

export interface UseRiskLifecycleResult {
  lifecycle: RiskLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  reload: () => Promise<void>;
}

export function useRiskLifecycle(riskId: string, etag: string | null): UseRiskLifecycleResult {
  const [lifecycle, setLifecycle] = useState<RiskLifecycleState | null>(null);
  const [loadError, setLoadError] = useState(false);

  const requestKey = etag !== null ? `${riskId}|${etag}` : null;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = requestKey === null || resolvedRequestKey !== requestKey;

  useEffect(() => {
    if (etag === null) {
      return;
    }
    let cancelled = false;
    risksApi
      .getLifecycle(riskId)
      .then((state) => {
        if (cancelled) return;
        setLifecycle(state);
        setLoadError(false);
        setResolvedRequestKey(`${riskId}|${etag}`);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setResolvedRequestKey(`${riskId}|${etag}`);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId, etag]);

  async function reload(): Promise<void> {
    try {
      const state = await risksApi.getLifecycle(riskId);
      setLifecycle(state);
      setLoadError(false);
    } catch {}
  }

  return { lifecycle, loading, loadError, reload };
}
