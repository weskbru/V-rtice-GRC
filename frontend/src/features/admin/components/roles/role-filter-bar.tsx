'use client';

import { FilterBar } from '@pharos/design-system/components';

import { ToolbarSelect } from '@/components/register/toolbar-select';
import { admin } from '@/lib/messages/admin';
import { searchChip, singleValueChip } from '@/lib/register/filter-chips';

import type { PermissionArea } from './permission-grouping';
import type { RoleTypeFilter } from '../../types';
import type { ActiveFilterChip } from '@pharos/design-system/components';

const ALL_MODULES = '__all__';

const CONTROL_CLASS = 'w-full sm:w-auto';
const TRIGGER_CLASS = 'w-full min-w-0 sm:w-[13rem]';

export interface RoleFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  type: RoleTypeFilter;
  onTypeChange: (type: RoleTypeFilter) => void;
  module: PermissionArea | undefined;
  onModuleChange: (module: PermissionArea | undefined) => void;
  availableModules: readonly { readonly area: PermissionArea; readonly label: string }[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function RoleFilterBar({
  searchValue,
  onSearchChange,
  onClearSearch,
  type,
  onTypeChange,
  module,
  onModuleChange,
  availableModules,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: RoleFilterBarProps): React.JSX.Element {
  const messages = admin.roles.filters;
  const chipLabels = admin.roles.activeFilters;
  const moduleLabel = availableModules.find((entry) => entry.area === module)?.label;

  const activeFilters: ActiveFilterChip[] = [
    searchChip(searchValue, onClearSearch, chipLabels),
    singleValueChip(
      'type',
      messages.typeLabel,
      type === 'all' ? undefined : messages.typeOptions[type],
      () => onTypeChange('all'),
      chipLabels,
    ),
    singleValueChip(
      'module',
      messages.moduleLabel,
      module === undefined ? undefined : moduleLabel,
      () => onModuleChange(undefined),
      chipLabels,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <FilterBar
      label={messages.regionLabel}
      searchLabel={messages.searchLabel}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={messages.searchPlaceholder}
      collapsible
      filtersToggleLabel={messages.groupLabel}
      filtersPanelLabel={messages.regionLabel}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={admin.roles.states.emptyFiltered.clearAction}
      activeFilters={activeFilters}
      activeFiltersLabel={chipLabels.regionLabel}
      activeFilterCount={activeFilterCount}
    >
      <ToolbarSelect
        label={messages.typeLabel}
        prefix={messages.typeLabel}
        options={[
          { value: 'all', label: messages.typeOptions.all },
          { value: 'system', label: messages.typeOptions.system },
          { value: 'custom', label: messages.typeOptions.custom },
        ]}
        value={type}
        onValueChange={(value) => onTypeChange(value as RoleTypeFilter)}
        className={CONTROL_CLASS}
        triggerClassName={TRIGGER_CLASS}
      />

      {availableModules.length > 0 ? (
        <ToolbarSelect
          label={messages.moduleLabel}
          prefix={messages.moduleLabel}
          options={[
            { value: ALL_MODULES, label: messages.moduleAllOption },
            ...availableModules.map((entry) => ({ value: entry.area, label: entry.label })),
          ]}
          value={module ?? ALL_MODULES}
          onValueChange={(value) =>
            onModuleChange(value === ALL_MODULES ? undefined : (value as PermissionArea))
          }
          className={CONTROL_CLASS}
          triggerClassName={TRIGGER_CLASS}
        />
      ) : null}

      {module !== undefined ? (
        <p className="basis-full text-xs text-muted-foreground">{messages.moduleHint}</p>
      ) : null}
    </FilterBar>
  );
}
