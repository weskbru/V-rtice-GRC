'use client';

/**
 * PharosGRC — risk detail, lifecycle action bar (T160, US6, FR-080 to
 * FR-085, FR-029/FR-029a-d, ADR-006).
 *
 * ## Renders exactly what the server returns; never re-derives the rules
 *
 * `GET /risks/{riskId}/lifecycle` already filters `availableTransitions` by
 * BOTH what is legal from the current state and what this caller is
 * permitted to do (`getRiskLifecycleUseCase`, the same permission resolver
 * the `PermissionGuard` uses). This component contains no transition table,
 * no permission check, and no precondition logic of its own — every button
 * below exists because one entry in `lifecycle.availableTransitions` said
 * so, and `POST /risks/{riskId}/transitions`/`POST .../approvals` still
 * re-evaluate the same table server-side on every request (FR-081).
 * Duplicating any of this client-side is exactly the drift ADR-006 exists
 * to prevent.
 *
 * ## The fetch itself lives at the PAGE, not here (016-risk-detail-experience
 * §4.7/§4.9, corrected 2026-09-15)
 *
 * Before 016, this component owned its own `GET .../lifecycle` fetch and its
 * own loading/error card — it mounted unconditionally, outside any tab, so
 * the request was never at risk of the "exactly two requests, page-level"
 * rule (§4.9) being violated by a section that only mounts once opened.
 * 016's contextual aside ("Atenção") and the "Ciclo de vida" section
 * (`RiskLifecycleSpine`, `components/detail/`) both need this SAME state,
 * and the aside is visible before any section is ever opened — so the fetch
 * moved up to `RiskDetailView` (`useRiskLifecycle`, `components/detail/`),
 * once, still page-level, still exactly the second of the two requests the
 * page fires on mount. This component now takes `lifecycle`/`loading`/
 * `loadError` as props instead of fetching them itself, and `onChanged`
 * alone is what the caller re-fetches after a mutation (both the risk AND
 * the lifecycle) — this component itself no longer re-fetches anything.
 *
 * ## Approval-gated is visibly different from immediate — not by colour
 *
 * A transition with `requiresApproval: true` renders with a different
 * VERB ("Solicitar aprovação: …" vs. "Aplicar: …"), a different ICON
 * (`Send`, evoking "submitted for someone else's decision", vs.
 * `ArrowRightCircle`, evoking "happens now"), and a different button
 * EMPHASIS (`outline` — a request, not yet a fact — vs. `default` — the
 * risk actually changes state). Three independent, non-color signals
 * (FR-091, SC-012's own reasoning applied to lifecycle actions): a reader
 * who cannot perceive colour still gets two different words and two
 * different icons.
 *
 * ## Self-approval (FR-029a)
 *
 * The decide controls (`Aprovar`/`Rejeitar`) are rendered only for a caller
 * holding `risk:approve` (`canApprove` — an advisory mirror, like every
 * other permission check in this app) AND whose id differs from the
 * pending approval's `requestedBy.id`. When the signed-in user IS the
 * requester, the controls are not merely hidden — `selfRequestNotice`
 * explains plainly why no decide action is offered, so a caller who
 * legitimately holds `risk:approve` for other risks is not left wondering
 * whether something is broken. The server remains the sole authority
 * either way — see `approval-dialogs.tsx`'s own doc comment for how a
 * refusal is still surfaced if the decision reaches the server regardless.
 */
import { FormField, ReadOnlyField } from '@pharos/design-system/components';
import { ArrowRightCircle, Loader2, Send } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatLifecycleTransitionLabel, riskStatusLabel } from '../status';

import { ApprovalDecisionDialog, RequestApprovalDialog } from './approval-dialogs';

import type { AvailableRiskTransition, RiskLifecycleState } from '../types';
import type { ReactNode } from 'react';

