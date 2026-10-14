'use client';

import { ArrowRightCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { ConfirmDialog } from '@vertice/design-system/components';

import { findingsApi } from '../api';

import type { Finding } from '../types';

const { remediation } = auditEngagements;

export interface FindingRemediationActionProps {
  finding: Finding;
  onRemediated: (finding: Finding) => void;
}

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
