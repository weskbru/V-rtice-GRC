'use client';

/**
 * PharosGRC — incident lifecycle transition dialog (008-incidents-problems,
 * US1), mirroring `ReopenActionDialog`'s shape (CLAUDE.md §18.12), made
 * adaptive across `IncidentTransitionOption.requiredField` instead of one
 * dialog per transition: `resolve`/`cancel`/`reopen` each render the
 * `Textarea` for their own required field (data-model.md invariants I1/I2
 * and the reopen edge's own requirement — "the form has to ask for it
 * rather than letting the server reject an empty one"); `close` renders the
 * SAME confirmation shell with no field, since `incidents.lifecycle.confirm
 * .close` still exists to warn that descriptive fields stop being editable.
 * `start` (`OPEN -> IN_PROGRESS`) never reaches this component at all — its
 * `confirmKey` is `undefined`, so the caller (`IncidentLifecycleActions`)
 * applies it immediately.
 *
 * The client-side non-empty check on the required field is a courtesy that
 * saves a round trip, never the actual gate — `POST /incidents/{id}
 * /transitions` re-validates every transition and its required field
 * independently (CLAUDE.md §18.9); this dialog's `error` state renders
 * whatever the server actually says on a 422.
 */
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
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';

import { incidentsApi } from '../api';

import type { IncidentTransitionOption } from '../status';
import type { IncidentDetail, TransitionIncidentRequest } from '../types';

export interface IncidentTransitionDialogProps {
  incident: IncidentDetail;
  option: IncidentTransitionOption | null;
  onOpenChange: (open: boolean) => void;
  onTransitioned: (updated: IncidentDetail) => void;
}

export function IncidentTransitionDialog({
  incident,
  option,
  onOpenChange,
  onTransitioned,
}: IncidentTransitionDialogProps): React.JSX.Element {
  const [fieldValue, setFieldValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = fieldValue.trim();
  const requiresField = option?.requiredField !== undefined;
  const fieldError =
    requiresField && touched && trimmed.length === 0
      ? incidents.lifecycle.fieldRequiredError
      : undefined;

  function handleOpenChange(open: boolean): void {
    if (submitting) return;
    if (!open) {
      setFieldValue('');
      setTouched(false);
      setError(null);
    }
    onOpenChange(open);
  }

  async function handleConfirm(): Promise<void> {
    if (!option) return;
    if (requiresField) {
      setTouched(true);
      if (trimmed.length === 0) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: TransitionIncidentRequest = { toStatus: option.to };
      if (option.requiredField) {
        body[option.requiredField] = trimmed;
      }
      const updated = await incidentsApi.transition(incident.id, body);
      feedback.success(option.label);
      handleOpenChange(false);
      onTransitioned(updated);
    } catch (submitError) {
      const fallback = incidents.lifecycle.transitionError;
      setError(
        submitError instanceof ApiError ? (submitError.problem.detail ?? fallback) : fallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const confirmCopy = option ? incidents.lifecycle.confirm[option.confirmKey ?? 'close'] : null;
  const fieldLabel = option?.requiredField
    ? incidents.lifecycle.fields[option.requiredField]
    : undefined;

  return (
    <Dialog open={option !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmCopy?.title}</DialogTitle>
          <DialogDescription>{confirmCopy?.description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        {requiresField && fieldLabel ? (
          <FormField label={fieldLabel} required error={fieldError}>
            {(field) => (
              <Textarea
                {...field}
                value={fieldValue}
                onChange={(event) => setFieldValue(event.target.value)}
                onBlur={() => setTouched(true)}
                rows={4}
                disabled={submitting}
                autoFocus
              />
            )}
          </FormField>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {common.confirmDialog.cancel}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting}>
            {option?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
