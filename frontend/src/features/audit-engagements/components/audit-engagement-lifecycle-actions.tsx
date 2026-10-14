'use client';

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
import { ConfirmDialog, FormField } from '@vertice/design-system/components';

import { auditEngagementsApi, type AuditEngagementWithEtag } from '../api';

import type { AuditEngagement } from '../types';

export interface AuditEngagementLifecycleActionsProps {
  engagement: AuditEngagement;
  etag: string;
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
