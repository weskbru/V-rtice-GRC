import { Injectable } from '@nestjs/common';
import { IndicatorMetricKey } from '@prisma/client';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ActionRepositoryPort } from '../../../grc/action/domain/ports/action-repository.port';
import { todayDateOnlyUtc } from '../../../grc/shared/domain/overdue.service';
import { ComplianceSummaryPort } from '../../../shared/grc-ports/compliance-summary.port';
import { ControlMetricsPort } from '../../../shared/grc-ports/control-metrics.port';
import { IncidentMetricsPort } from '../../../shared/grc-ports/incident-metrics.port';
import { IndicatorCalculationPort } from '../../../shared/grc-ports/indicator-calculation.port';
import { IndicatorMonitoringPort } from '../../../shared/grc-ports/indicator-monitoring.port';
import { ProblemMetricsPort } from '../../../shared/grc-ports/problem-metrics.port';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  ActionStatus,
  IncidentStatus,
  ProblemStatus,
  RequirementComplianceState,
} from '@prisma/client';

const ALL_METRIC_KEYS: readonly IndicatorMetricKey[] = Object.values(IndicatorMetricKey);

export const ACTION_DUE_SOON_WINDOW_DAYS = 7;

export interface DashboardSummaryMetricOutput {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export interface DashboardSummaryActionsBreakdown {
  readonly byStatus: Readonly<Record<ActionStatus, number>>;
  readonly dueSoon: number;
  readonly dueSoonWindowDays: number;
}

export interface DashboardSummaryIncidentsBreakdown {
  readonly byStatus: Readonly<Record<IncidentStatus, number>>;
}

export interface DashboardSummaryProblemsBreakdown {
  readonly byStatus: Readonly<Record<ProblemStatus, number>>;
}

export interface DashboardSummaryControlsBreakdown {
  readonly total: number;
  readonly active: number;
  readonly ineffective: number;
}

export interface DashboardSummaryComplianceBreakdown {
  readonly requirementCount: number;
  readonly byState: Readonly<Record<RequirementComplianceState, number>>;
}

export interface DashboardSummaryIndicatorsBreakdown {
  readonly monitored: number;
  readonly breached: number;
}

export interface DashboardSummaryBreakdownsOutput {
  readonly actions: DashboardSummaryActionsBreakdown | undefined;
  readonly incidents: DashboardSummaryIncidentsBreakdown | undefined;
  readonly problems: DashboardSummaryProblemsBreakdown | undefined;
  readonly controls: DashboardSummaryControlsBreakdown | undefined;
  readonly compliance: DashboardSummaryComplianceBreakdown | undefined;
  readonly indicators: DashboardSummaryIndicatorsBreakdown | undefined;
}

export interface DashboardSummaryOutput {
  readonly metrics: readonly DashboardSummaryMetricOutput[];
  readonly breakdowns: DashboardSummaryBreakdownsOutput;
}

export interface GetDashboardSummaryInput {
  readonly actorUserId: string;
}

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly indicatorCalculation: IndicatorCalculationPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly incidentMetrics: IncidentMetricsPort,
    private readonly problemMetrics: ProblemMetricsPort,
    private readonly controlMetrics: ControlMetricsPort,
    private readonly complianceSummary: ComplianceSummaryPort,
    private readonly indicatorMonitoring: IndicatorMonitoringPort,
  ) {}

  async execute(input: GetDashboardSummaryInput): Promise<DashboardSummaryOutput> {
    const [scope, permissions] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.permissionResolver.getEffectivePermissions(input.actorUserId),
    ]);

    const permittedKeys = ALL_METRIC_KEYS.filter((metricKey) => {
      const { sourcePermission } = this.indicatorCalculation.getMetadata(metricKey);
      return permissions.has(sourcePermission as PermissionIdentifier);
    });

    const [results, breakdowns] = await Promise.all([
      Promise.all(
        permittedKeys.map((metricKey) => this.indicatorCalculation.calculate({ metricKey, scope })),
      ),
      this.buildBreakdowns(scope, permissions),
    ]);

    return {
      metrics: results.map((result) => ({
        metricKey: result.metricKey,
        shape: result.shape,
        scopeApplicability: result.scopeApplicability,
        value: result.value,
        valueByBucket: result.valueByBucket,
      })),
      breakdowns,
    };
  }

  private async buildBreakdowns(
    scope: ScopeFilter,
    permissions: ReadonlySet<PermissionIdentifier>,
  ): Promise<DashboardSummaryBreakdownsOutput> {
    const [actions, incidents, problems, controls, compliance, indicators] = await Promise.all([
      permissions.has('action:view')
        ? this.buildActionsBreakdown(scope)
        : Promise.resolve(undefined),
      permissions.has('incident:view')
        ? this.incidentMetrics
            .getCountByStatus(scope)
            .then((byStatus): DashboardSummaryIncidentsBreakdown => ({ byStatus }))
        : Promise.resolve(undefined),
      permissions.has('problem:view')
        ? this.problemMetrics
            .getCountByStatus(scope)
            .then((byStatus): DashboardSummaryProblemsBreakdown => ({ byStatus }))
        : Promise.resolve(undefined),
      permissions.has('control:view')
        ? this.controlMetrics.getSummary(scope)
        : Promise.resolve(undefined),
      permissions.has('compliance:view')
        ? this.complianceSummary.getStateBreakdown()
        : Promise.resolve(undefined),
      permissions.has('indicator:view')
        ? this.indicatorMonitoring.getMonitoringSummary()
        : Promise.resolve(undefined),
    ]);

    return { actions, incidents, problems, controls, compliance, indicators };
  }

  private async buildActionsBreakdown(
    scope: ScopeFilter,
  ): Promise<DashboardSummaryActionsBreakdown> {
    const fromInclusive = todayDateOnlyUtc();
    const toExclusive = new Date(fromInclusive);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + ACTION_DUE_SOON_WINDOW_DAYS);

    const [byStatus, dueSoon] = await Promise.all([
      this.actionRepository.getStatusBreakdown(scope),
      this.actionRepository.countDueSoonInScope(scope, fromInclusive, toExclusive),
    ]);

    return { byStatus, dueSoon, dueSoonWindowDays: ACTION_DUE_SOON_WINDOW_DAYS };
  }
}
