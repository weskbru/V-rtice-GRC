'use client';

import { EmptyState, ErrorState, LoadingState } from '@pharos/design-system/components';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ClipboardCheck,
  Gauge,
  Gavel,
  LayoutGrid,
  ListChecks,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/features/dashboard/api';
import { ActionStatusDonut } from '@/features/dashboard/components/action-status-donut';
import { DashboardChartCard } from '@/features/dashboard/components/dashboard-chart-card';
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero';
import { DashboardModuleCard } from '@/features/dashboard/components/dashboard-module-card';
import { DashboardQuickActions } from '@/features/dashboard/components/dashboard-quick-actions';
import { DashboardStatCard } from '@/features/dashboard/components/dashboard-stat-card';
import surfaces from '@/features/dashboard/components/dashboard-surfaces.module.css';
import { RiskLevelChart } from '@/features/dashboard/components/risk-level-chart';
import { RiskStatusChart } from '@/features/dashboard/components/risk-status-chart';
import {
  bucketTotal,
  bucketValue,
  hasMetric,
  indexSummary,
  singleValue,
  sumOf,
} from '@/features/dashboard/summary';
import { ApiError } from '@/lib/api-client';
import { dashboard } from '@/lib/messages/dashboard';
import { incidents } from '@/lib/messages/incidents';
import { problems } from '@/lib/messages/problems';
import { usePermissions } from '@/lib/permissions';

import { DashboardAreaCard } from './dashboard-area-card';

import type { DashboardModuleMetric } from '@/features/dashboard/components/dashboard-module-card';
import type { DashboardResponse, DashboardSummaryResponse } from '@/features/dashboard/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const SECTION_HEADING = 'text-base font-semibold text-foreground';

function optionalStatusMetric(label: string, value: number | undefined): DashboardModuleMetric[] {
  return value === undefined ? [] : [{ label, value, tone: 'info' }];
}

