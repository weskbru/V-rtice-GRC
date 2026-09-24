import { IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorCalculationService } from '../../src/modules/indicators/application/indicator-calculation.service';
import { ActionOverdueCountProvider } from '../../src/modules/indicators/application/metric-providers/action-indicator-metric-provider';
import { AssetInactiveCountProvider } from '../../src/modules/indicators/application/metric-providers/asset-indicator-metric-provider';
import { AuditEngagementOpenCountProvider } from '../../src/modules/indicators/application/metric-providers/audit-engagement-indicator-metric-provider';
import { CompliancePercentageProvider } from '../../src/modules/indicators/application/metric-providers/compliance-indicator-metric-provider';
import { ControlInactiveCountProvider } from '../../src/modules/indicators/application/metric-providers/control-indicator-metric-provider';
import { FindingOpenCountBySeverityProvider } from '../../src/modules/indicators/application/metric-providers/finding-indicator-metric-provider';
import { IncidentOpenCountBySeverityProvider } from '../../src/modules/indicators/application/metric-providers/incident-indicator-metric-provider';
import { ProblemOpenCountBySeverityProvider } from '../../src/modules/indicators/application/metric-providers/problem-indicator-metric-provider';
import { ProcessInactiveCountProvider } from '../../src/modules/indicators/application/metric-providers/process-indicator-metric-provider';
import {
  RiskTotalByLevelProvider,
  RiskTreatmentOverdueCountProvider,
} from '../../src/modules/indicators/application/metric-providers/risk-indicator-metric-provider';
import { getIndicatorMetricCatalogEntry } from '../../src/modules/indicators/domain/indicator-metric-catalog';

import type { ActionRepositoryPort } from '../../src/grc/action/domain/ports/action-repository.port';
import type { FindingRepositoryPort } from '../../src/grc/finding/domain/ports/finding-repository.port';
import type { IndicatorDefinitionRecord } from '../../src/modules/indicators/domain/indicator-definition.entity';
import type { AssetMetricsPort } from '../../src/shared/grc-ports/asset-metrics.port';
import type { AuditEngagementMetricsPort } from '../../src/shared/grc-ports/audit-engagement-metrics.port';
import type { ComplianceSummaryPort } from '../../src/shared/grc-ports/compliance-summary.port';
import type { ControlMetricsPort } from '../../src/shared/grc-ports/control-metrics.port';
import type { IncidentMetricsPort } from '../../src/shared/grc-ports/incident-metrics.port';
import type { ProblemMetricsPort } from '../../src/shared/grc-ports/problem-metrics.port';
import type { ProcessMetricsPort } from '../../src/shared/grc-ports/process-metrics.port';
import type { RiskDashboardMetricsPort } from '../../src/shared/grc-ports/risk-dashboard-metrics.port';
import type { ScopeFilter } from '../../src/shared/persistence/scope-filter';

const GLOBAL_SCOPE: ScopeFilter = { kind: 'GLOBAL' };

function buildFindingPage(total: number) {
  return { items: [], page: 1, pageSize: 1, total };
}

function buildService(): {
  service: IndicatorCalculationService;
  complianceSummary: ComplianceSummaryPort;
  riskDashboardMetrics: RiskDashboardMetricsPort;
  getOrganizationWideCompliancePercentageMock: ReturnType<typeof vi.fn>;
} {
  const riskDashboardMetrics = {
    getRiskCountByResidualLevel: vi
      .fn()
      .mockResolvedValue({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }),
    getOverdueTreatmentActionCount: vi.fn().mockResolvedValue(5),
  } as unknown as RiskDashboardMetricsPort;

  const controlMetrics = {
    getInactiveCount: vi.fn().mockResolvedValue(6),
  } as unknown as ControlMetricsPort;

  const auditEngagementMetrics = {
    getOpenCount: vi.fn().mockResolvedValue(7),
  } as unknown as AuditEngagementMetricsPort;

  const findingRepository = {
    list: vi.fn().mockResolvedValue(buildFindingPage(1)),
  } as unknown as FindingRepositoryPort;

  const assetMetrics = {
    getInactiveCount: vi.fn().mockResolvedValue(8),
  } as unknown as AssetMetricsPort;

  const processMetrics = {
    getInactiveCount: vi.fn().mockResolvedValue(9),
  } as unknown as ProcessMetricsPort;

  const actionRepository = {
    countOverdueInScope: vi.fn().mockResolvedValue(10),
  } as unknown as ActionRepositoryPort;

  const incidentMetrics = {
    getOpenCountBySeverity: vi.fn().mockResolvedValue({ CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1 }),
  } as unknown as IncidentMetricsPort;

  const problemMetrics = {
    getOpenCountBySeverity: vi.fn().mockResolvedValue({ CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1 }),
  } as unknown as ProblemMetricsPort;

  const getOrganizationWideCompliancePercentageMock = vi.fn().mockResolvedValue(42);
  const complianceSummary: ComplianceSummaryPort = {
    getOrganizationWideCompliancePercentage: getOrganizationWideCompliancePercentageMock,
    getStateBreakdown: vi.fn().mockResolvedValue({
      requirementCount: 0,
      byState: {
        NOT_APPLICABLE: 0,
        NOT_MET: 0,
        NOT_PROVEN: 0,
        PARTIALLY_MET: 0,
        COMPLIANT: 0,
      },
    }),
  };

  const service = new IndicatorCalculationService(
    new RiskTotalByLevelProvider(riskDashboardMetrics),
    new RiskTreatmentOverdueCountProvider(riskDashboardMetrics),
    new ControlInactiveCountProvider(controlMetrics),
    new AuditEngagementOpenCountProvider(auditEngagementMetrics),
    new FindingOpenCountBySeverityProvider(findingRepository),
    new AssetInactiveCountProvider(assetMetrics),
    new ProcessInactiveCountProvider(processMetrics),
    new ActionOverdueCountProvider(actionRepository),
    new IncidentOpenCountBySeverityProvider(incidentMetrics),
    new ProblemOpenCountBySeverityProvider(problemMetrics),
    new CompliancePercentageProvider(complianceSummary),
  );

  return {
    service,
    complianceSummary,
    riskDashboardMetrics,
    getOrganizationWideCompliancePercentageMock,
  };
}

