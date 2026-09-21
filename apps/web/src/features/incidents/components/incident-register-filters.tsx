'use client';

/**
 * PharosGRC — incident register filter toolbar (008-incidents-problems,
 * US1), joining the shared exploration frame (CLAUDE.md §18.12): the same
 * collapsible `FilterBar` + chip row + `ReferenceDataError` composition
 * `AssetRegisterFilters`/`AuditEngagementRegisterFilters` already use.
 *
 * Two `MultiSelectFilter`s for the closed enums (`status[]`, `severity[]`,
 * both `style: form, explode: true`) plus one single-value `Select` for
 * `orgUnitId` — this contract's own `listIncidents` operation accepts
 * exactly one organizational unit per request, never an array (matching
 * `AssetRegisterFilters`'s own `orgUnitId` shape, not `RiskRegisterFilters`'s
 * multi-select one). Reference data (organizational units) is fetched once
 * on mount, the same "loading / loaded-empty / failed are three
 * distinguishable states, never a silently empty option list" discipline
 * every other register's filter toolbar already applies.
 */
import {
  FilterBar,
  MultiSelectFilter,
  type ActiveFilterChip,
  type MultiSelectFilterOption,
} from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { incidentsApi } from '../api';

import type { IncidentSeverity, IncidentStatus } from '../types';
import type { OrgUnitNode } from '@/features/risks/types';
import type { ReactNode } from 'react';

import { ReferenceDataError } from '@/components/register/reference-data-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';
import { multiSelectChip, searchChip, singleValueChip } from '@/lib/register/filter-chips';

const ALL_VALUE = '__all__';

const STATUS_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(incidents.statusLabels) as IncidentStatus[]
).map((value) => ({ value, label: incidents.statusLabels[value] }));

const SEVERITY_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(incidents.severityLabels) as IncidentSeverity[]
).map((value) => ({ value, label: incidents.severityLabels[value] }));

export interface IncidentRegisterFiltersProps {
  presentationControls?: ReactNode;
  status: readonly IncidentStatus[];
  onStatusChange: (values: readonly IncidentStatus[]) => void;
  severity: readonly IncidentSeverity[];
  onSeverityChange: (values: readonly IncidentSeverity[]) => void;
  orgUnitId: string | undefined;
  onOrgUnitIdChange: (value: string | undefined) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button. */
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function IncidentRegisterFilters({
  presentationControls,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  orgUnitId,
  onOrgUnitIdChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: IncidentRegisterFiltersProps): React.JSX.Element {
  const filters = incidents.register.filters;
  const activeFiltersMessages = incidents.register.activeFilters;

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await incidentsApi.listOrgUnits();
        if (!cancelled) {
          setOrgUnits(units);
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

  const orgUnitOptions = orgUnits ?? [];

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), activeFiltersMessages),
    multiSelectChip(
      'status',
      filters.statusLabel,
      status,
      STATUS_OPTIONS,
      (values) => onStatusChange(values as IncidentStatus[]),
      activeFiltersMessages,
    ),
    multiSelectChip(
      'severity',
      filters.severityLabel,
      severity,
      SEVERITY_OPTIONS,
      (values) => onSeverityChange(values as IncidentSeverity[]),
      activeFiltersMessages,
    ),
    singleValueChip(
      'orgUnit',
      filters.orgUnitLabel,
      orgUnitId
        ? (orgUnitOptions.find((unit) => unit.id === orgUnitId)?.name ?? orgUnitId)
        : undefined,
      () => onOrgUnitIdChange(undefined),
      activeFiltersMessages,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <>
      {referenceDataError ? (
        <ReferenceDataError
          message={filters.optionsError}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}
      <FilterBar
        label={filters.regionLabel}
        searchLabel={incidents.register.searchLabel}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={incidents.register.searchPlaceholder}
        searchTrailing={presentationControls}
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
          label={filters.statusLabel}
          options={STATUS_OPTIONS}
          selected={status}
          onChange={(values) => onStatusChange(values as IncidentStatus[])}
          clearLabel={common.actions.clear}
        />

        <MultiSelectFilter
          label={filters.severityLabel}
          options={SEVERITY_OPTIONS}
          selected={severity}
          onChange={(values) => onSeverityChange(values as IncidentSeverity[])}
          clearLabel={common.actions.clear}
        />

        <Select
          value={orgUnitId ?? ALL_VALUE}
          onValueChange={(value) => onOrgUnitIdChange(value === ALL_VALUE ? undefined : value)}
          disabled={loadingReferenceData}
        >
          <SelectTrigger aria-label={filters.orgUnitLabel} className="h-9 w-[14rem]">
            <SelectValue placeholder={loadingReferenceData ? filters.loadingOptions : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{filters.orgUnitLabel}</SelectItem>
            {orgUnitOptions.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>
    </>
  );
}
