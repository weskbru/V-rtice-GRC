'use client';

/**
 * PharosGRC — audit engagement detail, lifecycle action bar (T076, US1,
 * FR-002 to FR-004a, research.md D-3).
 *
 * Unlike `ControlLifecycleActions`, this contract has no `GET
 * /audits/{auditId}/lifecycle` endpoint returning a precomputed transition
 * table — `contracts/audit.openapi.yaml` exposes only the three POST
 * transitions themselves. The (small, closed) transition table is
 * therefore encoded once, locally, straight from `research.md` D-3 and
 * FR-004a, verified against `quickstart.md` §2:
 *
 *   - `PLANNING`    -> `IN_PROGRESS` (start, requires ≥1 scope link, FR-003)
 *   - `PLANNING`    -> `CANCELLED`   (cancel, requires justification, FR-004a)
 *   - `IN_PROGRESS` -> `COMPLETED`   (complete)
 *   - `IN_PROGRESS` -> `CANCELLED`   (cancel, requires justification, FR-004a)
 *   - `COMPLETED`/`CANCELLED` — both terminal, no further transition.
 *
 * Start's own precondition (at least one scope link) is checked
 * client-side too — via `listScope`, the same read the detail screen's own
 * `AuditScopeSection` uses — so the "sem escopo" fact is communicated
 * BEFORE the attempt (`lifecycle.start.noScopeNotice`), not only after a
 * `422` (CLAUDE.md §18.11). This is advisory only: the server re-validates
 * independently and this component still handles the `422` reactively
 * (`noScopeError`) for the race where scope changes between this read and
 * the click.
 */