export default function DashboardPage(): React.JSX.Element {
  const { hasPermission, hasAllPermissions } = usePermissions();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([dashboardApi.getDashboard(), dashboardApi.getSummary()])
      .then(([dashboardResult, summaryResult]) => {
        if (cancelled) return;

        setSummaryFailed(summaryResult.status === 'rejected');
        setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null);

        if (dashboardResult.status === 'rejected') {
          throw dashboardResult.reason;
        }
        setData(dashboardResult.value);
        setError(undefined);
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
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const canViewRisks = hasPermission('risk:view');
  const canDecideApprovals = hasAllPermissions(['risk:view', 'risk:approve']);

  const metrics = indexSummary(summary);
  const breakdowns = summary?.breakdowns ?? {};

  const hasOverdueActions = hasMetric(metrics, 'ACTION_OVERDUE_COUNT');
  const hasIncidents = hasMetric(metrics, 'INCIDENT_OPEN_COUNT_BY_SEVERITY');
  const hasProblems = hasMetric(metrics, 'PROBLEM_OPEN_COUNT_BY_SEVERITY');
  const hasControls =
    hasMetric(metrics, 'CONTROL_INACTIVE_COUNT') || breakdowns.controls !== undefined;
  const hasCompliance =
    hasMetric(metrics, 'COMPLIANCE_PERCENTAGE') || breakdowns.compliance !== undefined;
  const hasEngagements = hasMetric(metrics, 'AUDIT_ENGAGEMENT_OPEN_COUNT');
  const hasFindings = hasMetric(metrics, 'FINDING_OPEN_COUNT_BY_SEVERITY');
  const hasActions = hasOverdueActions || breakdowns.actions !== undefined;

  const hasAttention =
    canDecideApprovals ||
    canViewRisks ||
    hasActions ||
    hasIncidents ||
    breakdowns.problems !== undefined;
  const hasOverview =
    summaryFailed ||
    canViewRisks ||
    hasActions ||
    hasIncidents ||
    hasProblems ||
    hasControls ||
    hasCompliance ||
    hasEngagements ||
    hasFindings ||
    breakdowns.indicators !== undefined;
  const hasCharts = canViewRisks || breakdowns.actions !== undefined;

  return (
    <div className="flex flex-col gap-8">
      <DashboardHero />

      {error ? (
        <ErrorState
          problem={error}
          title={dashboard.states.errorTitle}
          action={
            <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
              {dashboard.states.retry}
            </Button>
          }
        />
      ) : !data ? (
        <LoadingState variant="block" label={dashboard.states.loadingLabel} />
      ) : (
        <>
          {hasAttention ? (
            <section
              aria-labelledby="dashboard-attention-heading"
              className={`flex flex-col gap-2.5 rounded-xl p-3.5 ${surfaces.attention}`}
            >
              <div className="flex items-center gap-2">
                <Bell aria-hidden="true" className={`size-5 ${surfaces.attentionIcon}`} />
                <h2 id="dashboard-attention-heading" className={SECTION_HEADING}>
                  {dashboard.sections.needsAttention}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-3 min-[1440px]:grid-cols-6">
                {canDecideApprovals ? (
                  <DashboardStatCard
                    title={dashboard.attention.pendingApprovals.title}
                    icon={ClipboardCheck}
                    contextTone="amber"
                    value={data.pendingApprovals.total}
                    contextLabel={dashboard.attention.pendingApprovals.context}
                  />
                ) : null}

                {hasOverdueActions ? (
                  <DashboardStatCard
                    title={dashboard.attention.overdueActions.title}
                    icon={TriangleAlert}
                    contextTone="red"
                    value={singleValue(metrics, 'ACTION_OVERDUE_COUNT')}
                    contextLabel={dashboard.attention.overdueActions.context}
                    link={{ path: '/actions', label: dashboard.attention.overdueActions.link }}
                  />
                ) : null}

                {breakdowns.actions ? (
                  <DashboardStatCard
                    title={dashboard.attention.dueSoonActions.title}
                    icon={CalendarClock}
                    contextTone="blue"
                    value={breakdowns.actions.dueSoon}
                    contextLabel={dashboard.attention.dueSoonActions.context(
                      breakdowns.actions.dueSoonWindowDays,
                    )}
                    link={{ path: '/actions', label: dashboard.attention.dueSoonActions.link }}
                  />
                ) : null}

                {canViewRisks ? (
                  <DashboardStatCard
                    title={dashboard.attention.itemsRequiringReview.title}
                    icon={ShieldAlert}
                    contextTone="teal"
                    value={data.itemsRequiringReview.total}
                    contextLabel={dashboard.attention.itemsRequiringReview.context}
                    link={{
                      path: data.itemsRequiringReview.link.path,
                      label: dashboard.attention.itemsRequiringReview.link,
                    }}
                  />
                ) : null}

                {hasIncidents ? (
                  <DashboardStatCard
                    title={dashboard.attention.openIncidents.title}
                    icon={Siren}
                    contextTone="red"
                    value={bucketTotal(metrics, 'INCIDENT_OPEN_COUNT_BY_SEVERITY')}
                    contextLabel={dashboard.attention.openIncidents.context(
                      bucketValue(metrics, 'INCIDENT_OPEN_COUNT_BY_SEVERITY', 'CRITICAL'),
                    )}
                    link={{ path: '/incidents', label: dashboard.attention.openIncidents.link }}
                  />
                ) : null}

                {breakdowns.problems ? (
                  <DashboardStatCard
                    title={dashboard.attention.pendingProblems.title}
                    icon={AlertTriangle}
                    contextTone="violet"
                    value={sumOf(breakdowns.problems.byStatus, ['OPEN', 'IN_ANALYSIS'])}
                    contextLabel={dashboard.attention.pendingProblems.context}
                    link={{
                      path: '/problems?status=OPEN,IN_ANALYSIS',
                      label: dashboard.attention.pendingProblems.link,
                    }}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-3">
            {hasOverview ? (
              <section
                aria-labelledby="dashboard-overview-heading"
                className={`flex flex-col gap-2 rounded-xl p-3 ${surfaces.overview}`}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid aria-hidden="true" className="size-5 text-foreground" />
                  <h2 id="dashboard-overview-heading" className={SECTION_HEADING}>
                    {dashboard.sections.overview}
                  </h2>
                </div>
                {summaryFailed ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {dashboard.states.summaryUnavailable}
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {canViewRisks ? (
                    <DashboardModuleCard
                      title={dashboard.modules.risks.title}
                      icon={ShieldAlert}
                      tone="teal"
                      metrics={[
                        { label: dashboard.modules.risks.total, value: data.risks.total },
                        {
                          label: dashboard.modules.risks.high,
                          value: data.risks.byResidualLevel.HIGH,
                          tone: 'warning',
                        },
                        {
                          label: dashboard.modules.risks.critical,
                          value: data.risks.byResidualLevel.CRITICAL,
                          tone: 'danger',
                        },
                      ]}
                      link={{ path: data.risks.link.path, label: dashboard.modules.risks.link }}
                    />
                  ) : null}

                  {hasActions ? (
                    <DashboardModuleCard
                      title={dashboard.modules.actions.title}
                      icon={ListChecks}
                      tone="blue"
                      metrics={[
                        {
                          label: dashboard.modules.actions.open,
                          value: sumOf(breakdowns.actions?.byStatus, ['OPEN', 'IN_PROGRESS']),
                        },
                        {
                          label: dashboard.modules.actions.overdue,
                          value: singleValue(metrics, 'ACTION_OVERDUE_COUNT'),
                          tone: 'danger',
                        },
                        {
                          label: dashboard.modules.actions.dueSoon,
                          value: breakdowns.actions?.dueSoon,
                          tone: 'warning',
                        },
                      ]}
                      link={{ path: '/actions', label: dashboard.modules.actions.link }}
                    />
                  ) : null}

                  {hasIncidents ? (
                    <DashboardModuleCard
                      title={dashboard.modules.incidents.title}
                      icon={Siren}
                      tone="red"
                      metrics={[
                        {
                          label: dashboard.modules.incidents.open,
                          value: bucketTotal(metrics, 'INCIDENT_OPEN_COUNT_BY_SEVERITY'),
                        },
                        {
                          label: dashboard.modules.incidents.critical,
                          value: bucketValue(
                            metrics,
                            'INCIDENT_OPEN_COUNT_BY_SEVERITY',
                            'CRITICAL',
                          ),
                          tone: 'danger',
                        },
                        ...optionalStatusMetric(
                          incidents.statusLabels.IN_PROGRESS,
                          breakdowns.incidents?.byStatus.IN_PROGRESS,
                        ),
                      ]}
                      link={{ path: '/incidents', label: dashboard.modules.incidents.link }}
                    />
                  ) : null}

                  {hasProblems ? (
                    <DashboardModuleCard
                      title={dashboard.modules.problems.title}
                      icon={AlertTriangle}
                      tone="violet"
                      metrics={[
                        {
                          label: dashboard.modules.problems.open,
                          value: bucketTotal(metrics, 'PROBLEM_OPEN_COUNT_BY_SEVERITY'),
                        },
                        ...optionalStatusMetric(
                          problems.statusLabels.IN_ANALYSIS,
                          breakdowns.problems?.byStatus.IN_ANALYSIS,
                        ),
                        {
                          label: dashboard.modules.problems.critical,
                          value: bucketValue(metrics, 'PROBLEM_OPEN_COUNT_BY_SEVERITY', 'CRITICAL'),
                          tone: 'danger',
                        },
                      ]}
                      link={{ path: '/problems', label: dashboard.modules.problems.link }}
                    />
                  ) : null}

                  {hasControls ? (
                    <DashboardModuleCard
                      title={dashboard.modules.controls.title}
                      icon={ShieldCheck}
                      tone="amber"
                      metrics={[
                        {
                          label: dashboard.modules.controls.total,
                          value: breakdowns.controls?.total,
                        },
                        {
                          label: dashboard.modules.controls.ineffective,
                          value: breakdowns.controls?.ineffective,
                          tone: 'warning',
                        },
                        {
                          label: dashboard.modules.controls.inactive,
                          value: singleValue(metrics, 'CONTROL_INACTIVE_COUNT'),
                        },
                      ]}
                      link={{ path: '/controls', label: dashboard.modules.controls.link }}
                    />
                  ) : null}

                  {hasCompliance ? (
                    <DashboardModuleCard
                      title={dashboard.modules.compliance.title}
                      icon={ScrollText}
                      tone="indigo"
                      metrics={[
                        {
                          label: dashboard.modules.compliance.percentage,
                          value: singleValue(metrics, 'COMPLIANCE_PERCENTAGE'),
                          unit: 'percent',
                        },
                        {
                          label: dashboard.modules.compliance.requirements,
                          value: breakdowns.compliance?.requirementCount,
                        },
                        {
                          label: dashboard.modules.compliance.notMet,
                          value: breakdowns.compliance?.byState.NOT_MET,
                          tone: 'danger',
                        },
                      ]}
                      link={{ path: '/compliance', label: dashboard.modules.compliance.link }}
                    />
                  ) : null}

                  {hasEngagements || hasFindings ? (
                    <DashboardModuleCard
                      title={dashboard.modules.audits.title}
                      icon={Gavel}
                      tone="orange"
                      metrics={[
                        ...(hasEngagements
                          ? [
                              {
                                label: dashboard.modules.audits.openEngagements,
                                value: singleValue(metrics, 'AUDIT_ENGAGEMENT_OPEN_COUNT'),
                              },
                            ]
                          : []),
                        ...(hasFindings
                          ? [
                              {
                                label: dashboard.modules.audits.openFindings,
                                value: bucketTotal(metrics, 'FINDING_OPEN_COUNT_BY_SEVERITY'),
                              },
                              {
                                label: dashboard.modules.audits.criticalFindings,
                                value: bucketValue(
                                  metrics,
                                  'FINDING_OPEN_COUNT_BY_SEVERITY',
                                  'CRITICAL',
                                ),
                                tone: 'danger' as const,
                              },
                            ]
                          : []),
                      ]}
                      link={{ path: '/audits', label: dashboard.modules.audits.link }}
                    />
                  ) : null}

                  {breakdowns.indicators ? (
                    <DashboardModuleCard
                      title={dashboard.modules.indicators.title}
                      icon={Gauge}
                      tone="green"
                      metrics={[
                        {
                          label: dashboard.modules.indicators.monitored,
                          value: breakdowns.indicators.monitored,
                        },
                        {
                          label: dashboard.modules.indicators.breached,
                          value: breakdowns.indicators.breached,
                          tone: 'danger',
                        },
                      ]}
                      link={{ path: '/indicators', label: dashboard.modules.indicators.link }}
                    />
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {hasCharts ? (
            <section
              aria-labelledby="dashboard-distribution-heading"
              className="flex flex-col gap-3"
            >
              <h2 id="dashboard-distribution-heading" className="sr-only">
                {dashboard.sections.distribution}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                {canViewRisks ? (
                  <DashboardChartCard
                    title={dashboard.charts.riskLevel.title}
                    description={dashboard.charts.riskLevel.description}
                    icon={ShieldAlert}
                    tone="teal"
                    className="xl:col-span-2"
                  >
                    <RiskLevelChart byResidualLevel={data.risks.byResidualLevel} />
                  </DashboardChartCard>
                ) : null}

                {canViewRisks ? (
                  <DashboardChartCard
                    title={dashboard.charts.riskStatus.title}
                    description={dashboard.charts.riskStatus.description}
                    icon={ShieldAlert}
                    tone="teal"
                  >
                    <RiskStatusChart byStatus={data.risks.byStatus} />
                  </DashboardChartCard>
                ) : null}

                {breakdowns.actions ? (
                  <DashboardChartCard
                    title={dashboard.charts.actionStatus.title}
                    description={dashboard.charts.actionStatus.description}
                    icon={ListChecks}
                    tone="blue"
                  >
                    <ActionStatusDonut byStatus={breakdowns.actions.byStatus} />
                  </DashboardChartCard>
                ) : null}
              </div>
            </section>
          ) : null}

          <DashboardQuickActions />

          {data.plannedAreas.length > 0 ? (
            <section aria-labelledby="dashboard-planned-heading" className="flex flex-col gap-3">
              <h2 id="dashboard-planned-heading" className={SECTION_HEADING}>
                {dashboard.sections.plannedModules}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.plannedAreas.map((area) => (
                  <DashboardAreaCard key={area.key} label={area.label} />
                ))}
              </div>
            </section>
          ) : null}

          {!hasAttention && !hasOverview ? (
            <EmptyState
              title={dashboard.states.nothingVisible.title}
              description={dashboard.states.nothingVisible.description}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
