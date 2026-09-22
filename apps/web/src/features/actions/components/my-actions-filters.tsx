'use client';

/**
 * PharosGRC — "Planos de Ação" register filter toolbar, brought into the
 * shared register family (CLAUDE.md §18.12): the same collapsible
 * `FilterBar` disposition `RiskRegisterFilters`/`AuditEngagementRegisterFilters`
 * use — search-row + "Filtros N" disclosure + an active-filters chip row
 * that stays visible while the panel is collapsed.
 *
 * `GET /actions` accepts exactly one value per filter field (no CSV array),
 * so — like `AuditEngagementRegisterFilters` — the controls stay
 * single-value `Select`s, never `MultiSelectFilter`. No reference-data fetch
 * either: status and origin are both static, closed enums (`actions
 * .statusLabels`/`actions.originTypeLabels`), unlike Risks' category/
 * org-unit filters, which come from the server.
 *
 * `onlyMine`'s chip is this screen's own kind: it starts `true` (SC-002 —
 * this screen's whole reason to exist), so a chip appears only when the
 * caller has turned it OFF, never when it is at its own default.
 */
import { FilterBar, type ActiveFilterChip } from '@pharos/design-system/components';

import type { ActionOriginType, ActionStatus } from '../types';
import type { ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { singleValueChip } from '@/lib/register/filter-chips';

const STATUS_VALUES: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
/**
 * Derived from `originTypeLabels`'s own keys, never a second hand-restated
 * list — see `actions.ts`'s own header for the drift this already caused
 * once.
 */
const ORIGIN_VALUES = Object.keys(actions.originTypeLabels) as readonly ActionOriginType[];

const ALL_VALUE = '__all__';

export interface MyActionsFiltersProps {
  presentationControls?: ReactNode;
  status: ActionStatus | undefined;
  onStatusChange: (value: ActionStatus | undefined) => void;
  originType: ActionOriginType | undefined;
  onOriginTypeChange: (value: ActionOriginType | undefined) => void;
  onlyMine: boolean;
  onOnlyMineChange: (value: boolean) => void;
  onlyOverdue: boolean;
  onOnlyOverdueChange: (value: boolean) => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button. */
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function MyActionsFilters({
  presentationControls,
  status,
  onStatusChange,
  originType,
  onOriginTypeChange,
  onlyMine,
  onOnlyMineChange,
  onlyOverdue,
  onOnlyOverdueChange,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: MyActionsFiltersProps): React.JSX.Element {
  const filters = actions.myActions.filters;
  const chipLabels = actions.myActions.activeFilters;

  const activeFilterChips: ActiveFilterChip[] = [
    singleValueChip(
      'status',
      filters.statusLabel,
      status ? actions.statusLabels[status] : undefined,
      () => onStatusChange(undefined),
      chipLabels,
    ),
    singleValueChip(
      'originType',
      filters.originLabel,
      originType ? actions.originTypeLabels[originType] : undefined,
      () => onOriginTypeChange(undefined),
      chipLabels,
    ),
    onlyOverdue
      ? {
          id: 'onlyOverdue',
          label: filters.onlyOverdue,
          removeLabel: chipLabels.removeLabel(filters.onlyOverdue),
          onRemove: () => onOnlyOverdueChange(false),
        }
      : null,
    onlyMine === false
      ? {
          id: 'onlyMine',
          label: chipLabels.onlyMineOffLabel,
          removeLabel: chipLabels.removeLabel(chipLabels.onlyMineOffLabel),
          onRemove: () => onOnlyMineChange(true),
        }
      : null,
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <FilterBar
      variant="register"
      label={filters.regionLabel}
      searchTrailing={presentationControls}
      collapsible
      filtersToggleLabel={filters.groupLabel}
      filtersPanelLabel={filters.regionLabel}
      activeFilterCount={activeFilterCount}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={common.actions.clearFilters}
      activeFilters={activeFilterChips}
      activeFiltersLabel={chipLabels.regionLabel}
    >
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs">
        <Checkbox
          id="my-actions-only-mine"
          checked={onlyMine}
          onCheckedChange={(checked) => onOnlyMineChange(checked === true)}
        />
        <Label htmlFor="my-actions-only-mine" className="text-sm font-normal">
          {filters.onlyMine}
        </Label>
      </div>

      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs">
        <Checkbox
          id="my-actions-only-overdue"
          checked={onlyOverdue}
          onCheckedChange={(checked) => onOnlyOverdueChange(checked === true)}
        />
        <Label htmlFor="my-actions-only-overdue" className="text-sm font-normal">
          {filters.onlyOverdue}
        </Label>
      </div>

      <Select
        value={status ?? ALL_VALUE}
        onValueChange={(value) =>
          onStatusChange(value === ALL_VALUE ? undefined : (value as ActionStatus))
        }
      >
        <SelectTrigger aria-label={filters.statusLabel} className="h-9 w-[11rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{filters.statusAll}</SelectItem>
          {STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {actions.statusLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={originType ?? ALL_VALUE}
        onValueChange={(value) =>
          onOriginTypeChange(value === ALL_VALUE ? undefined : (value as ActionOriginType))
        }
      >
        <SelectTrigger aria-label={filters.originLabel} className="h-9 w-[13rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{filters.originAll}</SelectItem>
          {ORIGIN_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {actions.originTypeLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
