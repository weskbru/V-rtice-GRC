'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dashboardApi } from '@/features/dashboard/api';
import { usePermissions } from '@/lib/permissions';

import { indicatorsApi } from '../api';

import { buildIndicatorOverviewData } from './indicator-overview-model';

import type { IndicatorOverviewData } from './indicator-overview-model';
import type { IndicatorDefinition } from '../types';
import type { DashboardBreakdowns, DashboardSummaryMetric } from '@/features/dashboard/types';

const DEFINITIONS_PAGE_SIZE = 50;

export interface UseIndicatorOverviewResult {
  readonly status: 'loading' | 'error' | 'success';
  readonly data?: IndicatorOverviewData;
  readonly definitionsUnavailable: boolean;
  readonly isRefreshing: boolean;
  readonly refresh: () => void;
}

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
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

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
