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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { evidenceApi } from '@/features/evidence/api';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { findings as findingsMessages } from '@/lib/messages/findings';

import { findingsApi } from '../api';

import type { Finding } from '../types';

const { closureEvidenceRequirement } = auditEngagements;

type EvidenceResult = 'present' | 'missing' | 'unknown';

export interface FindingCloseDialogProps {
  finding: Finding | null;
  onOpenChange: (open: boolean) => void;
  onClosed: (finding: Finding) => void;
}

export function FindingCloseDialog({
  finding,
  onOpenChange,
  onClosed,
}: FindingCloseDialogProps): React.JSX.Element {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<EvidenceResult>('present');
  const [resolvedFindingId, setResolvedFindingId] = useState<string | null>(null);

  const findingId = finding?.id ?? null;
  const evidenceCheck: EvidenceResult | 'checking' =
    findingId !== null && resolvedFindingId !== findingId ? 'checking' : evidenceResult;

  useEffect(() => {
    if (!findingId) return;
    let cancelled = false;
    evidenceApi
      .listBySubject('FINDING', findingId)
      .then((page) => {
        if (!cancelled) setEvidenceResult(page.items.length > 0 ? 'present' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setEvidenceResult('unknown');
      })
      .finally(() => {
        if (!cancelled) setResolvedFindingId(findingId);
      });
    return () => {
      cancelled = true;
    };
  }, [findingId]);

  function handleOpenChange(open: boolean): void {
    if (submitting) return;
    if (!open) {
      setJustification('');
      setError(null);
    }
    onOpenChange(open);
  }

  async function handleConfirm(): Promise<void> {
    if (!finding) return;
    setSubmitting(true);
    setError(null);
    try {
      const closed = await findingsApi.closeFinding(finding.id, {
        justification: justification.trim() || undefined,
      });
      handleOpenChange(false);
      onClosed(closed);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.problem.status === 403) {
        setError(findingsMessages.close.segregationOfDutiesError);
      } else if (submitError instanceof ApiError && submitError.problem.status === 422) {
        setError(
          evidenceCheck === 'missing'
            ? closureEvidenceRequirement.noEvidenceError
            : (submitError.problem.detail ?? findingsMessages.form.genericError),
        );
      } else if (submitError instanceof ApiError && submitError.problem.detail) {
        setError(submitError.problem.detail);
      } else {
        setError(findingsMessages.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={finding !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{findingsMessages.close.title}</DialogTitle>
          <DialogDescription>{findingsMessages.close.description}</DialogDescription>
        </DialogHeader>

        {evidenceCheck === 'missing' ? (
          <div className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg">
            <p className="font-medium">{closureEvidenceRequirement.title}</p>
            <p>{closureEvidenceRequirement.description}</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finding-close-justification">
            {findingsMessages.close.justificationLabel}
          </Label>
          <Textarea
            id="finding-close-justification"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder={findingsMessages.close.justificationPlaceholder}
            rows={4}
            disabled={submitting}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {findingsMessages.close.cancel}
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting || evidenceCheck === 'missing'}
          >
            {findingsMessages.close.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
