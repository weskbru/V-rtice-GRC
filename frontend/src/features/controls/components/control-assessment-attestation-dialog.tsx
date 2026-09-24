'use client';

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
import { controls } from '@/lib/messages/controls';

import { controlsApi } from '../api';

import type { ControlAssessment } from '../types';

export interface ControlAssessmentAttestationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
  assessment: ControlAssessment | null;
  decision: 'APPROVED' | 'REJECTED';
  onDecided: () => void;
}

function problemMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback;
  }
  return fallback;
}

export function ControlAssessmentAttestationDialog({
  open,
  onOpenChange,
  controlId,
  assessment,
  decision,
  onDecided,
}: ControlAssessmentAttestationDialogProps): React.JSX.Element {
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

  async function handleSubmit(): Promise<void> {
    if (!assessment?.attestation) return;
    setSubmitting(true);
    setError(null);
    try {
      await controlsApi.decideAttestation(controlId, assessment.id, {
        decision,
        justification: justification.trim() ? justification.trim() : undefined,
      });
      feedback.success(controls.assessment.attestation.decisionDialog.submitSuccess[decision]);
      handleOpenChange(false);
      onDecided();
    } catch (submitError) {
      setError(
        problemMessage(submitError, controls.assessment.attestation.decisionDialog.genericError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const resultLabel = assessment ? controls.assessmentResultLabels[assessment.result] : '';
  const assessorName = assessment?.assessor.fullName ?? '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {controls.assessment.attestation.decisionDialog.title[decision]}
          </DialogTitle>
          <DialogDescription>
            {controls.assessment.attestation.decisionDialog.description(assessorName, resultLabel)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-status-warning-fg">
          {controls.assessment.attestation.decisionDialog.permanentNotice}
        </p>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={controls.assessment.attestation.decisionDialog.justificationLabel}
          optionalIndicator={controls.assessment.attestation.decisionDialog.justificationOptional}
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
            {controls.assessment.attestation.decisionDialog.cancelAction}
          </Button>
          <Button
            type="button"
            variant={decision === 'REJECTED' ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? controls.assessment.attestation.decisionDialog.confirmingAction
              : controls.assessment.attestation.decisionDialog.confirmAction[decision]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
