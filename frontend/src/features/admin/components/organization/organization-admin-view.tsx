'use client';

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
