'use client';

import { FilterBar, type ActiveFilterChip } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { ReferenceDataError } from '@/components/register/reference-data-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { singleValueChip } from '@/lib/register/filter-chips';

import { auditEngagementsApi } from '../api';

import type { AuditEngagementStatus, OrgUnitNode, UserRef } from '../types';
import type { ReactNode } from 'react';

const ALL_VALUE = '__all__';

const STATUS_VALUES: readonly AuditEngagementStatus[] = [
  'PLANNING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

interface RegisterReferenceData {
  orgUnits: OrgUnitNode[];
}

export interface AuditEngagementRegisterFiltersProps {
  presentationControls?: ReactNode;
  status: AuditEngagementStatus | undefined;
  onStatusChange: (value: AuditEngagementStatus | undefined) => void;
  orgUnitId: string | undefined;
  onOrgUnitIdChange: (value: string | undefined) => void;
  leadAuditorUserId: string | undefined;
  onLeadAuditorUserIdChange: (value: string | undefined) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  knownLeadAuditor?: UserRef;
}

export function AuditEngagementRegisterFilters({
  presentationControls,
  status,
  onStatusChange,
  orgUnitId,
  onOrgUnitIdChange,
  leadAuditorUserId,
  onLeadAuditorUserIdChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  knownLeadAuditor,
}: AuditEngagementRegisterFiltersProps): React.JSX.Element {
  const filters = auditEngagements.register.filters;
  const activeFiltersMessages = auditEngagements.register.activeFilters;

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
        const orgUnits = await auditEngagementsApi.listOrgUnits();
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

  const orgUnitOptions = referenceData?.orgUnits ?? [];
  const leadAuditorValue: UserRef | undefined =
    leadAuditorUserId && knownLeadAuditor?.id === leadAuditorUserId ? knownLeadAuditor : undefined;

  const activeFilterChips: ActiveFilterChip[] = [
    singleValueChip(
      'status',
      filters.statusLabel,
      status ? auditEngagements.statusLabels[status] : undefined,
      () => onStatusChange(undefined),
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
    singleValueChip(
      'leadAuditor',
      filters.leadAuditorLabel,
      leadAuditorUserId ? (leadAuditorValue?.fullName ?? leadAuditorUserId) : undefined,
      () => onLeadAuditorUserIdChange(undefined),
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
          value={status ?? ALL_VALUE}
          onValueChange={(value) =>
            onStatusChange(value === ALL_VALUE ? undefined : (value as AuditEngagementStatus))
          }
        >
          <SelectTrigger aria-label={filters.statusLabel} className="h-9 w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{filters.statusAll}</SelectItem>
            {STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {auditEngagements.statusLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <div className="w-56">
          <UserPicker
            value={leadAuditorValue}
            onChange={(user) => onLeadAuditorUserIdChange(user.id)}
            onSearch={(q) => auditEngagementsApi.searchUsers(q)}
            labels={{
              placeholder: filters.leadAuditorLabel,
              triggerAriaLabel: filters.leadAuditorLabel,
            }}
          />
        </div>
      </FilterBar>
    </>
  );
}
