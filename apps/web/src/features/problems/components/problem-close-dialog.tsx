'use client';

/**
 * PharosGRC — problem close dialog (008-incidents-problems, US2, D-7,
 * Invariants P2/P3). The screen the coordinator asked for particular care
 * on (2026-09-11): closing a problem is gated by THREE server-side
 * conditions —
 *
 *   1. `rootCause` already populated (structurally guaranteed here: the
 *      lifecycle table only ever offers `CLOSED` from `RESOLVED`, and
 *      `RESOLVED` cannot be entered without providing `rootCause` at that
 *      same transition — `ProblemOverview` already shows it once set);
 *   2. at least one `COMPLETED` `Action` of `originType: PROBLEM` for this
 *      problem;
 *   3. the caller closing it is not the same user who completed that
 *      action (segregation of duties).
 *
 * All three are enforced authoritatively server-side — this dialog's job
 * is to make (2) legible BEFORE any attempt (CLAUDE.md §18.11: "a refusal
 * that could have been prevented by showing the requirement is a design
 * failure even when the server behaves correctly"). (2) is the one
 * precondition cheaply and reliably knowable client-side, via a single
 * `GET /actions?originType=PROBLEM&originId=&status=COMPLETED` read —
 * `problemsApi.hasCompletedCorrectiveAction`'s own header explains why (3)
 * is deliberately NOT pre-checked here (no reliable client-side signal for
 * "who completed it", the same limitation `FindingCloseDialog` documents
 * for Invariant F2) and instead surfaced honestly from the server's `403`
 * when it happens.
 *
 * Mirrors `FindingCloseDialog`'s exact "checking/present/missing/unknown"
 * state shape and its "disable confirm while known-missing, never while
 * merely unknown" rule: a failed check (network/permission) must never
 * block the attempt — the server remains the authority either way.
 */
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
  // Mirrors `FindingCloseDialog`'s own "derive loading from a resolved-key
  // comparison" convention (react-hooks/set-state-in-effect) — `checkState`
  // below is CHECKING whenever `problemId` has changed since the last id
  // this effect actually resolved.
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
        // Segregation of duties (Invariant P3) — never pre-checked above,
        // only ever surfaced here.
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
