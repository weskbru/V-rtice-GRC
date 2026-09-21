'use client';

/**
 * PharosGRC — control catalog filter toolbar (CLAUDE.md §18.12).
 *
 * Composes the same shared exploration chrome the risk register does —
 * `FilterBar` in its collapsible disposition, `MultiSelectFilter`, the
 * platform chip builders and the reference-data error banner — with the
 * control-specific filters: status, effectiveness, nature, type and
 * frequency are closed enums with static option lists; organizational unit
 * and owner are reference data fetched once on mount.
 *
 * The column menu is no longer here: it governs table columns, which is a
 * presentation decision, and it now sits in the results toolbar beside the
 * view toggle.
 */
import {
  FilterBar,
  MultiSelectFilter,
  type MultiSelectFilterOption,
} from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { controlsApi } from '../api';

import type {
  ControlEffectiveness,
  ControlFrequency,
  ControlNature,
  ControlStatus,
  ControlType,
  OrgUnitNode,
  UserRef,
} from '../types';
import type { ActiveFilterChip } from '@pharos/design-system/components';
import type { ReactNode } from 'react';

import { UserMultiSelectFilter } from '@/components/directory/user-multi-select-filter';
import { ReferenceDataError } from '@/components/register/reference-data-error';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import { multiSelectChip, searchChip } from '@/lib/register/filter-chips';

const STATUS_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(controls.statusLabels) as ControlStatus[]
).map((value) => ({ value, label: controls.statusLabels[value] }));

const EFFECTIVENESS_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(controls.effectivenessLabels) as ControlEffectiveness[]
).map((value) => ({ value, label: controls.effectivenessLabels[value] }));

const NATURE_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(controls.natureLabels) as ControlNature[]
).map((value) => ({ value, label: controls.natureLabels[value] }));

const TYPE_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(controls.typeLabels) as ControlType[]
).map((value) => ({ value, label: controls.typeLabels[value] }));

const FREQUENCY_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(controls.frequencyLabels) as ControlFrequency[]
).map((value) => ({ value, label: controls.frequencyLabels[value] }));

interface RegisterReferenceData {
  orgUnits: OrgUnitNode[];
}

