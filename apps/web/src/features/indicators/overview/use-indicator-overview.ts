'use client';

/**
 * PharosGRC — data-fetching hook for the Indicadores overview screen
 * (indicators-round, S2 ownership, coordinator PLAN.md §4).
 *
 * Fires exactly two requests, in parallel, on every (re)load:
 * `GET /dashboard/summary` (the batch source for all 11 current values plus
 * the `indicators` monitoring breakdown — coordinator PLAN.md §1, replacing
 * the 11 independent `/indicators/{key}/current` calls the previous catalog
 * fired) and `GET /indicators` (definitions, for threshold/description
 * text only). This mirrors `(app)/dashboard/page.tsx`'s own established
 * pattern exactly: plain `useState`/`useEffect` (no data-fetching library is
 * used anywhere in this codebase — grepped, zero `react-query`/`@tanstack`
 * usage), `Promise.allSettled` so the two independent requests fail
 * independently, and a `cancelled` flag in the effect's cleanup to discard a
 * stale in-flight response rather than aborting the underlying fetch.
 *
 * ## The two requests fail differently, on purpose
 *
 * `/dashboard/summary` failing is a hard error (`status: 'error'`) — it is
 * the ONLY source of current values; there is nothing to render without it.
 * `/indicators` (definitions) failing costs only the threshold/description
 * text (`definitionsUnavailable: true`), never the whole screen — the same
 * "the other request degrades honestly, not silently" shape
 * `(app)/dashboard/page.tsx` already established between `getDashboard`/
 * `getSummary`.
 *
 * ## Permission changes re-derive links WITHOUT refetching
 *
 * The fetch effect stores only the RAW settled results (`metrics`,
 * `breakdowns`, `definitions`, `fetchedAt`) in state — it never bakes
 * `hasPermission` into that state. `data` is a separate `useMemo` over
 * `[raw, hasPermission]`, so `buildIndicatorOverviewData` (and therefore
 * every `recordsHref`/bucket `href`) re-runs synchronously whenever
 * `hasPermission`'s identity changes (`usePermissions()`'s own `useMemo`
 * keyed on the session's `permissions` array — changes after
 * `AuthContextValue.refresh()`, e.g. `SessionExpiredDialog` re-auth with a
 * different grant), with NO new network request. An earlier version of this
 * hook read `hasPermission` through a ref inside the fetch effect itself —
 * correct for "the ref is always fresh at the moment a NEW response lands",
 * but wrong for "permissions change without a new fetch happening at all":
 * links would have stayed frozen at whatever `hasPermission` returned at
 * the last actual request, until the next `refresh()`. This shape fixes
 * that class of staleness structurally, not by reacting to a specific
 * event.
 *
 * `useAuth()`/`AuthProvider` (`lib/auth-context.tsx`) has NO loading state
 * of its own to guard against here: `(app)/layout.tsx` resolves the session
 * server-side and seeds `AuthProvider` with a fully-formed
 * `initialSession` BEFORE the client tree (and so this hook) ever mounts —
 * `permissions` is therefore never `undefined`/in-flight for a caller of
 * `usePermissions()`. There is nothing to flash.
 *
 * ## React StrictMode double-invoke (dev only)
 *
 * Like `(app)/dashboard/page.tsx` and every other `useEffect`-based fetch in
 * this codebase, this hook does NOT deduplicate/abort the underlying network
 * call when React's dev-only StrictMode double-invokes the effect (mount →
 * cleanup → mount) — it only discards the STATE UPDATE from the first,
 * superseded run via the `cancelled` flag, exactly like `IndicatorMetricCard`
 * /`IndicatorHistorySection`/`DashboardPage` already do. In dev this hook
 * therefore still issues 2 summary + 2 definitions requests (4 total) on a
 * fresh mount, never 22 (the previous per-card fan-out) — a real reduction,
 * not a full StrictMode dedupe, which no existing pattern in this codebase
 * provides either.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dashboardApi } from '@/features/dashboard/api';
import { usePermissions } from '@/lib/permissions';

import { indicatorsApi } from '../api';

import { buildIndicatorOverviewData } from './indicator-overview-model';

import type { IndicatorOverviewData } from './indicator-overview-model';
import type { IndicatorDefinition } from '../types';
import type { DashboardBreakdowns, DashboardSummaryMetric } from '@/features/dashboard/types';

/** Comfortably above the fixed 11-key catalog — at most one `IndicatorDefinition` per key (server `@unique` invariant), so 11 is the real ceiling; kept slightly above it the same way `indicator-values-clean.json`'s own capture script (`pageSize: 50`) did. */
const DEFINITIONS_PAGE_SIZE = 50;

