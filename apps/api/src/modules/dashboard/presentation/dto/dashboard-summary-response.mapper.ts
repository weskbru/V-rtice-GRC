import type {
  DashboardSummaryActionsBreakdown,
  DashboardSummaryBreakdownsOutput,
  DashboardSummaryComplianceBreakdown,
  DashboardSummaryControlsBreakdown,
  DashboardSummaryIncidentsBreakdown,
  DashboardSummaryIndicatorsBreakdown,
  DashboardSummaryMetricOutput,
  DashboardSummaryOutput,
  DashboardSummaryProblemsBreakdown,
} from '../../application/get-dashboard-summary.usecase';
import type {
  ActionStatus,
  IncidentStatus,
  IndicatorMetricKey,
  ProblemStatus,
  RequirementComplianceState,
} from '@prisma/client';

export interface DashboardSummaryMetricResponse {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value?: number | undefined;
  readonly valueByBucket?: Readonly<Record<string, number>> | undefined;
}

export interface DashboardSummaryActionsBreakdownResponse {
  readonly byStatus: Readonly<Record<ActionStatus, number>>;
  readonly dueSoon: number;
  readonly dueSoonWindowDays: number;
}

export interface DashboardSummaryIncidentsBreakdownResponse {
  readonly byStatus: Readonly<Record<IncidentStatus, number>>;
}

export interface DashboardSummaryProblemsBreakdownResponse {
  readonly byStatus: Readonly<Record<ProblemStatus, number>>;
}

export interface DashboardSummaryControlsBreakdownResponse {
  readonly total: number;
  readonly active: number;
  readonly ineffective: number;
}

export interface DashboardSummaryComplianceBreakdownResponse {
  readonly requirementCount: number;
  readonly byState: Readonly<Record<RequirementComplianceState, number>>;
}

export interface DashboardSummaryIndicatorsBreakdownResponse {
  readonly monitored: number;
  readonly breached: number;
}

export interface DashboardSummaryBreakdownsResponse {
  readonly actions?: DashboardSummaryActionsBreakdownResponse | undefined;
  readonly incidents?: DashboardSummaryIncidentsBreakdownResponse | undefined;
  readonly problems?: DashboardSummaryProblemsBreakdownResponse | undefined;
  readonly controls?: DashboardSummaryControlsBreakdownResponse | undefined;
  readonly compliance?: DashboardSummaryComplianceBreakdownResponse | undefined;
  readonly indicators?: DashboardSummaryIndicatorsBreakdownResponse | undefined;
}

export interface DashboardSummaryResponse {
  readonly metrics: readonly DashboardSummaryMetricResponse[];
  readonly breakdowns: DashboardSummaryBreakdownsResponse;
}

function toMetricResponse(metric: DashboardSummaryMetricOutput): DashboardSummaryMetricResponse {
  return {
    metricKey: metric.metricKey,
    shape: metric.shape,
    scopeApplicability: metric.scopeApplicability,
    value: metric.value,
    valueByBucket: metric.valueByBucket,
  };
}

function toActionsBreakdownResponse(
  actions: DashboardSummaryActionsBreakdown,
): DashboardSummaryActionsBreakdownResponse {
  return {
    byStatus: actions.byStatus,
    dueSoon: actions.dueSoon,
    dueSoonWindowDays: actions.dueSoonWindowDays,
  };
}

function toIncidentsBreakdownResponse(
  incidents: DashboardSummaryIncidentsBreakdown,
): DashboardSummaryIncidentsBreakdownResponse {
  return { byStatus: incidents.byStatus };
}

function toProblemsBreakdownResponse(
  problems: DashboardSummaryProblemsBreakdown,
): DashboardSummaryProblemsBreakdownResponse {
  return { byStatus: problems.byStatus };
}

function toControlsBreakdownResponse(
  controls: DashboardSummaryControlsBreakdown,
): DashboardSummaryControlsBreakdownResponse {
  return { total: controls.total, active: controls.active, ineffective: controls.ineffective };
}

function toComplianceBreakdownResponse(
  compliance: DashboardSummaryComplianceBreakdown,
): DashboardSummaryComplianceBreakdownResponse {
  return { requirementCount: compliance.requirementCount, byState: compliance.byState };
}

function toIndicatorsBreakdownResponse(
  indicators: DashboardSummaryIndicatorsBreakdown,
): DashboardSummaryIndicatorsBreakdownResponse {
  return { monitored: indicators.monitored, breached: indicators.breached };
}

function toBreakdownsResponse(
  breakdowns: DashboardSummaryBreakdownsOutput,
): DashboardSummaryBreakdownsResponse {
  return {
    actions: breakdowns.actions ? toActionsBreakdownResponse(breakdowns.actions) : undefined,
    incidents: breakdowns.incidents
      ? toIncidentsBreakdownResponse(breakdowns.incidents)
      : undefined,
    problems: breakdowns.problems ? toProblemsBreakdownResponse(breakdowns.problems) : undefined,
    controls: breakdowns.controls ? toControlsBreakdownResponse(breakdowns.controls) : undefined,
    compliance: breakdowns.compliance
      ? toComplianceBreakdownResponse(breakdowns.compliance)
      : undefined,
    indicators: breakdowns.indicators
      ? toIndicatorsBreakdownResponse(breakdowns.indicators)
      : undefined,
  };
}

export function toDashboardSummaryResponse(
  output: DashboardSummaryOutput,
): DashboardSummaryResponse {
  return {
    metrics: output.metrics.map(toMetricResponse),
    breakdowns: toBreakdownsResponse(output.breakdowns),
  };
}
