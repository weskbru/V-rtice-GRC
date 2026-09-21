'use client';

/**
 * PharosGRC — reopen-with-reason dialog (T056, US2, FR-016, Invariant A2).
 *
 * The ONE transition that needs a form rather than a plain confirmation:
 * `COMPLETED -> OPEN` requires a non-empty reason, enforced authoritatively
 * by the server (`action.entity.ts#assertReopenReasonProvided`) — this
 * dialog's own client-side check (`reason.trim().length === 0`) is a
 * courtesy that saves a round trip, never the actual gate (CLAUDE.md
 * §18.9). Self-contained submission, mirroring `TransitionConfirmDialog`
 * (`features/risks/components/risk-lifecycle-actions.tsx`)'s own shape.
 *
 * ## Why `onConfirm` exists
 *
 * Every origin screen reopens the SAME `Action` through the SAME rule, but
 * not all of them reach it by the same route. Incident, Problem, Finding
 * and the central Plano de Ação call `POST /actions/{id}/transitions`
 * (`action:edit`); the risk treatment tab calls `PATCH /risks/{riskId}
 * /treatment-actions/{actionId}` with `status`/`reopenReason`, because that
 * route is the one gated by `risk:treat` — the permission the whole tab is
 * already behind. Both land in `TransitionActionUseCase`, on one legality
 * table and one reopen-reason invariant; the difference is the door, not
 * the rule.
 *
 * That difference briefly produced a byte-for-byte copy of this dialog
 * inside `treatment-actions-table.tsx`, which is how a shared dialog starts
 * drifting in markup and accessibility while its copy stays identical.
 * `onConfirm` removes the reason for the copy: a caller supplies the write
 * and this component keeps owning the form — validation, submitting state,
 * error display, success feedback and open/close.
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
import { actions } from '@/lib/messages/actions';

import { actionsApi } from '../api';

import type { Action } from '../types';

export interface ReopenActionDialogProps {
  /** Only `id` is read — widened from `Action` so an origin screen holding
   * its own projection of the same row (e.g. `RiskTreatmentAction`) can
   * pass it without an adapter that exists only to satisfy a type. */
  action: Pick<Action, 'id'> | null;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
  /**
   * Performs the reopen. Omitted, this dialog calls `POST /actions/{id}
   * /transitions` itself, which is what four of the five origin screens
   * want. Supplied, the caller owns the write AND any state it needs to
   * update from the response — see the header for why the risk treatment
   * tab needs its own route. Throw to surface a message: an `ApiError`'s
   * `detail` or a plain `Error`'s `message` is rendered in the dialog.
   */
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
      // A caller's `onConfirm` maps its own refusals (a 409 version conflict,
      // say) to a message by throwing a plain `Error` — read here so that
      // message reaches the user instead of the generic fallback.
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
