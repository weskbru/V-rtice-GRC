'use client';

/**
 * PharosGRC — approval request and decision dialogs (T161, US6, FR-029,
 * FR-029a to FR-029d, ADR-006).
 *
 * Two dialogs, both used from `RiskLifecycleActions` (T160):
 *
 * - `RequestApprovalDialog` — `POST /risks/{riskId}/approvals`. Requesting
 *   is a distinct action from deciding (`risk:transition`, never
 *   `risk:approve`); this dialog never shows a decide control.
 * - `ApprovalDecisionDialog` — `POST
 *   /risks/{riskId}/approvals/{approvalId}/decision`. A decision is a
 *   governance record, not a button press: the dialog states plainly WHO
 *   requested WHAT and WHEN, and that the decision is permanent
 *   (`decisionDialog.permanentNotice`) — never a bare confirm/cancel with
 *   no context.
 *
 * ## Self-approval (FR-029a)
 *
 * `RiskLifecycleActions` is the one place that decides whether to render
 * the decide controls at all — it never renders them for the requester
 * (see that component's own doc comment for why an inert disabled button
 * is the wrong shape for this). This file's job is the second half of that
 * same rule: the server remains the authority regardless of what the
 * client shows, so `ApprovalDecisionDialog` still renders the server's own
 * refusal message (`problem.detail`, already pt-BR — see
 * `problem-details.filter.ts`'s `VALIDATION` case) rather than a generic
 * error, on the off chance the decision is refused anyway (a stale view, a
 * permission change mid-session, or a second tab).
 */
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
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
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatLifecycleTransitionLabel, isApprovalGatedTarget, riskStatusLabel } from '../status';

import type { Approval, AvailableRiskTransition } from '../types';

/** Reads a problem's own pt-BR `detail` when present (the server already localizes every domain-error message, see `problem-details.filter.ts`), falling back to a locally-authored message only when the server gave none. */
function problemMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback;
  }
  return fallback;
}

export interface RequestApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string;
  /** The risk's current `ETag` (ADR-013) — required by `POST .../approvals`. */
  etag: string;
  /** The approval-gated transition being requested — `null` while the dialog is closed. */
  transition: AvailableRiskTransition | null;
  /** Called after a successful request; the caller re-fetches the lifecycle state and the risk itself, mirroring every other mutation in this feature (`AssessmentForm.onAssessed` etc.). */
  onRequested: () => void;
}