export interface ControlRegisterFiltersProps {
  presentationControls: ReactNode;
  status: readonly string[];
  onStatusChange: (values: readonly string[]) => void;
  effectiveness: readonly string[];
  onEffectivenessChange: (values: readonly string[]) => void;
  nature: readonly string[];
  onNatureChange: (values: readonly string[]) => void;
  type: readonly string[];
  onTypeChange: (values: readonly string[]) => void;
  frequency: readonly string[];
  onFrequencyChange: (values: readonly string[]) => void;
  orgUnitId: readonly string[];
  onOrgUnitIdChange: (values: readonly string[]) => void;
  ownerUserId: readonly string[];
  onOwnerUserIdChange: (values: readonly string[]) => void;
  /** S-10 — labels for already-selected owner ids the caller already knows
   * about (e.g. from the currently loaded page of controls), so a filter
   * value persisted in the URL still shows a name even when this
   * component's own search has not (yet) returned that user. See
   * `UserMultiSelectFilter`'s own header comment for the full reasoning. */
  knownOwners?: ReadonlyMap<string, UserRef>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button. */
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function ControlRegisterFilters({
  presentationControls,
  status,
  onStatusChange,
  effectiveness,
  onEffectivenessChange,
  nature,
  onNatureChange,
  type,
  onTypeChange,
  frequency,
  onFrequencyChange,
  orgUnitId,
  onOrgUnitIdChange,
  ownerUserId,
  onOwnerUserIdChange,
  knownOwners,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: ControlRegisterFiltersProps): React.JSX.Element {
  const [referenceData, setReferenceData] = useState<RegisterReferenceData | null>(null);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const orgUnits = await controlsApi.listOrgUnits();
        if (!cancelled) {
          setReferenceData({ orgUnits });
        }
      } catch {
        if (!cancelled) {
          setReferenceDataError(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingReferenceData(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const emptyOptionsMessage = referenceDataError
    ? controls.register.filters.optionsError
    : loadingReferenceData
      ? controls.register.filters.loadingOptions
      : common.filters.noOptions;

  const orgUnitOptions: readonly MultiSelectFilterOption[] =
    referenceData?.orgUnits.map((unit) => ({ value: unit.id, label: unit.name })) ?? [];
  // S-10 — owner chip labels resolve from `knownOwners` now (no bounded,
  // unsearched full list) — see this prop's own doc comment.
  const ownerOptions: readonly MultiSelectFilterOption[] = ownerUserId.map((id) => ({
    value: id,
    label: knownOwners?.get(id)?.fullName ?? id,
  }));

  const chipLabels = controls.register.activeFilters;
  const filterLabels = controls.register.filters;

  const chipDefs: readonly [
    string,
    string,
    readonly string[],
    readonly MultiSelectFilterOption[],
    (v: readonly string[]) => void,
  ][] = [
    ['status', filterLabels.statusLabel, status, STATUS_OPTIONS, onStatusChange],
    [
      'effectiveness',
      filterLabels.effectivenessLabel,
      effectiveness,
      EFFECTIVENESS_OPTIONS,
      onEffectivenessChange,
    ],
    ['nature', filterLabels.natureLabel, nature, NATURE_OPTIONS, onNatureChange],
    ['type', filterLabels.typeLabel, type, TYPE_OPTIONS, onTypeChange],
    ['frequency', filterLabels.frequencyLabel, frequency, FREQUENCY_OPTIONS, onFrequencyChange],
    ['orgUnit', filterLabels.orgUnitLabel, orgUnitId, orgUnitOptions, onOrgUnitIdChange],
    ['owner', filterLabels.ownerLabel, ownerUserId, ownerOptions, onOwnerUserIdChange],
  ];

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), chipLabels),
    ...chipDefs.map(([id, label, selected, options, onChange]) =>
      multiSelectChip(id, label, selected, options, onChange, chipLabels),
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <>
      {referenceDataError ? (
        <ReferenceDataError
          message={filterLabels.optionsError}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}
      <FilterBar
        className="rounded-none border-x-0 border-t-0 bg-transparent px-0 pt-0 pb-4"
        searchTrailing={presentationControls}
        label={controls.register.filters.regionLabel}
        searchLabel={controls.register.filters.searchLabel}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={controls.register.filters.searchPlaceholder}
        collapsible
        filtersToggleLabel={filterLabels.groupLabel}
        filtersPanelLabel={filterLabels.regionLabel}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={common.actions.clearFilters}
        activeFilters={activeFilterChips}
        activeFiltersLabel={chipLabels.regionLabel}
      >
        <MultiSelectFilter
          label={controls.register.filters.statusLabel}
          options={STATUS_OPTIONS}
          selected={status}
          onChange={onStatusChange}
          clearLabel={common.actions.clear}
        />
        <MultiSelectFilter
          label={controls.register.filters.effectivenessLabel}
          options={EFFECTIVENESS_OPTIONS}
          selected={effectiveness}
          onChange={onEffectivenessChange}
          clearLabel={common.actions.clear}
        />
        <MultiSelectFilter
          label={controls.register.filters.natureLabel}
          options={NATURE_OPTIONS}
          selected={nature}
          onChange={onNatureChange}
          clearLabel={common.actions.clear}
        />
        <MultiSelectFilter
          label={controls.register.filters.typeLabel}
          options={TYPE_OPTIONS}
          selected={type}
          onChange={onTypeChange}
          clearLabel={common.actions.clear}
        />
        <MultiSelectFilter
          label={controls.register.filters.frequencyLabel}
          options={FREQUENCY_OPTIONS}
          selected={frequency}
          onChange={onFrequencyChange}
          clearLabel={common.actions.clear}
        />
        <MultiSelectFilter
          label={controls.register.filters.orgUnitLabel}
          options={orgUnitOptions}
          selected={orgUnitId}
          onChange={onOrgUnitIdChange}
          emptyOptionsMessage={emptyOptionsMessage}
          clearLabel={common.actions.clear}
        />
        <UserMultiSelectFilter
          labels={{ label: controls.register.filters.ownerLabel }}
          selected={ownerUserId}
          onChange={onOwnerUserIdChange}
          onSearch={(q) => controlsApi.searchUsers(q)}
          knownUsers={knownOwners}
        />
      </FilterBar>
    </>
  );
}