export interface RiskLifecycleActionsProps {
  riskId: string;
  /** The risk's current `ETag` (ADR-013) — required by every transition/approval call. */
  etag: string;
  /** The signed-in user's own id — used only to decide whether to offer the decide controls for a pending approval (FR-029a), never to enforce anything (the server does that unconditionally). */
  currentUserId: string;
  /** Whether the caller holds `risk:approve` — advisory, like every permission check in this app (`usePermissions()`'s own module doc comment). */
  canApprove: boolean;
  /** `GET /risks/{riskId}/lifecycle`'s own result, fetched once at the page level (`useRiskLifecycle`, `components/detail/`) — see this file's own header comment for why the fetch moved out of this component. */
  lifecycle: RiskLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  /** Called after any successful transition, approval request or decision. Like `AssessmentForm.onAssessed`, none of these responses carry the risk's full updated state, so the caller re-reads BOTH the whole risk and the lifecycle (`useRiskLifecycle`'s own `reload`). */
  onChanged: () => void;
  /**
   * The lifecycle trajectory visual (`RiskLifecycleSpineView`), rendered at
   * the top of this SAME card, above the pending-approval condition and the
   * transition buttons — never a second card with a second "Ciclo de vida"
   * title (016-risk-detail-experience P1, corrected 2026-09-15: the spine
   * and this card used to be two separate blocks, both of which could show
   * a blocked transition's unmet-preconditions text, reading as the same
   * pendency duplicated on screen). This component still owns the ONLY
   * rendering of that text (below, per transition) — the trajectory itself
   * never repeats it (see `RiskLifecycleSpineView`'s own doc comment).
   * Omitted entirely when the caller has none (the loading/error states
   * below never receive it, since there is no lifecycle yet to draw).
   */
  trajectory?: ReactNode;
}

