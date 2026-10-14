'use client';

import { ShieldOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { indicatorsApi } from '@/features/indicators/api';
import { IndicatorHistorySection } from '@/features/indicators/components/indicator-history-section';
import {
  buildAvailableMetricCardValue,
  metricScopeLabel,
  metricUpdatedAtLabel,
} from '@/features/indicators/metric-card-value';
import { INDICATOR_METRIC_ICON } from '@/features/indicators/metric-visuals';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';
import { usePermissions } from '@/lib/permissions';
import {
  EmptyState,
  EntityTabs,
  ErrorState,
  LoadingState,
  MetricCard,
} from '@vertice/design-system/components';

import type { IndicatorCurrentValue, IndicatorMetricKey } from '@/features/indicators/types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

export interface IndicatorDetailViewProps {
  metricKey: IndicatorMetricKey;
}

export function IndicatorDetailView({ metricKey }: IndicatorDetailViewProps): React.JSX.Element {
  const { scope } = useAuth();
  const { hasPermission } = usePermissions();
  const [current, setCurrent] = useState<IndicatorCurrentValue | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${metricKey}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    indicatorsApi
      .getCurrentValue(metricKey)
      .then((result) => {
        if (cancelled) return;
        setCurrent(result);
        setForbidden(false);
        setProblem(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 403) {
          setForbidden(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        } else {
          setProblem({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [metricKey, requestKey]);

  const label = indicators.metricKeyLabels[metricKey];

  if (loading) {
    return <LoadingState variant="block" label={indicators.detail.loading} />;
  }

  if (forbidden) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={indicators.detail.forbidden.title}
        description={indicators.detail.forbidden.detail}
      />
    );
  }

  if (!current) {
    return (
      <ErrorState
        problem={problem}
        title={indicators.detail.loadError}
        action={
          <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
            {common.actions.retry}
          </Button>
        }
      />
    );
  }

  const canEdit = hasPermission('indicator:edit');
  const hasThreshold = Boolean(current.definition?.thresholdComparator);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{label}</h1>
        {current.definition ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{indicators.detail.definitionCode(current.definition.code)}</span>
            <span>{indicators.detail.definitionOwner(current.definition.owner.fullName)}</span>
            <span>
              {current.definition.thresholdComparator &&
              typeof current.definition.thresholdValue === 'number'
                ? indicators.detail.definitionThreshold(
                    indicators.thresholdComparatorLabels[current.definition.thresholdComparator],
                    current.definition.thresholdValue,
                  )
                : indicators.detail.definitionNoThreshold}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{indicators.detail.noDefinition}</p>
        )}
      </div>

      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={{
          scrollBack: common.entityTabs.scrollBack,
          scrollForward: common.entityTabs.scrollForward,
        }}
        tabs={[
          {
            id: 'overview',
            label: indicators.detail.sections.overview,
            content: (
              <MetricCard
                label={label}
                orgUnitLabel={metricScopeLabel(current.scopeApplicability, scope.global)}
                updatedAtLabel={metricUpdatedAtLabel(current.computedAt)}
                icon={INDICATOR_METRIC_ICON[metricKey]}
                value={buildAvailableMetricCardValue(current)}
                className="max-w-md"
              />
            ),
          },
          {
            id: 'history',
            label: indicators.detail.sections.history,
            content: (
              <IndicatorHistorySection
                metricKey={metricKey}
                metricLabel={label}
                hasThreshold={hasThreshold}
                canEdit={canEdit}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