describe('IndicatorCalculationService (T029)', () => {
  it('has a registered provider for every IndicatorMetricKey value — derived from the enum', async () => {
    const { service } = buildService();

    for (const metricKey of Object.values(IndicatorMetricKey)) {
      await expect(
        service.calculate({ metricKey, scope: GLOBAL_SCOPE, definition: undefined }),
        `metricKey=${metricKey}`,
      ).resolves.toBeDefined();
    }
  });

  it('every enum key resolves with the shape the catalog declares — never both value and valueByBucket', async () => {
    const { service } = buildService();

    for (const metricKey of Object.values(IndicatorMetricKey)) {
      const catalogEntry = getIndicatorMetricCatalogEntry(metricKey);
      const result = await service.calculate({
        metricKey,
        scope: GLOBAL_SCOPE,
        definition: undefined,
      });

      expect(result.shape, metricKey).toBe(catalogEntry.shape);
      expect(result.scopeApplicability, metricKey).toBe(catalogEntry.scopeApplicability);

      if (catalogEntry.shape === 'SINGLE_VALUE') {
        expect(result.valueByBucket, metricKey).toBeUndefined();
      } else {
        expect(result.value, metricKey).toBeUndefined();
        expect(result.valueByBucket, metricKey).toBeDefined();
      }
    }
  });

  it('CompliancePercentageProvider.computeValue takes NO ScopeFilter parameter (research.md D-8)', () => {
    expect(CompliancePercentageProvider.prototype.computeValue.length).toBe(0);
  });

  it('every scoped provider takes exactly one ScopeFilter parameter, by contrast', () => {
    type ScopedProviderClass =
      | typeof RiskTotalByLevelProvider
      | typeof RiskTreatmentOverdueCountProvider
      | typeof ControlInactiveCountProvider
      | typeof AuditEngagementOpenCountProvider
      | typeof FindingOpenCountBySeverityProvider
      | typeof AssetInactiveCountProvider
      | typeof ProcessInactiveCountProvider
      | typeof ActionOverdueCountProvider
      | typeof IncidentOpenCountBySeverityProvider
      | typeof ProblemOpenCountBySeverityProvider;

    const scopedProviderClasses: readonly ScopedProviderClass[] = [
      RiskTotalByLevelProvider,
      RiskTreatmentOverdueCountProvider,
      ControlInactiveCountProvider,
      AuditEngagementOpenCountProvider,
      FindingOpenCountBySeverityProvider,
      AssetInactiveCountProvider,
      ProcessInactiveCountProvider,
      ActionOverdueCountProvider,
      IncidentOpenCountBySeverityProvider,
      ProblemOpenCountBySeverityProvider,
    ];

    for (const providerClass of scopedProviderClasses) {
      expect(providerClass.prototype.computeValue.length, providerClass.name).toBe(1);
    }
  });

  it('never calls getOrganizationWideCompliancePercentage with any argument', async () => {
    const { service, getOrganizationWideCompliancePercentageMock } = buildService();

    await service.calculate({
      metricKey: 'COMPLIANCE_PERCENTAGE',
      scope: GLOBAL_SCOPE,
      definition: undefined,
    });

    expect(getOrganizationWideCompliancePercentageMock).toHaveBeenCalledWith();
  });

  it('evaluates breached against a SINGLE_VALUE metric’s configured threshold, in the same call (FR-016)', async () => {
    const { service } = buildService();
    const definitionBreached: IndicatorDefinitionRecord = {
      id: 'def-1',
      code: 'IND-2026-0001',
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
      name: 'Ações de tratamento em atraso',
      description: 'desc',
      ownerUserId: 'user-1',
      thresholdComparator: 'GTE',
      thresholdValue: 5,
      isActive: true,
      createdByUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const breachedResult = await service.calculate({
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
      scope: GLOBAL_SCOPE,
      definition: definitionBreached,
    });
    expect(breachedResult.value).toBe(5);
    expect(breachedResult.breached).toBe(true);

    const definitionNotBreached: IndicatorDefinitionRecord = {
      ...definitionBreached,
      thresholdValue: 100,
    };
    const notBreachedResult = await service.calculate({
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
      scope: GLOBAL_SCOPE,
      definition: definitionNotBreached,
    });
    expect(notBreachedResult.breached).toBe(false);
  });

  it('never breaches when no IndicatorDefinition exists for the key (FR-019)', async () => {
    const { service } = buildService();

    const result = await service.calculate({
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
      scope: GLOBAL_SCOPE,
      definition: undefined,
    });

    expect(result.breached).toBe(false);
  });

  it('never breaches a BY_BUCKET metric, even with a (meaningless) threshold on the definition', async () => {
    const { service } = buildService();

    const bucketDefinition: IndicatorDefinitionRecord = {
      id: 'def-2',
      code: 'IND-2026-0002',
      metricKey: 'RISK_TOTAL_BY_LEVEL',
      name: 'Total de riscos por nível',
      description: 'desc',
      ownerUserId: 'user-1',
      thresholdComparator: 'GTE',
      thresholdValue: 0,
      isActive: true,
      createdByUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await service.calculate({
      metricKey: 'RISK_TOTAL_BY_LEVEL',
      scope: GLOBAL_SCOPE,
      definition: bucketDefinition,
    });

    expect(result.shape).toBe('BY_BUCKET');
    expect(result.breached).toBe(false);
  });

  it('never breaches COMPLIANCE_PERCENTAGE when the source has no data yet (value undefined)', async () => {
    const complianceSummary = {
      getOrganizationWideCompliancePercentage: vi.fn().mockResolvedValue(undefined),
    } as unknown as ComplianceSummaryPort;
    const riskDashboardMetrics = {
      getRiskCountByResidualLevel: vi.fn(),
      getOverdueTreatmentActionCount: vi.fn(),
    } as unknown as RiskDashboardMetricsPort;

    const service = new IndicatorCalculationService(
      new RiskTotalByLevelProvider(riskDashboardMetrics),
      new RiskTreatmentOverdueCountProvider(riskDashboardMetrics),
      new ControlInactiveCountProvider({ getInactiveCount: vi.fn(), getSummary: vi.fn() }),
      new AuditEngagementOpenCountProvider({ getOpenCount: vi.fn() }),
      new FindingOpenCountBySeverityProvider({
        list: vi.fn().mockResolvedValue(buildFindingPage(0)),
      } as unknown as FindingRepositoryPort),
      new AssetInactiveCountProvider({ getInactiveCount: vi.fn() }),
      new ProcessInactiveCountProvider({ getInactiveCount: vi.fn() }),
      new ActionOverdueCountProvider({
        countOverdueInScope: vi.fn(),
      } as unknown as ActionRepositoryPort),
      new IncidentOpenCountBySeverityProvider({
        getOpenCountBySeverity: vi.fn(),
        getCountByStatus: vi.fn(),
      }),
      new ProblemOpenCountBySeverityProvider({
        getOpenCountBySeverity: vi.fn(),
        getCountByStatus: vi.fn(),
      }),
      new CompliancePercentageProvider(complianceSummary),
    );

    const definition: IndicatorDefinitionRecord = {
      id: 'def-3',
      code: 'IND-2026-0003',
      metricKey: 'COMPLIANCE_PERCENTAGE',
      name: 'Percentual de conformidade',
      description: 'desc',
      ownerUserId: 'user-1',
      thresholdComparator: 'LT',
      thresholdValue: 50,
      isActive: true,
      createdByUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await service.calculate({
      metricKey: 'COMPLIANCE_PERCENTAGE',
      scope: GLOBAL_SCOPE,
      definition,
    });

    expect(result.value).toBeUndefined();
    expect(result.breached).toBe(false);
  });
});
