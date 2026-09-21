'use client';

/**
 * PharosGRC — the version's calculated compliance summary (US3, FR-020,
 * operation 18). Purely a read of `ComplianceSummaryService`'s own
 * aggregate — this card computes nothing itself, mirroring FR-017's "único
 * ponto de cálculo" discipline down to the frontend: every number here is
 * exactly what the server returned, never re-derived client-side.
 *
 * `compliancePercentage: null` (a version with zero applicable
 * requirements) renders as an explicit "nothing to measure" state, never as
 * `0%` — the distinction the contract itself insists on.
 */
import { ErrorState, LoadingState, StatusBadge } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';

import { complianceApi } from '../api';
import { formatTimestamp } from '../date';
import { complianceStateBadgeVariant, complianceStateIcon, complianceStateLabel } from '../status';

import type { ComplianceSummary, RequirementComplianceState } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ComplianceSummaryCardProps {
  frameworkId: string;
  versionId: string;
  /** Bump to force a reload — e.g. after a requirement is created or a control link changes elsewhere on this screen. */
  refreshToken?: number;
  /** Called with the version's real requirement total on every successful load — lets a sibling (e.g. `PublishVersionAction`) get an accurate count without fetching it a second time. */
  onLoaded?: (summary: ComplianceSummary) => void;
}

const STATE_ORDER: readonly RequirementComplianceState[] = [
  'NOT_MET',
  'NOT_PROVEN',
  'PARTIALLY_MET',
  'COMPLIANT',
  'NOT_APPLICABLE',
];

function countFor(summary: ComplianceSummary, state: RequirementComplianceState): number {
  switch (state) {
    case 'NOT_APPLICABLE':
      return summary.counts.notApplicable;
    case 'NOT_MET':
      return summary.counts.notMet;
    case 'NOT_PROVEN':
      return summary.counts.notProven;
    case 'PARTIALLY_MET':
      return summary.counts.partiallyMet;
    case 'COMPLIANT':
      return summary.counts.compliant;
  }
}

export function ComplianceSummaryCard({
  frameworkId,
  versionId,
  refreshToken = 0,
  onLoaded,
}: ComplianceSummaryCardProps): React.JSX.Element {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${versionId}|${refreshToken}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    complianceApi
      .getFrameworkVersionComplianceSummary(frameworkId, versionId)
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
        setError(undefined);
        setResolvedRequestKey(requestKey);
        onLoaded?.(result);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` already covers `frameworkId`/`versionId`/`refreshToken`/`reloadToken`.
  }, [frameworkId, versionId, refreshToken, reloadToken]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{compliance.complianceSummary.cardTitle}</CardTitle>
        <CardDescription>{compliance.complianceSummary.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState variant="inline" label={compliance.complianceSummary.loadingLabel} />
        ) : error || !summary ? (
          <ErrorState
            problem={error}
            message={compliance.complianceSummary.loadError}
            action={
              <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
                {common.actions.retry}
              </Button>
            }
          />
        ) : summary.totalRequirements === 0 ? (
          <p className="text-sm text-muted-foreground">
            {compliance.complianceSummary.noRequirements}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {summary.compliancePercentage === null
                    ? '—'
                    : `${summary.compliancePercentage.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
                </span>
                <p className="text-xs text-muted-foreground">
                  {summary.compliancePercentage === null
                    ? compliance.complianceSummary.percentageUnavailable
                    : compliance.complianceSummary.applicableRequirements}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  {compliance.complianceSummary.totalRequirements}:{' '}
                  {summary.totalRequirements.toLocaleString('pt-BR')}
                </p>
                {summary.counts.notApplicable > 0 ? (
                  <p>
                    {compliance.complianceSummary.notApplicableCount(summary.counts.notApplicable)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATE_ORDER.filter((state) => countFor(summary, state) > 0).map((state) => (
                <StatusBadge
                  key={state}
                  variant={complianceStateBadgeVariant(state)}
                  label={`${complianceStateLabel(state)}: ${countFor(summary, state).toLocaleString('pt-BR')}`}
                  icon={complianceStateIcon(state)}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {compliance.complianceSummary.computedAt(formatTimestamp(summary.computedAt))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
