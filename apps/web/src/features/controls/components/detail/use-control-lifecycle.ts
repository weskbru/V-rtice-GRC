'use client';

/**
 * PharosGRC — control detail, the ONE fetch of
 * `GET /controls/{controlId}/lifecycle` (021-control-detail-experience,
 * Fase B). Mirrors `features/risks/components/detail/use-risk-lifecycle.ts`
 * exactly — see that file's own header for the "why the fetch is lifted to
 * the page, not left inside the actions component" reasoning this one does
 * not repeat.
 *
 * Before this phase, `ControlLifecycleActions` fetched this itself, mounted
 * unconditionally above the tabs. Fase B's "Ciclo de vida" card
 * (`ControlLifecycleSection`) needs the SAME `ControlLifecycleState` to build
 * its track visual (`buildControlLifecycleTrack`'s own `available` state is
 * read directly off `lifecycle.availableTransitions`) — so the fetch moves
 * here, to `ControlDetailView`'s own level, and is handed down by prop. This
 * keeps the request to exactly ONE per mount regardless of which tab is
 * open, and lets `ControlLifecycleActions` become a plain, presentational
 * button row with no fetch of its own (the coordinator's own instruction for
 * this phase: it "perde a casca de Card e vira a linha de ações dentro do
 * cartão").
 *
 * `etag` is `string | null`, exactly like `useRiskLifecycle`'s own: this hook
 * must be called UNCONDITIONALLY, before `ControlDetailView`'s own loading/
 * not-found/error early returns (rules of hooks), and `etag` is `null` until
 * `GET /controls/{controlId}` itself has resolved. The effect below fires no
 * request while it is `null`.
 */
import { useEffect, useState } from 'react';

import { controlsApi } from '../../api';

import type { ControlLifecycleState } from '../../types';

export interface UseControlLifecycleResult {
  lifecycle: ControlLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  /** Best-effort re-fetch, mirroring `useRiskLifecycle`'s own `reload` — deliberately silent on failure. */
  reload: () => Promise<void>;
}

export function useControlLifecycle(
  controlId: string,
  etag: string | null,
): UseControlLifecycleResult {
  const [lifecycle, setLifecycle] = useState<ControlLifecycleState | null>(null);
  const [loadError, setLoadError] = useState(false);

  // `loading` is derived from comparing the resolved request against the
  // current one — never `setLoading(true)` synchronously in the effect body
  // (`react-hooks/set-state-in-effect`). While `etag` is still `null` (the
  // control itself has not loaded yet) this reads as loading too.
  const requestKey = etag !== null ? `${controlId}|${etag}` : null;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = requestKey === null || resolvedRequestKey !== requestKey;

  useEffect(() => {
    if (etag === null) {
      // Nothing to fetch yet — see this file's header comment.
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
    } catch {
      // See this file's own header comment — deliberately silent.
    }
  }

  return { lifecycle, loading, loadError, reload };
}
