import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { IndicatorCalculationPort } from '../../../shared/grc-ports/indicator-calculation.port';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { IndicatorMetricScopeApplicability } from '../../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

export interface RunReportInput {
  readonly actorUserId: string;
  readonly reportId: string;
}

export interface ReportRunItemResult {
  readonly metricKey: IndicatorMetricKey;
  readonly label: string;
  readonly available: boolean;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export interface RunReportResult {
  readonly reportId: string;
  readonly computedAt: Date;
  readonly items: readonly ReportRunItemResult[];
}

@Injectable()
export class RunReportUseCase {
  constructor(
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly indicatorCalculation: IndicatorCalculationPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: RunReportInput): Promise<RunReportResult> {
    const definition = await this.definitionRepository.findById(input.reportId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.reports.entityLabel, input.reportId);
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const items = await Promise.all(
      definition.metricKeys.map((metricKey) =>
        this.evaluateItem(metricKey, input.actorUserId, scope),
      ),
    );

    return {
      reportId: definition.id,
      computedAt: new Date(),
      items,
    };
  }

  private async evaluateItem(
    metricKey: IndicatorMetricKey,
    actorUserId: string,
    scope: ScopeFilter,
  ): Promise<ReportRunItemResult> {
    const label = USER_MESSAGES.indicators.metricKeyLabels[metricKey];
    const metadata = this.indicatorCalculation.getMetadata(metricKey);
    const sourcePermission = metadata.sourcePermission as PermissionIdentifier;

    const canView = await this.permissionResolver.hasPermission(actorUserId, sourcePermission);
    if (!canView) {
      return {
        metricKey,
        label,
        available: false,
        scopeApplicability: metadata.scopeApplicability,
        value: undefined,
        valueByBucket: undefined,
      };
    }

    const result = await this.indicatorCalculation.calculate({ metricKey, scope });

    return {
      metricKey,
      label,
      available: true,
      scopeApplicability: result.scopeApplicability,
      value: result.value,
      valueByBucket: result.valueByBucket,
    };
  }
}
