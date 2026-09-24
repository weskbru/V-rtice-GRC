'use client';

import { FormField } from '@pharos/design-system/components';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
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
import { controls } from '@/lib/messages/controls';

import { controlsApi } from '../api';
import { controlStatusLabel } from '../status';

import type { AvailableControlTransition } from '../types';

export interface ControlLifecycleActionsProps {
  controlId: string;
  etag: string;
  availableTransitions: readonly AvailableControlTransition[];
  onChanged: () => void;
}

function TransitionConfirmDialog({
  open,
  onOpenChange,
  controlId,
  etag,
  transition,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
  etag: string;
  transition: AvailableControlTransition | null;
  onApplied: () => void;
}): React.JSX.Element {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setJustification('');
      setError(null);
      setValidationError(null);
    }
    onOpenChange(next);
  }

  const isRetirement = transition?.toStatus === 'RETIRED';
  const targetLabel = transition ? controlStatusLabel(transition.toStatus) : '';

  async function handleConfirm(): Promise<void> {
    if (!transition) return;
    if (isRetirement && !justification.trim()) {
      setValidationError(controls.lifecycle.transitionDialog.justificationRequiredForRetirement);
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setError(null);
    try {
      await controlsApi.transitionControl(
        controlId,
        {
          toStatus: transition.toStatus,
          justification: justification.trim() ? justification.trim() : undefined,
        },
        etag,
      );
      feedback.success(controls.lifecycle.transitionDialog.submitSuccess(targetLabel));
      handleOpenChange(false);
      onApplied();
    } catch (submitError) {
      const fallback =
        submitError instanceof ApiError && submitError.problem.status === 409
          ? controls.lifecycle.transitionDialog.conflictError
          : controls.lifecycle.transitionDialog.genericError;
      setError(
        submitError instanceof ApiError ? (submitError.problem.detail ?? fallback) : fallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{controls.lifecycle.transitionDialog.title(targetLabel)}</DialogTitle>
          <DialogDescription>
            {controls.lifecycle.transitionDialog.description(targetLabel)}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={controls.lifecycle.transitionDialog.justificationLabel}
          required={isRetirement}
          optionalIndicator={isRetirement ? undefined : common.formField.optionalIndicator}
          description={
            isRetirement
              ? controls.lifecycle.transitionDialog.justificationDescriptionRetirement
              : controls.lifecycle.transitionDialog.justificationDescriptionDefault
          }
          error={validationError ?? undefined}
        >
          {(field) => (
            <Textarea
              {...field}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              disabled={submitting}
            />
          )}
        </FormField>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {controls.lifecycle.transitionDialog.cancelAction}
          </Button>
          <Button
            type="button"
            variant={isRetirement ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? controls.lifecycle.transitionDialog.confirmingAction
              : controls.lifecycle.transitionDialog.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ControlLifecycleActions({
  controlId,
  etag,
  availableTransitions,
  onChanged,
}: ControlLifecycleActionsProps): React.JSX.Element {
  const [pendingTransition, setPendingTransition] = useState<AvailableControlTransition | null>(
    null,
  );

  return (
    <>
      {availableTransitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{controls.lifecycle.noneAvailable}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {availableTransitions.map((transition) => (
            <div key={transition.toStatus} className="flex flex-col gap-1">
              <Button
                type="button"
                variant={transition.toStatus === 'RETIRED' ? 'destructive' : 'default'}
                disabled={!transition.preconditionsMet}
                className="w-fit"
                onClick={() => setPendingTransition(transition)}
              >
                <ArrowRightCircle aria-hidden="true" className="size-4" />
                {controls.lifecycle.actions.apply(controlStatusLabel(transition.toStatus))}
              </Button>
              {!transition.preconditionsMet &&
              transition.unmetPreconditions &&
              transition.unmetPreconditions.length > 0 ? (
                <div className="pl-1 text-sm text-status-warning-fg">
                  <p className="font-medium">{controls.lifecycle.unmetPreconditionsTitle}</p>
                  <ul className="list-disc pl-5">
                    {transition.unmetPreconditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <TransitionConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null);
        }}
        controlId={controlId}
        etag={etag}
        transition={pendingTransition}
        onApplied={() => {
          setPendingTransition(null);
          onChanged();
        }}
      />
    </>
  );
}
