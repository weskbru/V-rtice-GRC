'use client';

/**
 * PharosGRC — Administration, organizational structure (T183, FR-024,
 * FR-025a, FR-025b, ADR-004). Tree navigation over organizational units
 * (left) plus organizational scope grant administration (right) — the two
 * are one screen because granting `UNIT` scope needs the unit picked from
 * this same tree.
 */
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import { adminApi } from '../../api';

import { OrgUnitFormDialog, type OrgUnitFormMode } from './org-unit-form-dialog';
import { OrgUnitStatusDialog } from './org-unit-status-dialog';
import { OrgUnitTree } from './org-unit-tree';
import { ScopeGrantsPanel } from './scope-grants-panel';

import type { OrgUnitNode } from '../../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export function OrganizationAdminView(): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const canManageOrgUnits = hasPermission('org_unit:administer');

  const [units, setUnits] = useState<readonly OrgUnitNode[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formState, setFormState] = useState<{
    mode: OrgUnitFormMode;
    parent?: OrgUnitNode;
    unit?: OrgUnitNode;
  } | null>(null);
  const [statusUnit, setStatusUnit] = useState<OrgUnitNode | null>(null);

  // `loading` is derived, not `setLoading(true)` called synchronously at the
  // top of the effect — see `UserAdminView`'s identical pattern and doc
  // comment (`react-hooks/set-state-in-effect`).
  const [resolvedReloadToken, setResolvedReloadToken] = useState<number | null>(null);
  const loading = resolvedReloadToken !== reloadToken;

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listOrgUnits()
      .then((result) => {
        if (cancelled) return;
        setUnits(result);
        setError(undefined);
        setResolvedReloadToken(reloadToken);
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
        setResolvedReloadToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function reload(): void {
    setReloadToken((token) => token + 1);
  }

  const selectedUnit = units.find((unit) => unit.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={admin.organization.pageTitle}
        description={admin.organization.pageDescription}
        actions={
          canManageOrgUnits ? (
            <Button onClick={() => setFormState({ mode: 'create-root' })}>
              <Plus aria-hidden="true" className="size-4" />
              {admin.organization.createRootAction}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <LoadingState variant="block" label={common.dataTable.loading} />
      ) : error ? (
        <ErrorState
          problem={error}
          action={
            <Button variant="outline" onClick={reload}>
              {common.actions.retry}
            </Button>
          }
        />
      ) : units.length === 0 ? (
        <EmptyState description={admin.organization.tree.empty} />
      ) : (
        // F-66 causa 3 (`docs/deferred-findings.md`): below `lg` this grid had
        // no `grid-template-columns` of its own at all — an implicit,
        // content-sized single track, not one clamped to the viewport. A
        // long org unit/scope name anywhere inside either child then grew
        // the WHOLE grid instead of truncating or wrapping, measured 525px
        // at a 390px viewport (the panel's own placeholder text, forced
        // wide by that shared track, not a defect in the placeholder
        // itself). `grid-cols-1` makes the base breakpoint an explicit,
        // width-constrained single column — `lg:` keeps the two-column
        // layout unchanged.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-md border border-border p-3">
            <OrgUnitTree
              units={units}
              selectedId={selectedId}
              onSelect={(unit) => setSelectedId(unit.id)}
              canManage={canManageOrgUnits}
              onCreateChild={(parent) => setFormState({ mode: 'create-child', parent })}
              onEdit={(unit) => setFormState({ mode: 'edit', unit })}
              onToggleStatus={setStatusUnit}
            />
          </div>

          <ScopeGrantsPanel selectedUnit={selectedUnit} allUnits={units} />
        </div>
      )}

      {canManageOrgUnits && formState ? (
        <OrgUnitFormDialog
          mode={formState.mode}
          open={formState !== null}
          onOpenChange={(open) => {
            if (!open) setFormState(null);
          }}
          parent={formState.parent}
          unit={formState.unit}
          allUnits={units}
          onSaved={(unit) => {
            const wasEditing = formState.mode === 'edit';
            setFormState(null);
            setSelectedId(unit.id);
            feedback.success(
              wasEditing
                ? admin.organization.feedback.updateSuccess
                : admin.organization.feedback.createSuccess,
            );
            reload();
          }}
        />
      ) : null}

      {canManageOrgUnits ? (
        <OrgUnitStatusDialog
          unit={statusUnit}
          onOpenChange={(open) => {
            if (!open) setStatusUnit(null);
          }}
          onChanged={(unit) => {
            setStatusUnit(null);
            feedback.success(
              unit.status === 'ACTIVE'
                ? admin.organization.feedback.activateSuccess
                : admin.organization.feedback.deactivateSuccess,
            );
            reload();
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}
    </div>
  );
}
