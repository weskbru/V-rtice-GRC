'use client';

import { Loader2, MinusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import {
  ConfirmDialog,
  EmptyValue,
  FormField,
  StatusBadge,
} from '@vertice/design-system/components';

import { complianceApi } from '../api';
import { formatTimestampDate } from '../date';

import type { RequirementApplicability } from '../types';

export interface RequirementApplicabilitySectionProps {
  requirementId: string;
  canAdminister: boolean;
  onChanged: () => void;
}

export function RequirementApplicabilitySection({
  requirementId,
  canAdminister,
  onChanged,
}: RequirementApplicabilitySectionProps): React.JSX.Element {
  const [declarations, setDeclarations] = useState<readonly RequirementApplicability[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [hasControlLinks, setHasControlLinks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .listRequirementControlLinks(requirementId)
      .then((links) => {
        if (!cancelled) setHasControlLinks(links.some((link) => link.unlinkedAt === null));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [requirementId, reloadToken]);

  const [declaring, setDeclaring] = useState(false);
  const [justification, setJustification] = useState('');
  const [justificationError, setJustificationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [revoking, setRevoking] = useState(false);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .listRequirementApplicabilityDeclarations(requirementId, 1, 100)
      .then((page) => {
        if (!cancelled) {
          setDeclarations(page.data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requirementId, reloadToken]);

  const active = declarations.find((entry) => entry.revokedAt === null) ?? null;

  function openDeclareDialog(): void {
    setJustification('');
    setJustificationError(null);
    setFormError(null);
    setDeclaring(true);
  }

  async function handleDeclare(): Promise<void> {
    setFormError(null);
    if (!justification.trim()) {
      setJustificationError(compliance.applicability.declareDialog.justificationRequired);
      return;
    }
    setJustificationError(null);
    setSubmitting(true);
    try {
      await complianceApi.declareRequirementNotApplicable(requirementId, {
        justification: justification.trim(),
      });
      feedback.success(compliance.applicability.declareSuccess);
      setDeclaring(false);
      setReloadToken((token) => token + 1);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setFormError(compliance.applicability.alreadyDeclaredError);
      } else {
        setFormError(compliance.applicability.declareError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(): Promise<void> {
    if (!active) return;
    setRevokeSubmitting(true);
    try {
      await complianceApi.revokeRequirementApplicabilityDeclaration(requirementId, active.id);
      feedback.success(compliance.applicability.revokeSuccess);
      setRevoking(false);
      setReloadToken((token) => token + 1);
      onChanged();
    } catch {
      feedback.error(compliance.applicability.revokeError);
    } finally {
      setRevokeSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {active ? (
        <div
          role="note"
          className="flex flex-col gap-2 rounded-md border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg"
        >
          <div className="flex items-start gap-2">
            <MinusCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">{compliance.applicability.activeNotice}</p>
              {hasControlLinks ? <p>{compliance.applicability.activeWithLinksNotice}</p> : null}
              <p>
                {compliance.applicability.justificationLabel}: {active.justification}
              </p>
              <p className="text-xs opacity-80">
                {compliance.applicability.declaredBy(
                  active.declaredBy.fullName,
                  formatTimestampDate(active.declaredAt),
                )}
              </p>
            </div>
          </div>
          {canAdminister ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setRevoking(true)}
            >
              {compliance.applicability.revokeAction}
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          role="note"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          <span>{compliance.applicability.defaultNotice}</span>
          {canAdminister ? (
            <Button type="button" variant="outline" size="sm" onClick={openDeclareDialog}>
              {compliance.applicability.declareAction}
            </Button>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {compliance.applicability.historyTitle}
        </h3>
        {loadError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {compliance.applicability.declareError}
          </p>
        ) : declarations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{compliance.applicability.historyEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">
                {compliance.applicability.historyTitle}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="sr-only">Status</TableHead>
                  <TableHead>{compliance.applicability.historyColumns.justification}</TableHead>
                  <TableHead>{compliance.applicability.historyColumns.declaredBy}</TableHead>
                  <TableHead>{compliance.applicability.historyColumns.declaredAt}</TableHead>
                  <TableHead>{compliance.applicability.historyColumns.revokedBy}</TableHead>
                  <TableHead>{compliance.applicability.historyColumns.revokedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {declarations.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <StatusBadge
                        variant={entry.revokedAt === null ? 'warning' : 'neutral'}
                        label={
                          entry.revokedAt === null
                            ? compliance.applicability.currentBadge
                            : compliance.applicability.revokedBadge
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={entry.justification}>
                      {entry.justification}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.declaredBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(entry.declaredAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {entry.revokedBy ? entry.revokedBy.fullName : <EmptyValue>—</EmptyValue>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {entry.revokedAt ? (
                        formatTimestampDate(entry.revokedAt)
                      ) : (
                        <EmptyValue>—</EmptyValue>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={declaring} onOpenChange={(open) => !submitting && setDeclaring(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{compliance.applicability.declareDialog.title}</DialogTitle>
            <DialogDescription>
              {compliance.applicability.declareDialog.description}
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <p role="alert" className="text-sm font-medium text-status-danger-fg">
              {formError}
            </p>
          ) : null}

          <FormField
            label={compliance.applicability.declareDialog.justificationLabel}
            required
            error={justificationError ?? undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                placeholder={compliance.applicability.declareDialog.justificationPlaceholder}
                rows={4}
                disabled={submitting}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => setDeclaring(false)}
            >
              {common.actions.cancel}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleDeclare()}>
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting
                ? compliance.applicability.declareDialog.submitting
                : compliance.applicability.declareDialog.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={compliance.applicability.revokeConfirm.title}
        description={compliance.applicability.revokeConfirm.description}
        labels={{
          confirm: compliance.applicability.revokeAction,
          cancel: common.actions.cancel,
          close: common.dialog.closeLabel,
        }}
        isConfirming={revokeSubmitting}
        onConfirm={() => void handleRevoke()}
      />
    </div>
  );
}