export interface UseIndicatorOverviewResult {
  readonly status: 'loading' | 'error' | 'success';
  readonly data?: IndicatorOverviewData;
  /** `true` when `GET /indicators` (definitions) failed or was forbidden — items still render, without threshold/description text. Never turns the whole screen into an error state. */
  readonly definitionsUnavailable: boolean;
  /** `true` while a `refresh()`-triggered refetch is in flight; `data` from the PREVIOUS successful load is kept (never cleared) while this is true. */
  readonly isRefreshing: boolean;
  /** Refetches both requests. */
  readonly refresh: () => void;
}

/** The two responses' raw, permission-independent content — everything `buildIndicatorOverviewData` needs EXCEPT `hasPermission`, which is applied later, in the `useMemo` below, so it can change without a refetch. */
interface RawOverview {
  readonly metrics: readonly DashboardSummaryMetric[];
  readonly breakdowns: DashboardBreakdowns | undefined;
  readonly definitions: readonly IndicatorDefinition[];
  readonly fetchedAt: Date;
}

export function useIndicatorOverview(): UseIndicatorOverviewResult {
  const { hasPermission } = usePermissions();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [raw, setRaw] = useState<RawOverview | undefined>(undefined);
  const [definitionsUnavailable, setDefinitionsUnavailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  // Tracks whether a successful load has EVER landed, so a `refresh()` sets
  // `isRefreshing` instead of `status: 'loading'` (which would otherwise
  // replace the currently-rendered data with a loading skeleton).
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setStatus('loading');
    }

    Promise.allSettled([
      dashboardApi.getSummary(),
      indicatorsApi.listDefinitions({ page: 1, pageSize: DEFINITIONS_PAGE_SIZE }),
    ])
      .then(([summaryResult, definitionsResult]) => {
        if (cancelled) return;

        if (summaryResult.status === 'rejected') {
          setStatus('error');
          setIsRefreshing(false);
          return;
        }

        const definitionsOk = definitionsResult.status === 'fulfilled';
        setDefinitionsUnavailable(!definitionsOk);

        hasLoadedRef.current = true;
        setRaw({
          metrics: summaryResult.value.metrics,
          breakdowns: summaryResult.value.breakdowns,
          definitions: definitionsOk ? definitionsResult.value.data : [],
          fetchedAt: new Date(),
        });
        setStatus('success');
        setIsRefreshing(false);
      })
      // `Promise.allSettled` itself never rejects, but the `.then` callback
      // above (state setters) theoretically could — this `.catch` exists to
      // satisfy `no-floating-promises` and, defensively, to resolve
      // `loading`/`isRefreshing` into `error` rather than leaving the screen
      // stuck mid-request if that ever happens.
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Re-derives on EVERY `hasPermission` identity change, with NO network
  // request — see this file's own "Permission changes re-derive links
  // WITHOUT refetching" doc comment above.
  const data = useMemo<IndicatorOverviewData | undefined>(() => {
    if (!raw) return undefined;
    return buildIndicatorOverviewData({
      metrics: raw.metrics,
      breakdowns: raw.breakdowns,
      definitions: raw.definitions,
      hasPermission,
      fetchedAt: raw.fetchedAt,
    });
  }, [raw, hasPermission]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { status, data, definitionsUnavailable, isRefreshing, refresh };
}
