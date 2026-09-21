'use client';

/**
 * PharosGRC — problem lifecycle transition dialog (008-incidents-problems,
 * US2), covering every transition EXCEPT `toStatus: CLOSED` (that one has
 * its own dedicated `ProblemCloseDialog`, below, for the proactive
 * legibility CLAUDE.md §18.11 asks for). Handles `startAnalysis` (no
 * field), `resolve` (`rootCause`, required), `cancel`
 * (`cancellationReason`, required), and `reopen` (`reopenReason`,
 * required) — the field shown and its requiredness come from
 * `availableProblemTransitions`' own `requiredField`, never a second,
 * independent guess at which transition needs what.
 *
 * Client-side non-empty validation runs before the request is even sent
 * (immediate feedback, no round trip needed to know a blank reason is
 * wrong) — the server's own `422` remains the authoritative check
 * regardless (`incident.entity.ts`'s sibling on the Problems side).
 */
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
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
import { problems } from '@/lib/messages/problems';

import { problemsApi } from '../api';

import type { ProblemTransitionField, ProblemTransitionOption } from '../status';
import type { ProblemDetail } from '../types';

const FIELD_LABEL: Record<ProblemTransitionField, string> = {
  rootCause: problems.lifecycle.fields.rootCause,
  cancellationReason: problems.lifecycle.fields.cancellationReason,
  reopenReason: problems.lifecycle.fields.reopenReason,
};

const FIELD_VALIDATION_MESSAGE: Record<ProblemTransitionField, string> = {
  rootCause: problems.lifecycle.validation.rootCauseRequired,
  cancellationReason: problems.lifecycle.validation.cancellationReasonRequired,
  reopenReason: problems.lifecycle.validation.reopenReasonRequired,
};

const CONFIRM_COPY: Record<string, { readonly title: string; readonly description: string }> = {
  IN_ANALYSIS_FROM_OPEN: problems.lifecycle.confirm.startAnalysis,
  RESOLVED: problems.lifecycle.confirm.resolve,
  CANCELLED: problems.lifecycle.confirm.cancel,
  IN_ANALYSIS_FROM_RESOLVED: problems.lifecycle.confirm.reopen,
};

function confirmCopyFor(option: ProblemTransitionOption, fromStatus: ProblemDetail['status']) {
  if (option.to === 'IN_ANALYSIS' && fromStatus === 'OPEN') {
    return CONFIRM_COPY.IN_ANALYSIS_FROM_OPEN;
  }
  if (option.to === 'IN_ANALYSIS' && fromStatus === 'RESOLVED') {
    return CONFIRM_COPY.IN_ANALYSIS_FROM_RESOLVED;
  }
  return CONFIRM_COPY[option.to];
}

export interface ProblemTransitionDialogProps {
  problem: ProblemDetail | null;
  option: ProblemTransitionOption | null;
  onOpenChange: (open: boolean) => void;
  onTransitioned: (problem: ProblemDetail) => void;
}

export function ProblemTransitionDialog({
  problem,
  option,
  onOpenChange,
  onTransitioned,
}: ProblemTransitionDialogProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const open = problem !== null && option !== null;

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setValue('');
      setError(null);
      setValidationError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm(): Promise<void> {
    if (!problem || !option) return;

    if (option.requiredField && !value.trim()) {
      setValidationError(FIELD_VALIDATION_MESSAGE[option.requiredField]);
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setError(null);
    try {
      const updated = await problemsApi.transition(problem.id, {
        toStatus: option.to,
        rootCause: option.requiredField === 'rootCause' ? value.trim() : undefined,
        cancellationReason:
          option.requiredField === 'cancellationReason' ? value.trim() : undefined,
        reopenReason: option.requiredField === 'reopenReason' ? value.trim() : undefined,
      });
      handleOpenChange(false);
      onTransitioned(updated);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.problem.status === 422) {
        setError(submitError.problem.detail ?? problems.lifecycle.illegalTransitionError);
      } else if (submitError instanceof ApiError && submitError.problem.detail) {
        setError(submitError.problem.detail);
      } else {
        setError(problems.lifecycle.transitionError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const copy = option && problem ? confirmCopyFor(option, problem.status) : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        {option?.requiredField ? (
          <FormField
            label={FIELD_LABEL[option.requiredField]}
            required
            error={validationError ?? undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                rows={3}
                disabled={submitting}
                autoFocus
              />
            )}
          </FormField>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {problems.lifecycle.dialog.cancelAction}
          </Button>
          <Button
            type="button"
            variant={option?.to === 'CANCELLED' ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? problems.lifecycle.dialog.confirmingAction
              : problems.lifecycle.dialog.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
