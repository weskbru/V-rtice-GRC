'use client';

import { FilterBar, type ActiveFilterChip } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { ReferenceDataError } from '@/components/register/reference-data-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { searchChip, singleValueChip } from '@/lib/register/filter-chips';

import { assetsApi } from '../api';

import type { OrgUnitNode } from '../types';
import type { ReactNode } from 'react';

const ALL_VALUE = '__all__';

export interface AssetRegisterFiltersProps {
  presentationControls: ReactNode;
  orgUnitId: string | undefined;
  onOrgUnitIdChange: (value: string | undefined) => void;
  isActive: boolean | undefined;
  onIsActiveChange: (value: boolean | undefined) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function AssetRegisterFilters({
  presentationControls,
  orgUnitId,
  onOrgUnitIdChange,
  isActive,
  onIsActiveChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: AssetRegisterFiltersProps): React.JSX.Element {
  const filters = assets.register.filters;
  const activeFiltersMessages = assets.register.activeFilters;

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
        const units = await assetsApi.listOrgUnits();
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
    singleValueChip(
      'orgUnit',
      filters.orgUnitLabel,
      orgUnitId
        ? (orgUnitOptions.find((unit) => unit.id === orgUnitId)?.name ?? orgUnitId)
        : undefined,
      () => onOrgUnitIdChange(undefined),
      activeFiltersMessages,
    ),
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
    <>
      {referenceDataError ? (
        <ReferenceDataError
          message={filters.optionsError}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}
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
    </>
  );
}
