'use client';

/**
 * PharosGRC — risk register filter toolbar (T110, FR-088, FR-089, ADR-006).
 *
 * Composes the shared register chrome — `FilterBar` in its collapsible
 * disposition, `MultiSelectFilter`, `UserMultiSelectFilter` and the platform
 * chip builders — with the risk-specific filter definitions this register
 * needs: status, risk level, category, organizational unit, owner and the
 * two overdue flags.
 *
 * ## What is deliberately NOT here any more
 *
 * - **The risk-level basis (residual/inherent)**: it changes how a level is
 *   labelled, never which risks match, so it belongs with the ordering and
 *   the Cards/Tabela toggle in the search trailing slot — not among controls that
 *   narrow a result set, and not in the chip row.
 * - **The column menu**: it governs table columns, which is a presentation
 *   decision, and it sits in the search trailing slot beside the view toggle
 *   rather than inside the filter surface.
 *
 * ## Collapsed by default, but never opaque
 *
 * Eight filter controls permanently on screen pushed the first risk card
 * past 70% of a 900px viewport. They now live behind the "Filtros" button,
 * which states how many are applied, while the active-filter chips stay
 * visible underneath the search box: what is hidden is the machinery, never
 * the state. The chip list is built from the same fields
 * `useRegisterState`'s own `activeFilterCount` counts, so the button's badge
 * and the chips can never disagree.
 *
 * Reference data (categories, organizational units) is fetched once on
 * mount, deliberately NOT shared with `RiskForm`'s own loading: the register
 * needs `{ id, name }` pairs for filter options, while the form's needs
 * (validation, disabled states, required-ness) are a different shape of
 * problem.
 */
import {
  FilterBar,
  MultiSelectFilter,
  type MultiSelectFilterOption,
} from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { UserMultiSelectFilter } from '@/components/directory/user-multi-select-filter';
import { ReferenceDataError } from '@/components/register/reference-data-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { booleanChip, multiSelectChip, searchChip } from '@/lib/register/filter-chips';

import { risksApi } from '../api';

import type { OrgUnitNode, ReferenceDataItem, RiskLevel, RiskStatus, UserRef } from '../types';
import type { ActiveFilterChip } from '@pharos/design-system/components';
import type { ReactNode } from 'react';

// `risks.statusLabels`/`risks.riskLevelLabels` are exhaustive `Record`s
// keyed on the app's own unions (F-1) — indexing by a valid member can never
// miss, so no `?? value` fallback is needed here.
const STATUS_OPTIONS: readonly MultiSelectFilterOption[] = (
  Object.keys(risks.statusLabels) as RiskStatus[]
).map((value) => ({ value, label: risks.statusLabels[value] }));

const RISK_LEVEL_OPTIONS: readonly MultiSelectFilterOption[] = (
  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RiskLevel[]
).map((value) => ({ value, label: risks.riskLevelLabels[value] }));

interface RegisterReferenceData {
  categories: ReferenceDataItem[];
  orgUnits: OrgUnitNode[];
}

