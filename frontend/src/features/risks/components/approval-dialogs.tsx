'use client';

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
import { FormField } from '@vertice/design-system/components';

import { risksApi } from '../api';
import { formatLifecycleTransitionLabel, isApprovalGatedTarget, riskStatusLabel } from '../status';

import type { Approval, AvailableRiskTransition } from '../types';

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
  etag: string;
  transition: AvailableRiskTransition | null;
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
  etag: string;
  approval: Approval | null;
  decision: 'APPROVED' | 'REJECTED';
  onDecided: () => void;
}

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