function TransitionConfirmDialog({
  open,
  onOpenChange,
  riskId,
  etag,
  transition,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string;
  etag: string;
  transition: AvailableRiskTransition | null;
  onApplied: () => void;
}): React.JSX.Element {
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

  async function handleConfirm(): Promise<void> {
    if (!transition) return;
    setSubmitting(true);
    setError(null);
    try {
      await risksApi.transitionRisk(
        riskId,
        {
          toStatus: transition.toStatus,
          justification: justification.trim() ? justification.trim() : undefined,
        },
        etag,
      );
      feedback.success(risks.lifecycle.transitionDialog.submitSuccess(targetLabel));
      handleOpenChange(false);
      onApplied();
    } catch (submitError) {
      const fallback =
        submitError instanceof ApiError && submitError.problem.status === 409
          ? risks.lifecycle.transitionDialog.conflictError
          : risks.lifecycle.transitionDialog.genericError;
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
          <DialogTitle>{risks.lifecycle.transitionDialog.title(targetLabel)}</DialogTitle>
          <DialogDescription>
            {risks.lifecycle.transitionDialog.description(targetLabel)}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={risks.lifecycle.transitionDialog.justificationLabel}
          optionalIndicator={common.formField.optionalIndicator}
          description={risks.lifecycle.transitionDialog.justificationDescription}
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
            {risks.lifecycle.transitionDialog.cancelAction}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void handleConfirm()}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? risks.lifecycle.transitionDialog.confirmingAction
              : risks.lifecycle.transitionDialog.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RiskLifecycleActions({
  riskId,
  etag,
  currentUserId,
  canApprove,
  lifecycle,
  loading,
  loadError,
  onChanged,
  trajectory,
}: RiskLifecycleActionsProps): React.JSX.Element {
  const [pendingTransition, setPendingTransition] = useState<AvailableRiskTransition | null>(null);
  const [pendingApprovalRequest, setPendingApprovalRequest] =
    useState<AvailableRiskTransition | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);

  function handleChanged(): void {
    onChanged();
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{risks.lifecycle.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{risks.lifecycle.loading}</p>
        </CardContent>
      </Card>
    );
  }

  if (loadError || !lifecycle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{risks.lifecycle.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {risks.lifecycle.loadError}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { pendingApproval, availableTransitions } = lifecycle;
  const isOwnRequest = pendingApproval !== null && pendingApproval.requestedBy.id === currentUserId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.lifecycle.cardTitle}</CardTitle>
        <CardDescription>{risks.lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {trajectory ? <div className="border-b border-border pb-4">{trajectory}</div> : null}

        {pendingApproval ? (
          <div className="flex flex-col gap-2 rounded-md border border-status-info-border bg-status-info-bg p-4">
            <p className="text-sm font-semibold text-status-info-fg">
              {risks.lifecycle.pendingApproval.cardTitle}
            </p>
            <p className="text-sm text-foreground">
              {risks.lifecycle.pendingApproval.requestedBy(pendingApproval.requestedBy.fullName)}{' '}
              {risks.lifecycle.pendingApproval.requestedAt(
                new Date(pendingApproval.requestedAt).toLocaleString('pt-BR'),
              )}
            </p>
            <p className="text-sm text-foreground">
              {risks.lifecycle.pendingApproval.transitionLabel(
                formatLifecycleTransitionLabel(pendingApproval.requestedTransition),
              )}
            </p>
            <dl>
              <ReadOnlyField
                label={risks.lifecycle.pendingApproval.justificationLabel}
                value={
                  pendingApproval.justification ?? risks.lifecycle.pendingApproval.noJustification
                }
              />
            </dl>

            {canApprove ? (
              isOwnRequest ? (
                <p className="text-sm text-muted-foreground">
                  {risks.lifecycle.pendingApproval.selfRequestNotice}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setDecision('APPROVED')}>
                    {risks.lifecycle.pendingApproval.approveAction}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDecision('REJECTED')}
                  >
                    {risks.lifecycle.pendingApproval.rejectAction}
                  </Button>
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {availableTransitions.length === 0 ? (
          pendingApproval ? null : (
            <p className="text-sm text-muted-foreground">{risks.lifecycle.noneAvailable}</p>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {availableTransitions.map((transition) => (
              <div key={transition.toStatus} className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant={transition.requiresApproval ? 'outline' : 'default'}
                  disabled={!transition.preconditionsMet}
                  className="w-fit"
                  onClick={() =>
                    transition.requiresApproval
                      ? setPendingApprovalRequest(transition)
                      : setPendingTransition(transition)
                  }
                >
                  {transition.requiresApproval ? (
                    <Send aria-hidden="true" className="size-4" />
                  ) : (
                    <ArrowRightCircle aria-hidden="true" className="size-4" />
                  )}
                  {transition.requiresApproval
                    ? risks.lifecycle.actions.requestApproval(riskStatusLabel(transition.toStatus))
                    : risks.lifecycle.actions.apply(riskStatusLabel(transition.toStatus))}
                </Button>
                {/* Clarity pass: who is the next functional actor for this
                    transition, in business language — never the raw
                    `resource:action` permission identifier (CLAUDE.md
                    §11.1). Shown for every transition the server already
                    offered, available or blocked alike. */}
                <p className="pl-1 text-xs text-muted-foreground">
                  {risks.lifecycle.actions.authorizedFor(transition.requiredPermission)}
                  {transition.requiresApproval
                    ? ` ${risks.lifecycle.actions.requiresApprovalNotice}`
                    : ''}
                </p>
                {!transition.preconditionsMet &&
                transition.unmetPreconditions &&
                transition.unmetPreconditions.length > 0 ? (
                  <div className="pl-1 text-sm text-status-warning-fg">
                    <p className="font-medium">{risks.lifecycle.unmetPreconditionsTitle}</p>
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
      </CardContent>

      <TransitionConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null);
        }}
        riskId={riskId}
        etag={etag}
        transition={pendingTransition}
        onApplied={() => {
          setPendingTransition(null);
          handleChanged();
        }}
      />

      <RequestApprovalDialog
        open={pendingApprovalRequest !== null}
        onOpenChange={(open) => {
          if (!open) setPendingApprovalRequest(null);
        }}
        riskId={riskId}
        etag={etag}
        transition={pendingApprovalRequest}
        onRequested={() => {
          setPendingApprovalRequest(null);
          handleChanged();
        }}
      />

      <ApprovalDecisionDialog
        open={decision !== null && pendingApproval !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        riskId={riskId}
        etag={etag}
        approval={pendingApproval}
        decision={decision ?? 'APPROVED'}
        onDecided={() => {
          setDecision(null);
          handleChanged();
        }}
      />
    </Card>
  );
}