export interface RiskRegisterFiltersProps {
  presentationControls?: ReactNode;
  status: readonly string[];
  onStatusChange: (values: readonly string[]) => void;
  riskLevel: readonly string[];
  onRiskLevelChange: (values: readonly string[]) => void;
  categoryId: readonly string[];
  onCategoryIdChange: (values: readonly string[]) => void;
  orgUnitId: readonly string[];
  onOrgUnitIdChange: (values: readonly string[]) => void;
  ownerUserId: readonly string[];
  onOwnerUserIdChange: (values: readonly string[]) => void;
  /** S-10 — labels for already-selected owner ids the caller already knows
   * about (e.g. from the currently loaded page of risks), so a filter
   * value persisted in the URL still shows a name even when this
   * component's own search has not (yet) returned that user. */
  knownOwners?: ReadonlyMap<string, UserRef>;
  overdueReview: boolean | undefined;
  onOverdueReviewChange: (value: boolean | undefined) => void;
  overdueTreatment: boolean | undefined;
  onOverdueTreatmentChange: (value: boolean | undefined) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button. */
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function RiskRegisterFilters({
  presentationControls,
  status,
  onStatusChange,
  riskLevel,
  onRiskLevelChange,
  categoryId,
  onCategoryIdChange,
  orgUnitId,
  onOrgUnitIdChange,
  ownerUserId,
  onOwnerUserIdChange,
  knownOwners,
  overdueReview,
  onOverdueReviewChange,
  overdueTreatment,
  onOverdueTreatmentChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: RiskRegisterFiltersProps): React.JSX.Element {
  const [referenceData, setReferenceData] = useState<RegisterReferenceData | null>(null);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  // Loading/loaded-empty/failed are kept as three DISTINCT states — never
  // collapsed into a silent empty option list on failure (this screen used
  // to `catch {}` and fall back to empty filter options, indistinguishable
  // from "this org genuinely has no categories/units yet").
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const [categories, orgUnits] = await Promise.all([
          risksApi.listCategories(),
          risksApi.listOrgUnits(),
        ]);
        if (!cancelled) {
          setReferenceData({ categories, orgUnits });
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
    ? risks.register.filters.optionsError
    : loadingReferenceData
      ? risks.register.filters.loadingOptions
      : common.filters.noOptions;

  const categoryOptions: readonly MultiSelectFilterOption[] =
    referenceData?.categories.map((item) => ({ value: item.id, label: item.name })) ?? [];
  const orgUnitOptions: readonly MultiSelectFilterOption[] =
    referenceData?.orgUnits.map((unit) => ({ value: unit.id, label: unit.name })) ?? [];
  // S-10 — owner chip labels resolve from `knownOwners` (no bounded,
  // unsearched full list) — see that prop's own doc comment.
  const ownerOptions: readonly MultiSelectFilterOption[] = ownerUserId.map((id) => ({
    value: id,
    label: knownOwners?.get(id)?.fullName ?? id,
  }));

  const chipLabels = risks.register.activeFilters;
  const filterLabels = risks.register.filters;

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), chipLabels),
    multiSelectChip(
      'status',
      filterLabels.statusLabel,
      status,
      STATUS_OPTIONS,
      onStatusChange,
      chipLabels,
    ),
    multiSelectChip(
      'riskLevel',
      filterLabels.riskLevelLabel,
      riskLevel,
      RISK_LEVEL_OPTIONS,
      onRiskLevelChange,
      chipLabels,
    ),
    multiSelectChip(
      'category',
      filterLabels.categoryLabel,
      categoryId,
      categoryOptions,
      onCategoryIdChange,
      chipLabels,
    ),
    multiSelectChip(
      'orgUnit',
      filterLabels.orgUnitLabel,
      orgUnitId,
      orgUnitOptions,
      onOrgUnitIdChange,
      chipLabels,
    ),
    multiSelectChip(
      'owner',
      filterLabels.ownerLabel,
      ownerUserId,
      ownerOptions,
      onOwnerUserIdChange,
      chipLabels,
    ),
    overdueReview === true
      ? booleanChip(
          'overdueReview',
          filterLabels.overdueReviewLabel,
          () => onOverdueReviewChange(undefined),
          chipLabels,
        )
      : null,
    overdueTreatment === true
      ? booleanChip(
          'overdueTreatment',
          filterLabels.overdueTreatmentLabel,
          () => onOverdueTreatmentChange(undefined),
          chipLabels,
        )
      : null,
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
        label={filterLabels.regionLabel}
        searchLabel={filterLabels.searchLabel}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={filterLabels.searchPlaceholder}
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
          label={filterLabels.statusLabel}
          options={STATUS_OPTIONS}
          selected={status}
          onChange={onStatusChange}
          clearLabel={common.actions.clear}
        />

        <MultiSelectFilter
          label={filterLabels.riskLevelLabel}
          options={RISK_LEVEL_OPTIONS}
          selected={riskLevel}
          onChange={onRiskLevelChange}
          clearLabel={common.actions.clear}
        />

        <MultiSelectFilter
          label={filterLabels.categoryLabel}
          options={categoryOptions}
          selected={categoryId}
          onChange={onCategoryIdChange}
          emptyOptionsMessage={emptyOptionsMessage}
          clearLabel={common.actions.clear}
        />

        <MultiSelectFilter
          label={filterLabels.orgUnitLabel}
          options={orgUnitOptions}
          selected={orgUnitId}
          onChange={onOrgUnitIdChange}
          emptyOptionsMessage={emptyOptionsMessage}
          clearLabel={common.actions.clear}
        />

        <UserMultiSelectFilter
          labels={{ label: filterLabels.ownerLabel }}
          selected={ownerUserId}
          onChange={onOwnerUserIdChange}
          onSearch={(q) => risksApi.searchUsers(q)}
          knownUsers={knownOwners}
        />

        <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs">
          <Checkbox
            id="risk-register-overdue-review"
            checked={overdueReview === true}
            onCheckedChange={(checked) =>
              onOverdueReviewChange(checked === true ? true : undefined)
            }
          />
          <Label htmlFor="risk-register-overdue-review" className="text-sm font-normal">
            {filterLabels.overdueReviewLabel}
          </Label>
        </div>

        <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs">
          <Checkbox
            id="risk-register-overdue-treatment"
            checked={overdueTreatment === true}
            onCheckedChange={(checked) =>
              onOverdueTreatmentChange(checked === true ? true : undefined)
            }
          />
          <Label htmlFor="risk-register-overdue-treatment" className="text-sm font-normal">
            {filterLabels.overdueTreatmentLabel}
          </Label>
        </div>
      </FilterBar>
    </>
  );
}