import { ConfirmDialog, FormField } from '@pharos/design-system/components';
import { Ban, CheckCircle2, Loader2, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';

import { auditEngagementsApi, type AuditEngagementWithEtag } from '../api';

import type { AuditEngagement } from '../types';

export interface AuditEngagementLifecycleActionsProps {
  engagement: AuditEngagement;
  /** The engagement's current `ETag` — required by every transition. */
  etag: string;
  /**
   * Bumped by the owning screen whenever a scope entry is added, so this
   * component re-reads the scope count (FR-003's own start precondition).
   *
   * Not cosmetic, and not derivable from `etag`: adding a scope entry
   * writes `audit_scope_*`, never `audit_engagements`, so the engagement's
   * own `version`/`ETag` is UNCHANGED by it. Keying the effect below on
   * `etag` alone therefore left "Iniciar engajamento" disabled, with its
   * "adicione ao menos um item ao escopo" notice still showing, on a screen
   * whose scope table right below it already listed the entry that had just
   * been saved. Only a page reload cleared it.
   *
   * That is the defect shape AGENTS.md names under "Frontend state" —
   * correct in the database, stale on screen, every test green — and it was
   * found by looking at the rendered page (CLAUDE.md §18.1), not by any
   * gate. A change TOKEN rather than the fetched entries themselves: this
   * component still performs its own read, so nothing is drilled down as
   * props from an ancestor.
   */
  scopeChangeToken: number;
  onChanged: (result: AuditEngagementWithEtag) => void;
}

type PendingAction = 'start' | 'complete' | 'cancel' | null;

export function AuditEngagementLifecycleActions({
  engagement,
  etag,
  scopeChangeToken,
  onChanged,
}: AuditEngagementLifecycleActionsProps): React.JSX.Element {
  const lifecycle = auditEngagements.lifecycle;

  const [scopeCount, setScopeCount] = useState<number | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState(false);

  useEffect(() => {
    if (engagement.status !== 'PLANNING') {
      return;
    }
    let cancelled = false;

    async function run(): Promise<void> {
      setScopeCount(null);
      setScopeLoadError(false);
      try {
        const entries = await auditEngagementsApi.listScope(engagement.id);
        if (!cancelled) setScopeCount(entries.length);
      } catch {
        if (!cancelled) setScopeLoadError(true);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [engagement.id, engagement.status, etag, scopeChangeToken]);

  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [justificationError, setJustificationError] = useState<string | null>(null);

  function closeDialog(): void {
    if (submitting) return;
    setPending(null);
    setActionError(null);
    setJustification('');
    setJustificationError(null);
  }

  function resolveError(error: unknown, fallback: string, on422?: string): string {
    if (error instanceof ApiError) {
      if (error.problem.status === 409) return lifecycle.conflictError;
      if (error.problem.status === 422 && on422) return on422;
    }
    return fallback;
  }

  async function handleStart(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await auditEngagementsApi.startEngagement(engagement.id, etag);
      feedback.success(lifecycle.start.success);
      closeDialog();
      onChanged(result);
    } catch (error) {
      setActionError(
        resolveError(error, lifecycle.start.genericError, lifecycle.start.noScopeError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await auditEngagementsApi.completeEngagement(engagement.id, etag);
      feedback.success(lifecycle.complete.success);
      closeDialog();
      onChanged(result);
    } catch (error) {
      setActionError(resolveError(error, lifecycle.complete.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!justification.trim()) {
      setJustificationError(lifecycle.cancel.justificationRequired);
      return;
    }
    setJustificationError(null);
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await auditEngagementsApi.cancelEngagement(
        engagement.id,
        { justification: justification.trim() },
        etag,
      );
      feedback.success(lifecycle.cancel.success);
      closeDialog();
      onChanged(result);
    } catch (error) {
      setActionError(resolveError(error, lifecycle.cancel.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  const canStart = engagement.status === 'PLANNING';
  const canComplete = engagement.status === 'IN_PROGRESS';
  const canCancel = engagement.status === 'PLANNING' || engagement.status === 'IN_PROGRESS';
  const hasAnyAction = canStart || canComplete || canCancel;

  const scopeKnownEmpty = canStart && scopeCount === 0;
  const startDisabled = canStart && (scopeCount === null || scopeCount === 0) && !scopeLoadError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{lifecycle.cardTitle}</CardTitle>
        <CardDescription>{lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-4"
        aria-label={auditEngagements.aria.lifecycleRegionLabel}
      >
        {!hasAnyAction ? (
          <p className="text-sm text-muted-foreground">{lifecycle.noneAvailable}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {canStart ? (
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  className="w-fit"
                  disabled={startDisabled}
                  onClick={() => setPending('start')}
                >
                  <PlayCircle aria-hidden="true" className="size-4" />
                  {lifecycle.start.action}
                </Button>
                {scopeKnownEmpty ? (
                  <p className="pl-1 text-sm text-status-warning-fg">
                    {lifecycle.start.noScopeNotice}
                  </p>
                ) : null}
                {scopeLoadError ? (
                  <p className="pl-1 text-sm text-status-warning-fg">{lifecycle.scopeLoadError}</p>
                ) : null}
              </div>
            ) : null}

            {canComplete ? (
              <Button type="button" className="w-fit" onClick={() => setPending('complete')}>
                <CheckCircle2 aria-hidden="true" className="size-4" />
                {lifecycle.complete.action}
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                type="button"
                variant="destructive"
                className="w-fit"
                onClick={() => setPending('cancel')}
              >
                <Ban aria-hidden="true" className="size-4" />
                {lifecycle.cancel.action}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={pending === 'start'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.start.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.start.confirmDescription
          )
        }
        labels={{
          confirm: submitting ? lifecycle.start.starting : lifecycle.start.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        isConfirming={submitting}
        onConfirm={() => void handleStart()}
      />

      <ConfirmDialog
        open={pending === 'complete'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.complete.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.complete.confirmDescription
          )
        }
        labels={{
          confirm: submitting ? lifecycle.complete.completing : lifecycle.complete.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        isConfirming={submitting}
        onConfirm={() => void handleComplete()}
      />

      <Dialog
        open={pending === 'cancel'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lifecycle.cancel.confirmTitle}</DialogTitle>
            <DialogDescription>{lifecycle.cancel.confirmDescription}</DialogDescription>
          </DialogHeader>

          {actionError ? (
            <p role="alert" className="text-sm font-medium text-status-danger-fg">
              {actionError}
            </p>
          ) : null}

          <FormField
            label={lifecycle.cancel.justificationLabel}
            required
            description={lifecycle.cancel.justificationHelper}
            error={justificationError ?? undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                value={justification}
                onChange={(event) => {
                  setJustification(event.target.value);
                  setJustificationError(null);
                }}
                rows={3}
                disabled={submitting}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={submitting} onClick={closeDialog}>
              {lifecycle.cancel.dismissAction}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleCancel()}
            >
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting ? lifecycle.cancel.cancelling : lifecycle.cancel.confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
