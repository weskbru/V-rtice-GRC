'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { IndicatorDomainFilterValue } from '../overview/filter-indicator-items';
import type { IndicatorDomain } from '../overview/indicator-overview-model';

const DOMAIN_VALUES: ReadonlySet<string> = new Set<IndicatorDomain>([
  'RISK',
  'ACTION',
  'PROBLEM',
  'INCIDENT',
  'CONTROL',
  'ASSET',
  'PROCESS',
  'COMPLIANCE',
  'AUDIT',
  'FINDING',
]);

function parseDomain(value: string | null): IndicatorDomainFilterValue {
  return value && DOMAIN_VALUES.has(value) ? (value as IndicatorDomain) : 'ALL';
}

export interface UseIndicatorOverviewStateResult {
  query: string;
  domain: IndicatorDomainFilterValue;
  setQuery: (value: string) => void;
  setDomain: (value: IndicatorDomainFilterValue) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

export function useIndicatorOverviewState(): UseIndicatorOverviewStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const domain = parseDomain(searchParams.get('domain'));
  const urlQuery = searchParams.get('q') ?? '';

  const search = useDebouncedSearchParam(urlQuery, 'q', commit);

  const setDomain = useCallback(
    (value: IndicatorDomainFilterValue) => {
      commit((params) => {
        if (value === 'ALL') {
          params.delete('domain');
        } else {
          params.set('domain', value);
        }
      });
    },
    [commit],
  );

  const clearFilters = useCallback(() => {
    search.clear();
    commit((params) => {
      params.delete('q');
      params.delete('domain');
    });
  }, [commit, search]);

  return {
    query: search.inputValue,
    domain,
    setQuery: search.setValue,
    setDomain,
    hasActiveFilters: search.inputValue !== '' || domain !== 'ALL',
    clearFilters,
  };
}
