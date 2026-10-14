'use client';

import { Ban, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { common } from '@/lib/messages/common';
import { processes } from '@/lib/messages/processes';
import { ConfirmDialog } from '@vertice/design-system/components';

import { processesApi } from '../api';

import type { ProcessDetail } from '../types';

export interface ProcessLifecycleActionsProps {
  process: ProcessDetail;
  canAdminister: boolean;
  onChanged: (process: ProcessDetail) => void;
}

type PendingAction = 'deactivate' | 'reactivate' | null;

export function ProcessLifecycleActions({
  process,
  canAdminister,
  onChanged,
}: ProcessLifecycleActionsProps): React.JSX.Element | null {
  const lifecycle = processes.lifecycle;
  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!canAdminister) {
    return null;
  }

  function closeDialog(): void {
    if (submitting) return;
    setPending(null);
    setActionError(null);
  }

  async function handleDeactivate(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await processesApi.deactivateProcess(process.id);
      feedback.success(lifecycle.deactivate.success);
      closeDialog();
      onChanged(updated);
    } catch {
      setActionError(lifecycle.deactivate.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await processesApi.reactivateProcess(process.id);
      feedback.success(lifecycle.reactivate.success);
      closeDialog();
      onChanged(updated);
    } catch {
      setActionError(lifecycle.reactivate.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{lifecycle.cardTitle}</CardTitle>
        <CardDescription>{lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {process.isActive ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => setPending('deactivate')}
          >
            <Ban aria-hidden="true" className="size-4" />
            {lifecycle.deactivate.action}
          </Button>
        ) : (
          <Button type="button" className="w-fit" onClick={() => setPending('reactivate')}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {lifecycle.reactivate.action}
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={pending === 'deactivate'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.deactivate.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.deactivate.confirmDescription
          )
        }
        labels={{
          confirm: submitting
            ? lifecycle.deactivate.confirming
            : lifecycle.deactivate.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="sensitive"
        icon={Ban}
        isConfirming={submitting}
        onConfirm={() => void handleDeactivate()}
      />

      <ConfirmDialog
        open={pending === 'reactivate'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.reactivate.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.reactivate.confirmDescription
          )
        }
        labels={{
          confirm: submitting
            ? lifecycle.reactivate.confirming
            : lifecycle.reactivate.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="default"
        icon={RotateCcw}
        isConfirming={submitting}
        onConfirm={() => void handleReactivate()}
      />
    </Card>
  );
}
