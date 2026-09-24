'use client';

import { FormField } from '@pharos/design-system/components';
import { useState } from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';

import { actionsApi } from '../api';

import type { Action } from '../types';

export interface ReopenActionDialogProps {
  action: Pick<Action, 'id'> | null;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
  onConfirm?: (reason: string) => Promise<void>;
}

export function ReopenActionDialog({
  action,
  onOpenChange,
  onApplied,
  onConfirm,
}: ReopenActionDialogProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const fieldError =
    touched && trimmed.length === 0
      ? actions.myActions.transitions.reopenReasonRequired
      : undefined;

  function handleOpenChange(open: boolean): void {
    if (submitting) return;
    if (!open) {
      setReason('');
      setTouched(false);
      setError(null);
    }
    onOpenChange(open);
  }

  async function handleConfirm(): Promise<void> {
    setTouched(true);
    if (!action || trimmed.length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (onConfirm) {
        await onConfirm(trimmed);
      } else {
        await actionsApi.transitionAction(action.id, { to: 'OPEN', reason: trimmed });
      }
      feedback.success(actions.myActions.transitions.reopenSuccess);
      handleOpenChange(false);
      onApplied();
    } catch (submitError) {
      const fallback = actions.myActions.transitions.transitionFailed;
      setError(
        submitError instanceof ApiError
          ? (submitError.problem.detail ?? fallback)
          : submitError instanceof Error && submitError.message.length > 0
            ? submitError.message
            : fallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={action !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actions.myActions.transitions.reopenTitle}</DialogTitle>
          <DialogDescription>{actions.myActions.transitions.reopenDescription}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={actions.myActions.transitions.reopenReasonLabel}
          required
          error={fieldError}
        >
          {(field) => (
            <Textarea
              {...field}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={actions.myActions.transitions.reopenReasonPlaceholder}
              rows={4}
              disabled={submitting}
              autoFocus
            />
          )}
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {actions.myActions.transitions.cancelDialog}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting}>
            {actions.myActions.transitions.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
