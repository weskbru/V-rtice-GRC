'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import { compliance } from '@/lib/messages/compliance';

import { complianceApi } from '../api';

import { MappingMigrationItemsTable } from './mapping-migration-items-table';

import type {
  FrameworkVersion,
  MappingMigrationCorrespondence,
  MappingMigrationDetail,
  Requirement,
} from '../types';

const MAX_PAGES = 5;
const PAGE_SIZE = 100;

async function fetchAllRequirements(
  frameworkId: string,
  versionId: string,
): Promise<readonly Requirement[]> {
  const all: Requirement[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await complianceApi.listRequirements(frameworkId, versionId, {
      page,
      pageSize: PAGE_SIZE,
    });
    all.push(...result.data);
    if (page >= result.meta.totalPages) break;
  }
  return all;
}

export interface MappingMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frameworkId: string;
  targetVersionId: string;
  onExecuted: (detail: MappingMigrationDetail) => void;
}

export function MappingMigrationDialog({
  open,
  onOpenChange,
  frameworkId,
  targetVersionId,
  onExecuted,
}: MappingMigrationDialogProps): React.JSX.Element {
  const [sourceOptions, setSourceOptions] = useState<readonly FrameworkVersion[] | null>(null);
  const [sourceVersionId, setSourceVersionId] = useState('');

  const [targetRequirements, setTargetRequirements] = useState<readonly Requirement[] | null>(null);
  const [sourceRequirements, setSourceRequirements] = useState<readonly Requirement[] | null>(null);
  const [requirementsError, setRequirementsError] = useState(false);
  const [resolvedRequirementsKey, setResolvedRequirementsKey] = useState<string | null>(null);
  const loadingRequirements = sourceVersionId !== '' && resolvedRequirementsKey !== sourceVersionId;

  const [correspondences, setCorrespondences] = useState<Record<string, string[]>>({});
  const [pickerByTarget, setPickerByTarget] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<MappingMigrationDetail | null>(null);

  useEffect(() => {
    if (!open) return;
    complianceApi
      .listFrameworkVersions(frameworkId, { page: 1, pageSize: 100 })
      .then((page) => {
        setSourceOptions(page.data.filter((version) => version.id !== targetVersionId));
      })
      .catch(() => setSourceOptions([]));
  }, [open, frameworkId, targetVersionId]);

  useEffect(() => {
    if (!sourceVersionId) return;
    let cancelled = false;
    Promise.all([
      fetchAllRequirements(frameworkId, targetVersionId),
      fetchAllRequirements(frameworkId, sourceVersionId),
    ])
      .then(([targets, sources]) => {
        if (cancelled) return;
        setTargetRequirements(targets);
        setSourceRequirements(sources);
        setRequirementsError(false);
        setResolvedRequirementsKey(sourceVersionId);
      })
      .catch(() => {
        if (cancelled) return;
        setRequirementsError(true);
        setResolvedRequirementsKey(sourceVersionId);
      });
    return () => {
      cancelled = true;
    };
  }, [frameworkId, targetVersionId, sourceVersionId]);

  function handleSourceVersionChange(nextSourceVersionId: string): void {
    setSourceVersionId(nextSourceVersionId);
    setTargetRequirements(null);
    setSourceRequirements(null);
    setCorrespondences({});
    setPickerByTarget({});
    setRequirementsError(false);
    setResolvedRequirementsKey(null);
  }

  function reset(): void {
    setSourceVersionId('');
    setTargetRequirements(null);
    setSourceRequirements(null);
    setCorrespondences({});
    setPickerByTarget({});
    setRequirementsError(false);
    setResolvedRequirementsKey(null);
    setSubmitError(null);
    setResult(null);
  }

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function addCorrespondence(targetId: string, sourceId: string): void {
    if (!sourceId) return;
    setCorrespondences((current) => {
      const existing = current[targetId] ?? [];
      if (existing.includes(sourceId)) return current;
      return { ...current, [targetId]: [...existing, sourceId] };
    });
    setPickerByTarget((current) => ({ ...current, [targetId]: '' }));
  }

  function removeCorrespondence(targetId: string, sourceId: string): void {
    setCorrespondences((current) => ({
      ...current,
      [targetId]: (current[targetId] ?? []).filter((id) => id !== sourceId),
    }));
  }

  async function handleSubmit(): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const entries: MappingMigrationCorrespondence[] = Object.entries(correspondences)
        .filter(([, sourceIds]) => sourceIds.length > 0)
        .map(([targetRequirementId, sourceRequirementIds]) => ({
          targetRequirementId,
          sourceRequirementIds,
        }));
      const detail = await complianceApi.executeMappingMigration(frameworkId, targetVersionId, {
        sourceFrameworkVersionId: sourceVersionId,
        correspondences: entries,
      });
      feedback.success(compliance.mappingMigration.executeSuccess);
      setResult(detail);
      onExecuted(detail);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? (error.problem.detail ?? compliance.mappingMigration.dialog.genericError)
          : compliance.mappingMigration.dialog.genericError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function sourceLabelFor(id: string): string {
    const found = (sourceRequirements ?? []).find((requirement) => requirement.id === id);
    return found ? `${found.externalRef} — ${found.title}` : id;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{compliance.mappingMigration.dialog.title}</DialogTitle>
          {!result ? (
            <DialogDescription>{compliance.mappingMigration.dialog.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {result ? (
          <div className="flex min-w-0 flex-col gap-4">
            {result.pendingDecisionCount > 0 ? (
              <p
                role="status"
                className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg"
              >
                {compliance.mappingMigration.resultPendingNotice(result.pendingDecisionCount)}
              </p>
            ) : null}
            <MappingMigrationItemsTable items={result.items} />
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {compliance.mappingMigration.resultCloseAction}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {submitError ? (
              <p role="alert" className="text-sm font-medium text-status-danger-fg">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mapping-migration-source"
                className="text-sm font-medium text-foreground"
              >
                {compliance.mappingMigration.dialog.sourceVersionLabel}
              </label>
              <Select
                value={sourceVersionId}
                onValueChange={handleSourceVersionChange}
                disabled={submitting}
              >
                <SelectTrigger id="mapping-migration-source">
                  <SelectValue
                    placeholder={compliance.mappingMigration.dialog.sourceVersionPlaceholder}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions === null ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">…</div>
                  ) : sourceOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {compliance.mappingMigration.dialog.sourceVersionNoOptions}
                    </div>
                  ) : (
                    sourceOptions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {sourceVersionId ? (
              loadingRequirements ? (
                <p className="text-sm text-muted-foreground">
                  {compliance.mappingMigration.dialog.loadingRequirements}
                </p>
              ) : requirementsError ? (
                <p role="alert" className="text-sm font-medium text-status-danger-fg">
                  {compliance.mappingMigration.dialog.loadRequirementsError}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(targetRequirements ?? []).map((target) => {
                    const chosen = correspondences[target.id] ?? [];
                    const availableSources = (sourceRequirements ?? []).filter(
                      (source) => !chosen.includes(source.id),
                    );
                    return (
                      <div
                        key={target.id}
                        className="flex flex-col gap-2 rounded-md border border-border p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {compliance.mappingMigration.dialog.targetColumnLabel}
                          </span>
                          <span className="font-medium text-foreground">
                            {target.externalRef} — {target.title}
                          </span>
                        </div>

                        {chosen.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {chosen.map((sourceId) => (
                              <Badge key={sourceId} variant="secondary" className="gap-1">
                                {sourceLabelFor(sourceId)}
                                <button
                                  type="button"
                                  onClick={() => removeCorrespondence(target.id, sourceId)}
                                  aria-label={`${compliance.mappingMigration.dialog.removeAction}: ${sourceLabelFor(sourceId)}`}
                                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <X aria-hidden="true" className="size-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {compliance.mappingMigration.dialog.noCorrespondenceHint}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={pickerByTarget[target.id] ?? ''}
                            onValueChange={(value) =>
                              setPickerByTarget((current) => ({ ...current, [target.id]: value }))
                            }
                            disabled={submitting}
                          >
                            <SelectTrigger
                              className="w-64"
                              aria-label={compliance.mappingMigration.dialog.sourcePickerLabel}
                            >
                              <SelectValue
                                placeholder={
                                  compliance.mappingMigration.dialog.sourcePickerPlaceholder
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSources.length === 0 ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {compliance.mappingMigration.dialog.sourcePickerNoOptions}
                                </div>
                              ) : (
                                availableSources.map((source) => (
                                  <SelectItem key={source.id} value={source.id}>
                                    {source.externalRef} — {source.title}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!pickerByTarget[target.id] || submitting}
                            onClick={() =>
                              addCorrespondence(target.id, pickerByTarget[target.id] ?? '')
                            }
                          >
                            <Plus aria-hidden="true" className="size-4" />
                            {compliance.mappingMigration.dialog.addAction}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
              >
                {compliance.mappingMigration.dialog.cancel}
              </Button>
              <Button
                type="button"
                disabled={!sourceVersionId || loadingRequirements || submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {submitting
                  ? compliance.mappingMigration.dialog.submitting
                  : compliance.mappingMigration.dialog.submit}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