export function RequestApprovalDialog({
  open,
  onOpenChange,
  riskId,
  etag,
  transition,
  onRequested,
}: RequestApprovalDialogProps): React.JSX.Element {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fields are cleared on CLOSE, not in an effect keyed on `open` — this
   * dialog stays mounted (Radix, not unmounted) across opens, and a
   * `useEffect` that sets state synchronously on `open` becoming true trips
   * `react-hooks/set-state-in-effect`. Resetting on the way out leaves the
   * next open already blank, with the same net effect.
   */
  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setJustification('');
      setError(null);
    }
    onOpenChange(next);
  }

  const targetLabel = transition ? riskStatusLabel(transition.toStatus) : '';

  async function handleSubmit(): Promise<void> {
    if (!transition) return;
    const toStatus = transition.toStatus;
    if (!isApprovalGatedTarget(toStatus)) {
      // Defensive only — `RiskLifecycleActions` only opens this dialog for
      // a transition the server already flagged `requiresApproval: true`,
      // which per the declarative table (ADR-006) only ever targets
      // ACCEPTED/CLOSED. Reaching here would mean that invariant broke.
      setError(risks.lifecycle.requestApprovalDialog.genericError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await risksApi.requestApproval(
        riskId,
        { toStatus, justification: justification.trim() ? justification.trim() : undefined },
        etag,
      );
      feedback.success(risks.lifecycle.requestApprovalDialog.submitSuccess);
      handleOpenChange(false);
      onRequested();
    } catch (submitError) {
      const fallback =
        submitError instanceof ApiError && submitError.problem.status === 409
          ? risks.lifecycle.requestApprovalDialog.conflictError
          : risks.lifecycle.requestApprovalDialog.genericError;
      setError(problemMessage(submitError, fallback));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{risks.lifecycle.requestApprovalDialog.title(targetLabel)}</DialogTitle>
          <DialogDescription>
            {risks.lifecycle.requestApprovalDialog.description(targetLabel)}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={risks.lifecycle.requestApprovalDialog.justificationLabel}
          optionalIndicator={common.formField.optionalIndicator}
          description={risks.lifecycle.requestApprovalDialog.justificationDescription}
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
            {risks.lifecycle.requestApprovalDialog.cancelAction}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? risks.lifecycle.requestApprovalDialog.confirmingAction
              : risks.lifecycle.requestApprovalDialog.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ApprovalDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string;
  /** The risk's current `ETag` (ADR-013) — required by `POST .../decision`. */
  etag: string;
  /** The pending approval being decided — `null` while the dialog is closed. */
  approval: Approval | null;
  decision: 'APPROVED' | 'REJECTED';
  /** Called after the decision is recorded; the caller re-fetches the lifecycle state and the risk itself. */
  onDecided: () => void;
}

/**
 * One dialog for both outcomes, parameterized by `decision` — approving and
 * rejecting share every field and every consequence (a permanent record),
 * differing only in verb, emphasis and whether a justification is required
 * (FR-029b: "expected on rejection"). Two near-identical components would
 * duplicate that shared structure for no real difference (CLAUDE.md §13.8).
 */
export function ApprovalDecisionDialog({
  open,
  onOpenChange,
  riskId,
  etag,
  approval,
  decision,
  onDecided,
}: ApprovalDecisionDialogProps): React.JSX.Element {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  /** See `RequestApprovalDialog.handleOpenChange`'s own comment — same reset-on-close pattern, same lint reason. */
  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setJustification('');
      setError(null);
      setValidationError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(): Promise<void> {
    if (!approval) return;

    // Client-side nudge only (FR-029b says "expected on rejection", not
    // "required") — the server accepts a rejection without one; this just
    // asks the decider to record why before the decision becomes permanent.
    if (decision === 'REJECTED' && !justification.trim()) {
      setValidationError(risks.lifecycle.decisionDialog.justificationRequiredForRejection);
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setError(null);
    try {
      await risksApi.decideApproval(
        riskId,
        approval.id,
        { decision, justification: justification.trim() ? justification.trim() : undefined },
        etag,
      );
      feedback.success(risks.lifecycle.decisionDialog.submitSuccess[decision]);
      handleOpenChange(false);
      onDecided();
    } catch (submitError) {
      // Covers the segregation-of-duties refusal (FR-029a, 422) and the
      // already-decided refusal (FR-029b, 409) alike: both arrive as a
      // `DomainError` whose pt-BR `message` the filter already copies into
      // `detail` — shown verbatim rather than re-worded, so the server's
      // own reasoning reaches the user exactly (`problemMessage` above).
      setError(problemMessage(submitError, risks.lifecycle.decisionDialog.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  const transitionLabel = approval
    ? formatLifecycleTransitionLabel(approval.requestedTransition)
    : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{risks.lifecycle.decisionDialog.title[decision]}</DialogTitle>
          <DialogDescription>
            {approval
              ? risks.lifecycle.decisionDialog.description({
                  requestedByName: approval.requestedBy.fullName,
                  requestedAtLabel: new Date(approval.requestedAt).toLocaleString('pt-BR'),
                  transitionLabel,
                })
              : ''}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-status-warning-fg">
          {risks.lifecycle.decisionDialog.permanentNotice}
        </p>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={risks.lifecycle.decisionDialog.justificationLabel[decision]}
          // FR-029b: "expected on rejection", explicitly NOT "required" — the
          // server accepts a rejection with none; `handleSubmit` above is a
          // client-side nudge only. So this never renders the `required`
          // asterisk (that convention is reserved for a field the server
          // actually rejects when absent) — only the fully-optional
          // APPROVED case gets the visible optional marker; REJECTED gets
          // neither marker, an honest middle state between the two.
          optionalIndicator={
            decision === 'APPROVED' ? common.formField.optionalIndicator : undefined
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
            {risks.lifecycle.decisionDialog.cancelAction}
          </Button>
          <Button
            type="button"
            variant={decision === 'REJECTED' ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? risks.lifecycle.decisionDialog.confirmingAction
              : risks.lifecycle.decisionDialog.confirmAction[decision]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
