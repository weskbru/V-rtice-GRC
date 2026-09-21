'use client';

/**
 * PharosGRC — "Mover para remediação" action (T077, 005-audit-findings,
 * US2, FR-009, research.md D-10).
 *
 * `OPEN -> IN_REMEDIATION`, the first — and, before this phase, the ONLY
 * missing — direct transition on `Finding` (see `finding-close-dialog.tsx`'s
 * own Invariant references for the rest of the lifecycle). Modeled on
 * `control-lifecycle-actions.tsx`'s own confirm-then-apply shape, but much
 * smaller: this is a single, unconditional edge with no destination choice
 * and no `If-Match` (`Finding` carries no optimistic-concurrency field,
 * `findings/api.ts`'s own header comment), so no lifecycle-state fetch is
 * needed first — the caller already knows the current `status` and renders
 * this action only when it is `OPEN`.
 *
 * `startRemediation`'s response is the reduced `FindingSummary` shape, not
 * `Finding` (`types.ts`'s own header comment on why the two are distinct,
 * deliberately not type-compatible) — so, on success, this component
 * re-reads the canonical `Finding` via `getFinding` rather than attempting
 * to reshape the summary into the fuller type the caller's list holds.
 */
import { ConfirmDialog } from '@pharos/design-system/components';
import { ArrowRightCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';

import { findingsApi } from '../api';

import type { Finding } from '../types';

const { remediation } = auditEngagements;

export interface FindingRemediationActionProps {
  finding: Finding;
  onRemediated: (finding: Finding) => void;
}

/** Renders nothing unless `finding.status` is `OPEN` — the one status this edge legally starts from (research.md D-10). */
export function FindingRemediationAction({
  finding,
  onRemediated,
}: FindingRemediationActionProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (finding.status !== 'OPEN') return null;

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) setError(null);
    setOpen(next);
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await findingsApi.startRemediation(finding.id);
      const updated = await findingsApi.getFinding(finding.id);
      handleOpenChange(false);
      onRemediated(updated);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.problem.status === 422) {
        setError(remediation.notOpenError);
      } else if (submitError instanceof ApiError && submitError.problem.detail) {
        setError(submitError.problem.detail);
      } else {
        setError(remediation.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowRightCircle aria-hidden="true" className="size-4" />
        {remediation.action}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={remediation.confirmTitle}
        description={
          <>
            {remediation.confirmDescription}
            {error ? (
              <span role="alert" className="mt-2 block font-medium text-status-danger-fg">
                {error}
              </span>
            ) : null}
          </>
        }
        labels={{
          confirm: submitting ? remediation.confirming : remediation.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="default"
        isConfirming={submitting}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
