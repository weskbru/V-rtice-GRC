'use client';

/**
 * PharosGRC — the "Requisito" scope variant's picker (T076, US1,
 * FR-005/FR-006, ADR-020). A cascading, three-step picker (framework, one
 * of its `PUBLISHED` versions, then one of that version's requirements) —
 * see `AuditScopeFrameworkVersionPicker`'s own doc comment for why this API
 * has no flatter listing to offer instead.
 *
 * Nothing here is pre-selected: every select starts empty, and "Adicionar
 * ao escopo" stays disabled until a requirement is actually chosen.
 */
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';

import { auditEngagementsApi } from '../api';

import type {
  AuditScopeEntry,
  FrameworkRef,
  FrameworkVersionOption,
  RequirementOption,
} from '../types';

export interface AuditScopeRequirementPickerProps {
  auditId: string;
  currentScope: readonly AuditScopeEntry[];
  onAdded: (entry: AuditScopeEntry) => void;
}

export function AuditScopeRequirementPicker({
  auditId,
  currentScope,
  onAdded,
}: AuditScopeRequirementPickerProps): React.JSX.Element {
  const scope = auditEngagements.scope;

  const [frameworks, setFrameworks] = useState<readonly FrameworkRef[] | null>(null);
  const [loadingFrameworks, setLoadingFrameworks] = useState(false);
  const [frameworksError, setFrameworksError] = useState(false);
  const [frameworkId, setFrameworkId] = useState('');

  const [versions, setVersions] = useState<readonly FrameworkVersionOption[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState(false);
  const [versionId, setVersionId] = useState('');

  const [requirements, setRequirements] = useState<readonly RequirementOption[] | null>(null);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [requirementsError, setRequirementsError] = useState(false);
  const [requirementId, setRequirementId] = useState('');

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function ensureFrameworksLoaded(): Promise<void> {
    if (frameworks !== null || loadingFrameworks) return;
    setLoadingFrameworks(true);
    setFrameworksError(false);
    try {
      const items = await auditEngagementsApi.listFrameworks();
      setFrameworks(items);
    } catch {
      setFrameworks([]);
      setFrameworksError(true);
    } finally {
      setLoadingFrameworks(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setVersionId('');
      setVersions(null);
      setVersionsError(false);
      setRequirementId('');
      setRequirements(null);
      if (!frameworkId) return;

      setLoadingVersions(true);
      try {
        const items = await auditEngagementsApi.listPublishedFrameworkVersions(frameworkId);
        if (!cancelled) setVersions(items);
      } catch {
        if (!cancelled) {
          setVersions([]);
          setVersionsError(true);
        }
      } finally {
        if (!cancelled) setLoadingVersions(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [frameworkId]);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setRequirementId('');
      setRequirements(null);
      setRequirementsError(false);
      if (!frameworkId || !versionId) return;

      setLoadingRequirements(true);
      try {
        const items = await auditEngagementsApi.listRequirements(frameworkId, versionId);
        if (!cancelled) setRequirements(items);
      } catch {
        if (!cancelled) {
          setRequirements([]);
          setRequirementsError(true);
        }
      } finally {
        if (!cancelled) setLoadingRequirements(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [frameworkId, versionId]);

  const currentRequirementIds = new Set(
    currentScope
      .filter((entry) => entry.targetType === 'REQUIREMENT')
      .map((entry) => entry.target.id),
  );
  const availableRequirements = (requirements ?? []).filter(
    (requirement) => !currentRequirementIds.has(requirement.id),
  );

  async function handleAdd(): Promise<void> {
    if (!requirementId) return;
    setAddError(null);
    setAdding(true);
    try {
      const entry = await auditEngagementsApi.addRequirementToScope(auditId, { requirementId });
      onAdded(entry);
      setRequirementId('');
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setAddError(scope.requirement.alreadyInScopeError);
      } else if (error instanceof ApiError && error.problem.status === 422) {
        setAddError(scope.requirement.notPublishedError);
      } else {
        setAddError(scope.requirement.addError);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {addError ? (
        <p role="alert" className="text-sm font-medium text-status-danger-fg">
          {addError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={frameworkId}
          onValueChange={setFrameworkId}
          disabled={adding}
          onOpenChange={(open) => {
            if (open) void ensureFrameworksLoaded();
          }}
        >
          <SelectTrigger className="w-56" aria-label={scope.frameworkPicker.label}>
            <SelectValue placeholder={scope.frameworkPicker.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {frameworksError ? (
              <div className="px-2 py-1.5 text-sm text-status-danger-fg">
                {scope.frameworkPicker.loadError}
              </div>
            ) : loadingFrameworks ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">…</div>
            ) : (frameworks ?? []).length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {scope.frameworkPicker.noOptions}
              </div>
            ) : (
              (frameworks ?? []).map((framework) => (
                <SelectItem key={framework.id} value={framework.id}>
                  {framework.name} ({framework.code})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={versionId} onValueChange={setVersionId} disabled={adding || !frameworkId}>
          <SelectTrigger className="w-56" aria-label={scope.frameworkVersion.pickerLabel}>
            <SelectValue placeholder={scope.frameworkVersion.pickerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {versionsError ? (
              <div className="px-2 py-1.5 text-sm text-status-danger-fg">
                {scope.frameworkVersion.addError}
              </div>
            ) : loadingVersions ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">…</div>
            ) : (versions ?? []).length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {scope.frameworkVersion.pickerNoOptions}
              </div>
            ) : (
              (versions ?? []).map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select
          value={requirementId}
          onValueChange={setRequirementId}
          disabled={adding || !versionId}
        >
          <SelectTrigger className="w-64" aria-label={scope.requirement.pickerLabel}>
            <SelectValue placeholder={scope.requirement.pickerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {requirementsError ? (
              <div className="px-2 py-1.5 text-sm text-status-danger-fg">
                {scope.requirement.addError}
              </div>
            ) : loadingRequirements ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">…</div>
            ) : availableRequirements.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {scope.requirement.pickerNoOptions}
              </div>
            ) : (
              availableRequirements.map((requirement) => (
                <SelectItem key={requirement.id} value={requirement.id}>
                  {requirement.externalRef} — {requirement.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!requirementId || adding}
          onClick={() => void handleAdd()}
        >
          {adding ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="size-4" />
          )}
          {common.actions.add}
        </Button>
      </div>
    </div>
  );
}
