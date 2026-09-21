'use client';

/**
 * PharosGRC — publish-a-framework-version action (US1, FR-005, research.md
 * D-3). A version's one legal transition, one-way — there is deliberately
 * no operation to revert it, mirroring `ControlLifecycleActions`'s own "the
 * server owns the rule, this renders the result" discipline.
 *
 * `requirementCount` is the version's real, server-fetched requirement
 * total (`ComplianceSummary.totalRequirements`, operation 18) — no longer a
 * session-scoped guess. A count of zero shows a warning before the attempt,
 * but never disables the button: the server's own `422` (FR-005 — a version
 * with no requirement cannot be published) stays the authority, and its
 * exact message is what actually renders on failure.
 */
import { ConfirmDialog } from '@pharos/design-system/components';
import { Lock } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';

import { complianceApi } from '../api';

import type { FrameworkVersion } from '../types';

export interface PublishVersionActionProps {
  frameworkId: string;
  version: FrameworkVersion;
  etag: string;
  /** The version's real requirement total (`ComplianceSummary.totalRequirements`), or `null` while it has not loaded yet — in which case the hint is simply not shown. */
  requirementCount: number | null;
  onPublished: (result: { version: FrameworkVersion; etag: string }) => void;
}

export function PublishVersionAction({
  frameworkId,
  version,
  etag,
  requirementCount,
  onPublished,
}: PublishVersionActionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setError(null);
    }
    setOpen(next);
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const result = await complianceApi.publishFrameworkVersion(frameworkId, version.id, etag);
      setOpen(false);
      onPublished({ version: result.record, etag: result.etag });
    } catch (caught) {
      const fallback =
        caught instanceof ApiError && caught.problem.status === 409
          ? compliance.versionDetail.publish.conflictError
          : compliance.versionDetail.publish.genericError;
      setError(caught instanceof ApiError ? (caught.problem.detail ?? fallback) : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  if (version.status === 'PUBLISHED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{compliance.versionDetail.publish.cardTitle}</CardTitle>
          <CardDescription>{compliance.versionDetail.publish.publishedDescription}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{compliance.versionDetail.publish.cardTitle}</CardTitle>
        <CardDescription>{compliance.versionDetail.publish.draftDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requirementCount === 0 ? (
          <p className="text-sm text-status-warning-fg">
            {compliance.versionDetail.publish.noRequirementsWarning}
          </p>
        ) : requirementCount !== null ? (
          <p className="text-sm text-muted-foreground">
            {compliance.versionDetail.publish.requirementCountHint(requirementCount)}
          </p>
        ) : null}
        <Button type="button" className="w-fit" onClick={() => setOpen(true)}>
          <Lock aria-hidden="true" className="size-4" />
          {compliance.versionDetail.publish.action}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={compliance.versionDetail.publish.confirmTitle}
        // `ConfirmDialog`'s `description` renders inside Radix's own `<p>`
        // (`Dialog.Description`) — a nested `<span className="block">`,
        // never a second `<p>`, keeps the two-line layout without invalid
        // HTML nesting (a real hydration warning this capture run caught).
        description={
          <>
            <span className="block">{compliance.versionDetail.publish.confirmDescription}</span>
            {error ? (
              <span role="alert" className="mt-2 block font-medium text-status-danger-fg">
                {error}
              </span>
            ) : null}
          </>
        }
        labels={{
          confirm: submitting
            ? compliance.versionDetail.publish.publishing
            : compliance.versionDetail.publish.confirmAction,
          cancel: common.actions.cancel,
          close: common.dialog.closeLabel,
        }}
        icon={Lock}
        onConfirm={() => void handleConfirm()}
        isConfirming={submitting}
      />
    </Card>
  );
}
