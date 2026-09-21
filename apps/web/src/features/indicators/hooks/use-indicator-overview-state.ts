'use client';

/**
 * PharosGRC — URL state for the redesigned `/indicators` first screen's
 * exploration controls (indicators-round, S1 ownership, coordinator
 * PLAN.md §2 step 3/§3).
 *
 * The same shared mechanism every other register's own state hook already
 * uses (`@/lib/register/url-state` — `useUrlQueryCommit`/
 * `useDebouncedSearchParam`, see `use-register-state.ts`'s own doc comment
 * for the full shareable-link/no-drift/Back-button reasoning this file does
 * not repeat): the URL query string IS this screen's filter state.
 *
 * Only two parameters, because this screen has exactly two real filter
 * dimensions (PLAN.md §2 step 3 — "no collapsible Filtros panel, only one
 * real filter dimension" beyond free-text search):
 *
 *   - `q` — free-text search over the metric's own pt-BR name, debounced
 *     (`filter-indicator-items.ts` reads this).
 *   - `domain` — one of the ten `IndicatorDomain` values, or absent (`ALL`).
 *     A value outside that closed set (a hand-edited or stale link) is
 *     treated exactly like `ALL`, never thrown or silently left un-parsed —
 *     the same "drop, don't crash" rule `useActionsRegisterState`'s own
 *     `parseStatus`/`parseOriginType` already apply to their own enums.
 *
 * No `page`/`pageSize`/`sort`/`view` here: the redesigned screen has no
 * pagination (the catalog is a fixed 11 items) and no Cards/Tabela toggle
 * (PLAN.md §1's own "Many indicators / configurable catalog: NO" row).
 */
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
  /** The search box's own live value — always current, even mid-debounce (`useDebouncedSearchParam`'s own contract). Bind the search box to this, never to the raw URL value. */
  query: string;
  domain: IndicatorDomainFilterValue;
  setQuery: (value: string) => void;
  setDomain: (value: IndicatorDomainFilterValue) => void;
  /** Reflects the search box's LIVE value, not only the committed URL — so "Limpar filtros" appears as soon as the caller types, not only once the debounce settles. */
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
