'use client';

/**
 * PharosGRC — risk detail, the ONE fetch of `GET /risks/{riskId}/lifecycle`
 * (016-risk-detail-experience §4.7/§4.9, corrected 2026-09-15).
 *
 * Before this phase, `RiskLifecycleActions` fetched this itself, mounted
 * unconditionally outside any tab. 016's contextual aside ("Atenção") and
 * the "Ciclo de vida" section (`RiskLifecycleSpine`) both need the SAME
 * `RiskLifecycleState` — and the aside is visible before the user ever opens
 * a section — so the fetch is lifted here, to `RiskDetailView`'s own level,
 * and handed down by prop to whoever renders it. This keeps the page's own
 * "exactly two requests on mount" rule (§4.9) true regardless of which
 * section is open: the request happens once, at the page, never inside a
 * section's own mount.
 *
 * Behaviourally identical to what `RiskLifecycleActions` used to do on its
 * own: re-fetches when `riskId`/`etag` change (a changed `etag` means the
 * risk, and therefore its lifecycle state, may have moved), and `reload()`
 * is the same best-effort re-fetch `RiskDetailView.reloadRisk` already uses
 * for the risk itself — a transient failure here leaves the previously
 * loaded lifecycle on screen, since the mutation that triggered the reload
 * already reported its own success.
 *
 * ## Why `etag` is `string | null` here, unlike `RiskLifecycleActions`'s old `etag: string`
 *
 * `RiskDetailView` must call this hook UNCONDITIONALLY, before its own
 * loading/not-found/error early returns (rules of hooks) — unlike
 * `RiskLifecycleActions`, which only ever mounted, as a child, once `risk`/
 * `etag` were already loaded. `etag` is therefore `null` on the very first
 * render, before `GET /risks/{riskId}` itself has resolved. The effect below
 * does nothing while it is `null` — no request — and fires exactly once
 * `etag` becomes a real string, reproducing the SAME two-requests-total
 * timing the old, child-mounted component had (§4.9): were this hook to
 * fetch against a placeholder value instead and re-fetch again once the
 * real `etag` arrived, the page would fire the lifecycle request TWICE on
 * mount, which is exactly the regression §4.9 exists to forbid.
 */
import { useEffect, useState } from 'react';

import { risksApi } from '../../api';

import type { RiskLifecycleState } from '../../types';

export interface UseRiskLifecycleResult {
  lifecycle: RiskLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  /** Best-effort re-fetch — see this file's own header comment. */
  reload: () => Promise<void>;
}

export function useRiskLifecycle(riskId: string, etag: string | null): UseRiskLifecycleResult {
  const [lifecycle, setLifecycle] = useState<RiskLifecycleState | null>(null);
  const [loadError, setLoadError] = useState(false);

  // `loading` is derived from comparing the resolved request against the
  // current one, exactly like `RiskLifecycleActions` used to do (and like
  // `TreatmentActionsTable`/`TreatmentHistory` still do) — never
  // `setLoading(true)` synchronously in the effect body, which
  // `react-hooks/set-state-in-effect` flags. While `etag` is still `null`
  // (the risk itself has not loaded yet) this reads as loading too — there
  // is nothing to key a request on yet, but the caller has no lifecycle
  // state to show either.
  const requestKey = etag !== null ? `${riskId}|${etag}` : null;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = requestKey === null || resolvedRequestKey !== requestKey;

  useEffect(() => {
    if (etag === null) {
      // Nothing to fetch yet — see this file's header comment.
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
    } catch {
      // See this file's own header comment — deliberately silent.
    }
  }

  return { lifecycle, loading, loadError, reload };
}
