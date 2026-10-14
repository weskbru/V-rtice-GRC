'use client';

import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { multiSelectChip, searchChip } from '@/lib/register/filter-chips';
import {
  FilterBar,
  MultiSelectFilter,
  type ActiveFilterChip,
  type MultiSelectFilterOption,
} from '@vertice/design-system/components';

import type { FrameworkOrigin } from '../types';
import type { ReactNode } from 'react';

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
      variant="register"
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
