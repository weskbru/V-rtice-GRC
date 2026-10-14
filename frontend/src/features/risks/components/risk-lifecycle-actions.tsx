'use client';

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
import { FormField, ReadOnlyField } from '@vertice/design-system/components';

import { risksApi } from '../api';
import { formatLifecycleTransitionLabel, riskStatusLabel } from '../status';

import { ApprovalDecisionDialog, RequestApprovalDialog } from './approval-dialogs';

import type { AvailableRiskTransition, RiskLifecycleState } from '../types';
import type { ReactNode } from 'react';

export interface RiskLifecycleActionsProps {
  riskId: string;
  etag: string;
  currentUserId: string;
  canApprove: boolean;
  lifecycle: RiskLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  onChanged: () => void;
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
