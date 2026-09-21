'use client';

/**
 * PharosGRC — the "Versão de framework" scope variant's picker (T076, US1,
 * FR-005/FR-006, ADR-020). A cascading, two-step picker (framework, then
 * one of its `PUBLISHED` versions) — this API exposes no flat,
 * cross-framework listing endpoint, so the picker walks the normative
 * library the same way a human would browse it (`../api.ts`'s own
 * reference-data section header explains why).
 *
 * Nothing here is pre-selected (a stated requirement, the same spirit as
 * Phase 3's `mapping-migration-panel.tsx`): both selects start empty, and
 * "Adicionar ao escopo" stays disabled until the auditor has explicitly
 * chosen a published version.
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

import type { AuditScopeEntry, FrameworkRef, FrameworkVersionOption } from '../types';

export interface AuditScopeFrameworkVersionPickerProps {
  auditId: string;
  currentScope: readonly AuditScopeEntry[];
  onAdded: (entry: AuditScopeEntry) => void;
}

export function AuditScopeFrameworkVersionPicker({
  auditId,
  currentScope,
  onAdded,
}: AuditScopeFrameworkVersionPickerProps): React.JSX.Element {
  const scope = auditEngagements.scope;

  const [frameworks, setFrameworks] = useState<readonly FrameworkRef[] | null>(null);
  const [loadingFrameworks, setLoadingFrameworks] = useState(false);
  const [frameworksError, setFrameworksError] = useState(false);
  const [frameworkId, setFrameworkId] = useState('');

  const [versions, setVersions] = useState<readonly FrameworkVersionOption[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState(false);
  const [versionId, setVersionId] = useState('');

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

  const currentVersionIds = new Set(
    currentScope
      .filter((entry) => entry.targetType === 'FRAMEWORK_VERSION')
      .map((entry) => entry.target.id),
  );
  const availableVersions = (versions ?? []).filter(
    (version) => !currentVersionIds.has(version.id),
  );

  async function handleAdd(): Promise<void> {
    if (!versionId) return;
    setAddError(null);
    setAdding(true);
    try {
      const entry = await auditEngagementsApi.addFrameworkVersionToScope(auditId, {
        frameworkVersionId: versionId,
      });
      onAdded(entry);
      setVersionId('');
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setAddError(scope.frameworkVersion.alreadyInScopeError);
      } else if (error instanceof ApiError && error.problem.status === 422) {
        setAddError(scope.frameworkVersion.notPublishedError);
      } else {
        setAddError(scope.frameworkVersion.addError);
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
          <SelectTrigger className="w-64" aria-label={scope.frameworkPicker.label}>
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
          <SelectTrigger className="w-64" aria-label={scope.frameworkVersion.pickerLabel}>
            <SelectValue placeholder={scope.frameworkVersion.pickerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {versionsError ? (
              <div className="px-2 py-1.5 text-sm text-status-danger-fg">
                {scope.frameworkVersion.addError}
              </div>
            ) : loadingVersions ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">…</div>
            ) : availableVersions.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {scope.frameworkVersion.pickerNoOptions}
              </div>
            ) : (
              availableVersions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!versionId || adding}
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
