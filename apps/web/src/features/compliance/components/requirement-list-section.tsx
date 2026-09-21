'use client';

/**
 * PharosGRC — the "Requisitos" section of a framework version's detail
 * screen (US1/US3, contract operation 10). Replaces the session-scoped
 * workaround this module shipped with while `listRequirements` was not yet
 * wired server-side — it is now, and this section fetches the version's
 * real requirement listing, paginated and filterable by the requirement's
 * own calculated `complianceState`, exactly like `FrameworkListView`'s own
 * three-state loading/empty/error discipline (CLAUDE.md §18.11).
 *
 * Each row's compliance state is shown as icon + text + colour, never
 * colour alone (CLAUDE.md §18.8) — `complianceStateBadgeVariant`/
 * `complianceStateIcon`/`complianceStateLabel` from `../status` already
 * enforce that a `StatusBadge` never renders with colour as its only
 * signal.
 */
import {
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  MultiSelectFilter,
  PaginationFooter,
  StatusBadge,
} from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';

import { complianceApi } from '../api';
import { complianceStateBadgeVariant, complianceStateIcon, complianceStateLabel } from '../status';

import { RequirementInlineForm } from './requirement-inline-form';

import type { Requirement, RequirementComplianceState } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const STATE_OPTIONS: readonly { value: string; label: string }[] = (
  Object.keys(compliance.complianceStateLabels) as RequirementComplianceState[]
).map((value) => ({ value, label: compliance.complianceStateLabels[value] }));

export interface RequirementListSectionProps {
  frameworkId: string;
  versionId: string;
  versionIsDraft: boolean;
  canAdminister: boolean;
  /** Reports the version's real, unfiltered requirement total upward, e.g. for `PublishVersionAction`'s hint. Called once per successful unfiltered fetch. */
  onTotalChange?: (total: number) => void;
}

export function RequirementListSection({
  frameworkId,
  versionId,
  versionIsDraft,
  canAdminister,
  onTotalChange,
}: RequirementListSectionProps): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [stateFilter, setStateFilter] = useState<readonly string[]>([]);
  const [rows, setRows] = useState<readonly Requirement[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [creating, setCreating] = useState(false);

  const stateFilterKey = stateFilter.join(',');
  const requestKey = `${versionId}|${page}|${pageSize}|${stateFilterKey}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    complianceApi
      .listRequirements(frameworkId, versionId, {
        page,
        pageSize,
        complianceState: stateFilter as readonly RequirementComplianceState[],
      })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setTotal(result.meta.total);
        setError(undefined);
        setResolvedRequestKey(requestKey);
        if (stateFilter.length === 0) {
          onTotalChange?.(result.meta.total);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from every dependency read above; `onTotalChange` is a caller-supplied callback, not part of the fetch key.
  }, [frameworkId, versionId, page, pageSize, stateFilterKey, reloadToken]);

  function handleStateFilterChange(next: readonly string[]): void {
    setStateFilter(next);
    setPage(1);
  }

  function handleCreated(): void {
    setCreating(false);
    setPage(1);
    setReloadToken((token) => token + 1);
  }

  const canCreate = versionIsDraft && canAdminister;
  const hasActiveFilters = stateFilter.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{compliance.requirementList.description}</p>
        {canCreate ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {compliance.requirementList.createAction}
          </Button>
        ) : null}
      </div>

      {!versionIsDraft ? (
        <p
          role="note"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {compliance.requirements.notDraftNotice}
        </p>
      ) : null}

      <FilterBar
        label={compliance.requirementList.stateFilterLabel}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => handleStateFilterChange([])}
        clearFiltersLabel={common.actions.clearFilters}
      >
        <MultiSelectFilter
          label={compliance.requirementList.stateFilterLabel}
          options={STATE_OPTIONS}
          selected={stateFilter}
          onChange={handleStateFilterChange}
          clearLabel={common.actions.clearFilters}
        />
      </FilterBar>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {loading
          ? compliance.requirementList.loadingResults
          : compliance.requirementList.resultsSummary(total)}
      </p>

      {loading ? (
        <LoadingState variant="table" rows={5} label={compliance.requirementList.loadingResults} />
      ) : error ? (
        <ErrorState
          problem={error}
          message={compliance.requirementList.loadError}
          action={
            <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
              {common.actions.retry}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            variant="empty"
            title={compliance.requirementList.empty.noResults.title}
            description={compliance.requirementList.empty.noResults.description}
            action={
              <Button variant="outline" onClick={() => handleStateFilterChange([])}>
                {compliance.requirementList.empty.noResults.clearAction}
              </Button>
            }
          />
        ) : (
          <EmptyState
            variant="empty"
            title={compliance.requirementList.empty.noneYet.title}
            description={compliance.requirementList.empty.noneYet.description}
            action={
              canCreate ? (
                <Button onClick={() => setCreating(true)}>
                  {compliance.requirementList.empty.noneYet.createAction}
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">{compliance.requirementList.tableCaption}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{compliance.requirementList.columns.externalRef}</TableHead>
                  <TableHead>{compliance.requirementList.columns.title}</TableHead>
                  <TableHead>{compliance.requirementList.columns.complianceState}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((requirement) => (
                  <TableRow key={requirement.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {requirement.externalRef}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/compliance/${frameworkId}/versions/${versionId}/requirements/${requirement.id}`}
                        className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {requirement.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={complianceStateBadgeVariant(requirement.complianceState)}
                        label={complianceStateLabel(requirement.complianceState)}
                        icon={complianceStateIcon(requirement.complianceState)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationFooter
            pageIndex={page - 1}
            pageSize={pageSize}
            totalRows={total}
            onPageIndexChange={(index) => setPage(index + 1)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            labels={common.dataTable}
          />
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{compliance.requirements.createFormTitle}</DialogTitle>
          </DialogHeader>
          <RequirementInlineForm
            mode="create"
            frameworkId={frameworkId}
            versionId={versionId}
            onSaved={handleCreated}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
