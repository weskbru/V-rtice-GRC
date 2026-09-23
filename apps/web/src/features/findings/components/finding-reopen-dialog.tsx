'use client';

import { FormField } from '@pharos/design-system/components';
import { useState } from 'react';

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
import { findings as findingsMessages } from '@/lib/messages/findings';

import { findingsApi } from '../api';

import type { Finding } from '../types';

export interface FindingReopenDialogProps {
  finding: Finding | null;
  onOpenChange: (open: boolean) => void;
  onReopened: (finding: Finding) => void;
}

export function FindingReopenDialog({
  finding,
  onOpenChange,
  onReopened,
}: FindingReopenDialogProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const fieldError =
    touched && trimmed.length === 0 ? findingsMessages.reopen.reasonRequired : undefined;

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
    if (!finding || trimmed.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const reopened = await findingsApi.reopenFinding(finding.id, { reason: trimmed });
      handleOpenChange(false);
      onReopened(reopened);
    } catch (submitError) {
      const fallback = findingsMessages.form.genericError;
      setError(
        submitError instanceof ApiError ? (submitError.problem.detail ?? fallback) : fallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={finding !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{findingsMessages.reopen.title}</DialogTitle>
          <DialogDescription>{findingsMessages.reopen.description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField label={findingsMessages.reopen.reasonLabel} required error={fieldError}>
          {(field) => (
            <Textarea
              {...field}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={findingsMessages.reopen.reasonPlaceholder}
              rows={4}
              disabled={submitting}
              autoFocus
            />
          )}
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {findingsMessages.reopen.cancel}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting}>
            {findingsMessages.reopen.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
