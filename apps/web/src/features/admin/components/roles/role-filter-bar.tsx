'use client';

/**
 * PharosGRC — Administration, the roles surface's search and filters
 * (015-roles-permissions-surface FR-005, T030).
 *
 * Composed on the platform's own `FilterBar` in its **collapsible**
 * disposition — the same one the five business registers use (Riscos,
 * Controles, Ativos, Processos, Auditorias) — with `ToolbarSelect` for each
 * control and the shared chip builders of `@/lib/register/filter-chips`.
 * Nothing here is a pattern of this screen's own (CLAUDE.md §18.12).
 *
 * ## Why collapsible, and what stays visible when it is closed
 *
 * The bar opens as one row: the search box, and a "Filtros N" disclosure
 * button beside it that states how many filter FIELDS are applied. The two
 * selects live in the panel that button opens. What is hidden is the
 * machinery, never the state — `FilterBar` keeps the active-filter chip row
 * OUTSIDE the panel, so a reader always sees which filters narrowed the list
 * and can drop any one of them, or all of them, without opening anything.
 *
 * ## Ordering is deliberately NOT here
 *
 * It reorders; it never hides a role, and `activeFilterCount` does not count
 * it. Behind a "Filtros" disclosure it would be both mislabelled and
 * invisible, so it sits in `ResultsToolbar` beside the result count, exactly
 * where every register puts it.
 *
 * ## The F-66 trap this file still avoids
 *
 * Cause 1 of F-66 is the registers' OLD results bar — a
 * `flex items-center gap-3` grouping of ordering and view controls that does
 * not wrap, measures 395–427 px and overflows 390 px. Neither `FilterBar`'s
 * rows nor `ResultsToolbar`'s control group is that shape: both are
 * `flex-wrap`, so a control drops onto the next line instead of pushing the
 * page sideways (NFR-005). The fixed-width trigger below is likewise a
 * maximum, never a minimum: with a bare `w-[14rem]` the caption plus the
 * trigger measured 308 px inside a 326 px column at 390 px, and `<main>`
 * scrolled sideways by 15 px.
 */
import { FilterBar } from '@pharos/design-system/components';

import { ToolbarSelect } from '@/components/register/toolbar-select';
import { admin } from '@/lib/messages/admin';
import { searchChip, singleValueChip } from '@/lib/register/filter-chips';

import type { PermissionArea } from './permission-grouping';
import type { RoleTypeFilter } from '../../types';
import type { ActiveFilterChip } from '@pharos/design-system/components';

/** Sentinel for "no module filter" — `<Select>` has no empty-string option value. */
const ALL_MODULES = '__all__';

/** Each labelled control takes a whole row below `sm` and sits inline above it. See the F-66 note in this file's header. */
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
  /** The modules at least one loaded role actually reaches, in product order — never the whole taxonomy, so no option can return an empty list by construction. */
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

  // One chip per filter FIELD, built by the shared builders, in the order the
  // controls themselves appear. Each returns `null` when its field is not
  // active, so the row is one `filter(Boolean)` over the three fields
  // `useRoleSurfaceState.activeFilterCount` counts — the badge on the
  // disclosure button and these chips cannot disagree.
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

      {/* FR-005a spelled out, and shown exactly when it is load-bearing: a
          module filter narrows to roles that grant AT LEAST ONE permission
          of that module, which is not the reading "Módulo: Riscos" invites
          on its own. It stays inside the panel, next to the control it
          explains — the chip outside already reports the state. */}
      {module !== undefined ? (
        <p className="basis-full text-xs text-muted-foreground">{messages.moduleHint}</p>
      ) : null}
    </FilterBar>
  );
}
