'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { problems } from '@/lib/messages/problems';

import { problemsApi } from '../api';

import type { ProblemDetail } from '../types';

type CorrectiveActionResult = 'present' | 'missing' | 'unknown';

export interface ProblemCloseDialogProps {
  problem: ProblemDetail | null;
  onOpenChange: (open: boolean) => void;
  onClosed: (problem: ProblemDetail) => void;
}

export function ProblemCloseDialog({
  problem,
  onOpenChange,
  onClosed,
}: ProblemCloseDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<CorrectiveActionResult>('present');
  const [resolvedProblemId, setResolvedProblemId] = useState<string | null>(null);

  const problemId = problem?.id ?? null;
  const checkState: CorrectiveActionResult | 'checking' =
    problemId !== null && resolvedProblemId !== problemId ? 'checking' : actionResult;

  useEffect(() => {
    if (!problemId) return;
    let cancelled = false;
    problemsApi
      .hasCompletedCorrectiveAction(problemId)
      .then((present) => {
        if (!cancelled) setActionResult(present ? 'present' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setActionResult('unknown');
      })
      .finally(() => {
        if (!cancelled) setResolvedProblemId(problemId);
      });
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  function handleOpenChange(open: boolean): void {
    if (submitting) return;
    if (!open) setError(null);
    onOpenChange(open);
  }

  async function handleConfirm(): Promise<void> {
    if (!problem) return;
    setSubmitting(true);
    setError(null);
    try {
      const closed = await problemsApi.transition(problem.id, { toStatus: 'CLOSED' });
      handleOpenChange(false);
      onClosed(closed);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.problem.status === 403) {
        setError(problems.lifecycle.closeSameUserError);
      } else if (submitError instanceof ApiError && submitError.problem.status === 422) {
        setError(
          checkState === 'missing'
            ? problems.lifecycle.closeMissingActionError
            : (submitError.problem.detail ?? problems.lifecycle.transitionError),
        );
      } else if (submitError instanceof ApiError && submitError.problem.detail) {
        setError(submitError.problem.detail);
      } else {
        setError(problems.lifecycle.transitionError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={problem !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{problems.lifecycle.confirm.close.title}</DialogTitle>
          <DialogDescription>{problems.lifecycle.confirm.close.description}</DialogDescription>
        </DialogHeader>

        {checkState === 'checking' ? (
          <p className="text-sm text-muted-foreground">
            {problems.lifecycle.closeRequirement.checking}
          </p>
        ) : checkState === 'missing' ? (
          <div
            role="alert"
            className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg"
          >
            <p className="font-medium">{problems.lifecycle.closeRequirement.title}</p>
            <p>{problems.lifecycle.closeRequirement.description}</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {problems.lifecycle.dialog.cancelAction}
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting || checkState === 'missing'}
            aria-label={problems.lifecycle.closeConfirmAriaLabel}
          >
            {problems.lifecycle.actions.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
