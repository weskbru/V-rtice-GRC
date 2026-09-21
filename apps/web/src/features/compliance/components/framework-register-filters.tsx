'use client';

/**
 * PharosGRC — framework register filter toolbar (US1), joining the shared
 * exploration frame (CLAUDE.md §18.12): the same collapsible `FilterBar` +
 * chip row composition `AssetRegisterFilters`/`RiskRegisterFilters` already
 * use. No reference-data fetch is needed — `origin` is a two-value closed
 * enum with no server-side option list, mirroring `RiskRegisterFilters`'s
 * own `RISK_LEVEL_OPTIONS` (a closed enum built from the catalog directly,
 * not fetched).
 *
 * `MultiSelectFilter`, not a single-value `Select`: `GET /frameworks`'s own
 * `origin` parameter accepts an array (`style: form, explode: false`,
 * `FrameworkListQuery.origin`), the same two-value shape `RiskRegisterFilters`'s
 * own status/level filters use — a single-value control here would silently
 * misrepresent what the endpoint can actually filter by.
 */
import {
  FilterBar,
  MultiSelectFilter,
  type ActiveFilterChip,
  type MultiSelectFilterOption,
} from '@pharos/design-system/components';

import type { FrameworkOrigin } from '../types';
import type { ReactNode } from 'react';

import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { multiSelectChip, searchChip } from '@/lib/register/filter-chips';

const ORIGIN_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(compliance.originLabels) as FrameworkOrigin[]
).map((value) => ({ value, label: compliance.originLabels[value] }));

export interface FrameworkRegisterFiltersProps {
  presentationControls?: ReactNode;
  origin: readonly FrameworkOrigin[];
  onOriginChange: (values: readonly FrameworkOrigin[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button. */
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function FrameworkRegisterFilters({
  presentationControls,
  origin,
  onOriginChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: FrameworkRegisterFiltersProps): React.JSX.Element {
  const filters = compliance.register.filters;
  const activeFiltersMessages = compliance.register.activeFilters;

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), activeFiltersMessages),
    multiSelectChip(
      'origin',
      filters.originLabel,
      origin,
      ORIGIN_OPTIONS,
      (values) => onOriginChange(values as FrameworkOrigin[]),
      activeFiltersMessages,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <FilterBar
      className="rounded-none border-x-0 border-t-0 bg-transparent px-0 pt-0 pb-4"
      searchTrailing={presentationControls}
      label={filters.regionLabel}
      searchLabel={filters.searchLabel}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={filters.searchPlaceholder}
      collapsible
      filtersToggleLabel={filters.groupLabel}
      filtersPanelLabel={filters.regionLabel}
      activeFilterCount={activeFilterCount}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={common.actions.clearFilters}
      activeFilters={activeFilterChips}
      activeFiltersLabel={activeFiltersMessages.regionLabel}
    >
      <MultiSelectFilter
        label={filters.originLabel}
        options={ORIGIN_OPTIONS}
        selected={origin}
        onChange={(values) => onOriginChange(values as FrameworkOrigin[])}
        clearLabel={common.actions.clear}
      />
    </FilterBar>
  );
}
