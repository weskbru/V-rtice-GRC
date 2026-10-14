'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { ErrorState, LoadingState, StatusBadge } from '@vertice/design-system/components';

import { complianceApi } from '../api';
import { formatTimestamp } from '../date';
import { complianceStateBadgeVariant, complianceStateIcon, complianceStateLabel } from '../status';

import type { ComplianceSummary, RequirementComplianceState } from '../types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

export interface ComplianceSummaryCardProps {
  frameworkId: string;
  versionId: string;
  refreshToken?: number;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
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
