'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { controls } from '@/lib/messages/controls';
import { StatusBadge } from '@vertice/design-system/components';

import { controlsApi } from '../api';
import { formatDateOnly } from '../date';

import { ControlAssessmentAttestationDialog } from './control-assessment-attestation-dialog';
import { ControlRemediationDialog } from './control-remediation-dialog';

import type { AttestationStatus, ControlAssessment } from '../types';
import type { StatusVariant } from '@vertice/design-system/components';

export interface ControlAssessmentHistoryProps {
  controlId: string;
  controlOwnerId: string | null;
  currentUserId: string;
  canTest: boolean;
  canApprove: boolean;
  refreshToken?: number;
}

const PAGE_SIZE = 20;

const ATTESTATION_VARIANT: Record<AttestationStatus, StatusVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export function ControlAssessmentHistory({
  controlId,
  controlOwnerId,
  currentUserId,
  canTest,
  canApprove,
  refreshToken = 0,
}: ControlAssessmentHistoryProps): React.JSX.Element {
  const [items, setItems] = useState<readonly ControlAssessment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [internalRefreshToken, setInternalRefreshToken] = useState(0);

  const [requestingFor, setRequestingFor] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    assessment: ControlAssessment;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [remediationFor, setRemediationFor] = useState<string | null>(null);

  const requestKey = `${controlId}|${refreshToken}|${internalRefreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    controlsApi
      .listAssessments(controlId, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setError(false);
        setResolvedRequestKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [controlId, refreshToken, internalRefreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await controlsApi.listAssessments(controlId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function refresh(): void {
    setInternalRefreshToken((token) => token + 1);
  }

  async function handleRequestAttestation(assessment: ControlAssessment): Promise<void> {
    setRequestingFor(assessment.id);
    try {
      await controlsApi.requestAttestation(controlId, assessment.id);
      feedback.success(controls.assessment.attestation.requestSuccess);
      refresh();
    } catch (error) {
      const message =
        error instanceof ApiError && error.problem.status === 409
          ? controls.assessment.attestation.alreadyExistsError
          : controls.assessment.attestation.requestError;
      feedback.error(message);
    } finally {
      setRequestingFor(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{controls.assessment.history.cardTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {controls.assessment.history.cardDescription}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canApprove ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {controls.assessment.attestation.segregationNotice.title}
            </p>
            <ul className="mt-1 list-disc pl-5">
              <li>{controls.assessment.attestation.segregationNotice.assessorRule}</li>
              <li>{controls.assessment.attestation.segregationNotice.ownerRule}</li>
              <li>{controls.assessment.attestation.segregationNotice.bothRule}</li>
            </ul>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{controls.assessment.history.loading}</p>
        ) : error && items.length === 0 ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {controls.assessment.history.loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{controls.assessment.history.empty}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="sm:table-fixed">
                <TableCaption className="sr-only">
                  {controls.assessment.history.cardTitle}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%]">
                      {controls.assessment.history.columns.assessedOn}
                    </TableHead>
                    <TableHead className="w-[16%]">
                      {controls.assessment.history.columns.assessor}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {controls.assessment.history.columns.result}
                    </TableHead>
                    <TableHead className="w-[26%]">
                      {controls.assessment.history.columns.conclusion}
                    </TableHead>
                    <TableHead className="w-[32%]">
                      {controls.assessment.history.columns.attestation}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((assessment) => {
                    const isOwnAssessment = assessment.assessor.id === currentUserId;
                    const isOwner = controlOwnerId !== null && controlOwnerId === currentUserId;
                    const canDecideThis = canApprove && !isOwnAssessment && !isOwner;
                    const isFailure = assessment.result === 'INEFFECTIVE';

                    return (
                      <TableRow key={assessment.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateOnly(assessment.assessedOn)}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">
                          {assessment.assessor.fullName}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">
                          {controls.assessmentResultLabels[assessment.result]}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap break-words">
                          {assessment.conclusion || controls.assessment.history.noConclusion}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">
                          <div className="flex flex-col items-start gap-1.5">
                            {assessment.attestation ? (
                              <StatusBadge
                                variant={ATTESTATION_VARIANT[assessment.attestation.status]}
                                label={
                                  controls.assessment.attestation.statusLabels[
                                    assessment.attestation.status
                                  ]
                                }
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                {controls.assessment.attestation.notRequested}
                              </span>
                            )}

                            {!assessment.attestation && canTest ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={requestingFor === assessment.id}
                                onClick={() => void handleRequestAttestation(assessment)}
                              >
                                {requestingFor === assessment.id ? (
                                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                ) : null}
                                {controls.assessment.attestation.requestAction}
                              </Button>
                            ) : null}

                            {assessment.attestation?.status === 'PENDING' && canApprove ? (
                              canDecideThis ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      setDecisionTarget({ assessment, decision: 'APPROVED' })
                                    }
                                  >
                                    {controls.assessment.attestation.approveAction}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      setDecisionTarget({ assessment, decision: 'REJECTED' })
                                    }
                                  >
                                    {controls.assessment.attestation.rejectAction}
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {isOwnAssessment && isOwner
                                    ? controls.assessment.attestation.segregationNotice.bothRule
                                    : isOwnAssessment
                                      ? controls.assessment.attestation.segregationNotice
                                          .assessorRule
                                      : controls.assessment.attestation.segregationNotice.ownerRule}
                                </p>
                              )
                            ) : null}

                            {isFailure ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemediationFor(assessment.id)}
                              >
                                {controls.remediation.openAction}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {page < totalPages ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  {controls.assessment.history.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <ControlAssessmentAttestationDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionTarget(null);
        }}
        controlId={controlId}
        assessment={decisionTarget?.assessment ?? null}
        decision={decisionTarget?.decision ?? 'APPROVED'}
        onDecided={() => {
          setDecisionTarget(null);
          refresh();
        }}
      />

      <ControlRemediationDialog
        open={remediationFor !== null}
        onOpenChange={(open) => {
          if (!open) setRemediationFor(null);
        }}
        assessmentId={remediationFor ?? ''}
        onCreated={() => setRemediationFor(null)}
      />
    </Card>
  );
}
