'use client';

/**
 * PharosGRC — Finding close dialog (T075/T077, 002-shared-grc-foundation +
 * 005-audit-findings, US3, Invariant F1/F2, FR-010).
 *
 * Justification is optional at the shape level — it becomes required only
 * when no completed linked action exists, a business rule the SERVER
 * enforces authoritatively (`finding.entity.ts#assertFindingCloseRequirementMet`,
 * `422`). Segregation of duties (F2) is likewise a server-side rule (`403`)
 * — this dialog surfaces that `problem+json` detail verbatim rather than
 * guessing eligibility client-side, since the client has no reliable way to
 * know which linked actions are COMPLETED and who is responsible for them
 * without duplicating a query the panel does not otherwise need.
 *
 * 005-audit-findings adds an ADDITIVE requirement on top of F1: closing now
 * ALSO requires at least one currently-ACTIVE evidence link, of any
 * evidence status (an ARCHIVED evidence still sustains closure — only the
 * total absence of an active link refuses, quickstart.md §5). Unlike F1,
 * this one IS cheaply and reliably knowable client-side — a single read of
 * `GET /evidence?subjectType=FINDING&subjectId=` already answers "is there
 * at least one active link", the exact filter that endpoint's own
 * implementation applies (`prisma-evidence.repository.ts`'s own
 * `links: { some: { subjectType, subjectId, unlinkedAt: null } }` — it does
 * NOT filter by the evidence's own `status`, so an archived evidence still
 * counts here, matching the server rule exactly). So this dialog checks it
 * on open and communicates the requirement BEFORE any attempt
 * (`closureEvidenceRequirement`, CLAUDE.md §18.11) — not only as a `422`
 * string after a refusal — and disables the confirm action while the
 * requirement is known to be unmet, the same "unmet precondition disables
 * the action" pattern `control-lifecycle-actions.tsx` already establishes.
 * A failed check (network/permission) never blocks the attempt — the
 * server remains the authority either way.
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
  // Mirrors `EvidenceAttachmentsSection`'s/`FindingsPanel`'s own
  // "derive loading from a resolved-key comparison" convention rather than
  // an unconditional `setState('checking')` at the top of the effect body
  // (react-hooks/set-state-in-effect) — `evidenceCheck` below is CHECKING
  // whenever `findingId` has changed since the last id this effect
  // actually resolved.
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
        // Segregation of duties (Invariant F2) — a DIFFERENT problem from
        // the evidence requirement below: this one is about WHO is
        // closing, never about what is or is not linked.
        setError(findingsMessages.close.segregationOfDutiesError);
      } else if (submitError instanceof ApiError && submitError.problem.status === 422) {
        // The evidence requirement (FR-010) is the one 422 cause this
        // dialog already knows how to name specifically — everything else
        // 422 falls back to the server's own `detail` below.
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
