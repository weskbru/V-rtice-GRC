'use client';

import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';
import { multiSelectChip, searchChip } from '@/lib/register/filter-chips';
import {
  FilterBar,
  MultiSelectFilter,
  type ActiveFilterChip,
  type MultiSelectFilterOption,
} from '@vertice/design-system/components';

import type { ProblemSeverity, ProblemStatus } from '../types';
import type { ReactNode } from 'react';

const STATUS_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(problems.statusLabels) as ProblemStatus[]
).map((value) => ({ value, label: problems.statusLabels[value] }));

const SEVERITY_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(problems.severityLabels) as ProblemSeverity[]
).map((value) => ({ value, label: problems.severityLabels[value] }));

export interface ProblemRegisterFiltersProps {
  presentationControls?: ReactNode;
  status: readonly ProblemStatus[];
  onStatusChange: (values: readonly ProblemStatus[]) => void;
  severity: readonly ProblemSeverity[];
  onSeverityChange: (values: readonly ProblemSeverity[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function ProblemRegisterFilters({
  presentationControls,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: ProblemRegisterFiltersProps): React.JSX.Element {
  const filters = problems.register.filters;
  const chipLabels = problems.register.activeFilters;

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), chipLabels),
    multiSelectChip(
      'status',
      filters.statusLabel,
      status,
      STATUS_OPTIONS,
      (values) => onStatusChange(values as ProblemStatus[]),
      chipLabels,
    ),
    multiSelectChip(
      'severity',
      filters.severityLabel,
      severity,
      SEVERITY_OPTIONS,
      (values) => onSeverityChange(values as ProblemSeverity[]),
      chipLabels,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <FilterBar
      variant="register"
      label={filters.regionLabel}
      searchLabel={filters.searchLabel}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={filters.searchPlaceholder}
      searchTrailing={presentationControls}
      collapsible
      filtersToggleLabel={filters.groupLabel}
      filtersPanelLabel={filters.regionLabel}
      activeFilterCount={activeFilterCount}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={common.actions.clearFilters}
      activeFilters={activeFilterChips}
      activeFiltersLabel={problems.register.activeFilters.regionLabel}
    >
      <MultiSelectFilter
        label={filters.statusLabel}
        options={STATUS_OPTIONS}
        selected={status}
        onChange={(values) => onStatusChange(values as ProblemStatus[])}
        clearLabel={common.actions.clear}
      />
      <MultiSelectFilter
        label={filters.severityLabel}
        options={SEVERITY_OPTIONS}
        selected={severity}
        onChange={(values) => onSeverityChange(values as ProblemSeverity[])}
        clearLabel={common.actions.clear}
      />
    </FilterBar>
  );
}
