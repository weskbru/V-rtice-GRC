'use client';

import { FilterBar, type ActiveFilterChip } from '@pharos/design-system/components';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { common } from '@/lib/messages/common';
import { reports } from '@/lib/messages/reports';
import { singleValueChip } from '@/lib/register/filter-chips';

const ALL_VALUE = '__all__';

export interface ReportRegisterFiltersProps {
  isActive: boolean | undefined;
  onIsActiveChange: (value: boolean | undefined) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function ReportRegisterFilters({
  isActive,
  onIsActiveChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: ReportRegisterFiltersProps): React.JSX.Element {
  const filters = reports.register.filters;
  const activeFiltersMessages = reports.register.activeFilters;

  const activeFilterChips: ActiveFilterChip[] = [
    singleValueChip(
      'situation',
      filters.situationLabel,
      isActive === undefined
        ? undefined
        : isActive
          ? filters.situationActive
          : filters.situationInactive,
      () => onIsActiveChange(undefined),
      activeFiltersMessages,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <FilterBar
      label={filters.regionLabel}
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
      <Select
        value={isActive === undefined ? ALL_VALUE : String(isActive)}
        onValueChange={(value) =>
          onIsActiveChange(value === ALL_VALUE ? undefined : value === 'true')
        }
      >
        <SelectTrigger aria-label={filters.situationLabel} className="h-9 w-[12rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{filters.situationAll}</SelectItem>
          <SelectItem value="true">{filters.situationActive}</SelectItem>
          <SelectItem value="false">{filters.situationInactive}</SelectItem>
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
