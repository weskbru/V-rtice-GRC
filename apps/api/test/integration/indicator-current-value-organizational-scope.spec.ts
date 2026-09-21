/**
 * 009-indicators-reports, T032 — SC-001. Proves, for every
 * `IndicatorMetricKey` whose `scopeApplicability` is `'ORGANIZATIONAL_UNIT'`
 * (ten of the eleven, data-model.md §3), that the value
 * `GetIndicatorCurrentValueUseCase` returns for a caller scoped to exactly
 * ONE organizational unit is identical to a manual count built by a query
 * this file writes itself — directly against Prisma, filtered by the SAME
 * unit — never by calling the metric provider or its underlying port under
 * test. Two independently-written paths landing on the same number is the
 * actual proof; a test that only re-invoked the provider under a different
 * name would prove nothing (spec.md SC-001, this task's own instructions).
 *
 * Each scenario also proves the SYMMETRIC half spec.md's own edge cases and
 * research.md D-8/FR-007 require: data seeded in a SECOND organizational
 * unit, never visible to the caller, is verified to exist (a nonzero
 * independent count) and yet never reflected in the caller's result — a
 * test that only checked "what's inside" would pass identically whether or
 * not the scope filter had been deleted, exactly the vacuous-guard pattern
 * this repository has already paid for more than once (see this task's own
 * briefing, and `incident-problem-links-source-scope.spec.ts`, the model
 * this file follows for shape and rigor).
 *
 * `COMPLIANCE_PERCENTAGE` (the ONE `'ORGANIZATION_WIDE'` key, research.md
 * D-8: `Requirement`/`FrameworkVersion` have no `orgUnitId` column at all)
 * gets the OPPOSITE proof at the end of this file: two callers scoped to
 * two DIFFERENT organizational units must see the IDENTICAL value — turning
 * a documented decision into a verified one, not merely a comment.
 */
import { randomUUID } from 'node:crypto';

import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { todayDateOnlyUtc } from '../../src/grc/shared/domain/overdue.service';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { GetIndicatorCurrentValueUseCase } from '../../src/modules/indicators/application/get-indicator-current-value.usecase';
import { IndicatorsModule } from '../../src/modules/indicators/indicators.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { OrganizationalUnit, User } from '@prisma/client';

describe('GetIndicatorCurrentValueUseCase — organizational-scope parity, one per UNIT-scoped domain (SC-001)', () => {
  let ctx: IntegrationTestContext;
  let useCase: GetIndicatorCurrentValueUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IndicatorsModule],
    });
    useCase = ctx.app.get(GetIndicatorCurrentValueUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Two fresh organizational units per scenario: `unitA` is where the
   * caller is scoped; `unitB` exists purely to prove out-of-scope data
   * never leaks in. */
  async function createTwoUnits(prefix: string): Promise<{
    unitA: OrganizationalUnit;
    unitB: OrganizationalUnit;
  }> {
    const unitA = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker(`${prefix}-a`) });
    const unitB = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker(`${prefix}-b`) });
    return { unitA, unitB };
  }

  /** A caller scoped to exactly `orgUnit`, holding `permissions`. */
  async function createUnitScopedActor(
    prefix: string,
    orgUnit: OrganizationalUnit,
    permissions: readonly PermissionIdentifier[],
  ): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker(prefix)}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-${prefix}-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    return actor;
  }

  // ---------------------------------------------------------------------
  // RISK_TOTAL_BY_LEVEL — BY_BUCKET (data-model.md §3)
  // ---------------------------------------------------------------------
  it('RISK_TOTAL_BY_LEVEL — bucket count by residualLevel matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('risk-level');
    const actor = await createUnitScopedActor('risk-level-actor', unitA, [
      'indicator:view',
      'risk:view',
    ]);

    async function createRisk(orgUnitId: string, residualLevel: string | null) {
      return ctx.prisma.client.risk.create({
        data: {
          code: uniqueTestMarker('risk-level'),
          title: 'Risco para paridade de escopo de indicador',
          description: 'Descrição.',
          orgUnitId,
          ownerUserId: actor.id,
          identifiedOn: new Date('2026-01-01'),
          residualLevel: residualLevel as never,
        },
      });
    }

    await createRisk(unitA.id, 'HIGH');
    await createRisk(unitA.id, 'HIGH');
    await createRisk(unitA.id, 'LOW');
    await createRisk(unitA.id, null); // No residual level yet — must fall into no bucket.
    // unitB — must never be counted for the unitA-scoped caller.
    await createRisk(unitB.id, 'HIGH');
    await createRisk(unitB.id, 'HIGH');
    await createRisk(unitB.id, 'HIGH');

    const expectedUnitA = {
      LOW: await ctx.prisma.client.risk.count({
        where: { orgUnitId: unitA.id, residualLevel: 'LOW' },
      }),
      MEDIUM: await ctx.prisma.client.risk.count({
        where: { orgUnitId: unitA.id, residualLevel: 'MEDIUM' },
      }),
      HIGH: await ctx.prisma.client.risk.count({
        where: { orgUnitId: unitA.id, residualLevel: 'HIGH' },
      }),
      CRITICAL: await ctx.prisma.client.risk.count({
        where: { orgUnitId: unitA.id, residualLevel: 'CRITICAL' },
      }),
    };
    expect(expectedUnitA).toEqual({ LOW: 1, MEDIUM: 0, HIGH: 2, CRITICAL: 0 });

    // unitB has qualifying data — proves there is something real to leak.
    const unitBHighCount = await ctx.prisma.client.risk.count({
      where: { orgUnitId: unitB.id, residualLevel: 'HIGH' },
    });
    expect(unitBHighCount).toBe(3);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'RISK_TOTAL_BY_LEVEL',
    });

    expect(result.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');
    expect(result.valueByBucket).toEqual(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // RISK_TREATMENT_OVERDUE_COUNT — SINGLE_VALUE, join through Action.originId
  // ---------------------------------------------------------------------
  it('RISK_TREATMENT_OVERDUE_COUNT — overdue treatment-action count matches a manual risk->action join, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('risk-treatment');
    const actor = await createUnitScopedActor('risk-treatment-actor', unitA, [
      'indicator:view',
      'risk:view',
    ]);

    const today = todayDateOnlyUtc();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    async function createRiskWithTreatmentAction(orgUnitId: string, status: string, dueOn: Date) {
      const risk = await ctx.prisma.client.risk.create({
        data: {
          code: uniqueTestMarker('risk-treat'),
          title: 'Risco com ação de tratamento',
          description: 'Descrição.',
          orgUnitId,
          ownerUserId: actor.id,
          identifiedOn: new Date('2026-01-01'),
        },
      });
      await ctx.prisma.client.action.create({
        data: {
          code: uniqueTestMarker('act-treat'),
          orgUnitId,
          originType: 'RISK_TREATMENT',
          originId: risk.id,
          title: 'Ação de tratamento',
          responsibleUserId: actor.id,
          dueOn,
          status: status as never,
        },
      });
      return risk;
    }

    // unitA: one genuinely overdue treatment action, one not-yet-due.
    await createRiskWithTreatmentAction(unitA.id, 'OPEN', yesterday);
    await createRiskWithTreatmentAction(unitA.id, 'OPEN', tomorrow);
    // unitB: an overdue treatment action that must never leak into unitA's count.
    await createRiskWithTreatmentAction(unitB.id, 'OPEN', yesterday);

    // Manual, independent path: find risk ids per unit, then count actions
    // by that origin id set — never calling `RiskDashboardMetricsPort`/
    // `DashboardQueryService` (the code under test).
    async function manualOverdueTreatmentCount(orgUnitId: string): Promise<number> {
      const riskIds = (
        await ctx.prisma.client.risk.findMany({ where: { orgUnitId }, select: { id: true } })
      ).map((r) => r.id);
      if (riskIds.length === 0) {
        return 0;
      }
      return ctx.prisma.client.action.count({
        where: {
          originType: 'RISK_TREATMENT',
          originId: { in: riskIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueOn: { lt: today },
        },
      });
    }

    const expectedUnitA = await manualOverdueTreatmentCount(unitA.id);
    expect(expectedUnitA).toBe(1);
    const unitBCount = await manualOverdueTreatmentCount(unitB.id);
    expect(unitBCount).toBe(1); // Real, qualifying data exists to leak.

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // CONTROL_INACTIVE_COUNT — SINGLE_VALUE
  // ---------------------------------------------------------------------
  it('CONTROL_INACTIVE_COUNT — non-ACTIVE control count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('control-inactive');
    const actor = await createUnitScopedActor('control-inactive-actor', unitA, [
      'indicator:view',
      'control:view',
    ]);

    async function createControl(orgUnitId: string, status: string) {
      return ctx.prisma.client.control.create({
        data: {
          code: uniqueTestMarker('ctl'),
          name: 'Controle para paridade de escopo',
          orgUnitId,
          status: status as never,
        },
      });
    }

    await createControl(unitA.id, 'DRAFT');
    await createControl(unitA.id, 'SUSPENDED');
    await createControl(unitA.id, 'ACTIVE'); // must not count
    await createControl(unitB.id, 'RETIRED'); // must not leak

    const expectedUnitA = await ctx.prisma.client.control.count({
      where: { orgUnitId: unitA.id, status: { in: ['DRAFT', 'SUSPENDED', 'RETIRED'] } },
    });
    expect(expectedUnitA).toBe(2);
    const unitBCount = await ctx.prisma.client.control.count({
      where: { orgUnitId: unitB.id, status: { in: ['DRAFT', 'SUSPENDED', 'RETIRED'] } },
    });
    expect(unitBCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'CONTROL_INACTIVE_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // AUDIT_ENGAGEMENT_OPEN_COUNT — SINGLE_VALUE
  // ---------------------------------------------------------------------
  it('AUDIT_ENGAGEMENT_OPEN_COUNT — open-engagement count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('audit-open');
    const actor = await createUnitScopedActor('audit-open-actor', unitA, [
      'indicator:view',
      'audit-engagement:view',
    ]);

    async function createEngagement(orgUnitId: string, status: string) {
      return ctx.prisma.client.auditEngagement.create({
        data: {
          code: uniqueTestMarker('aud'),
          objective: 'Objetivo de auditoria para paridade de escopo.',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          orgUnitId,
          leadAuditorUserId: actor.id,
          status: status as never,
        },
      });
    }

    await createEngagement(unitA.id, 'PLANNING');
    await createEngagement(unitA.id, 'COMPLETED'); // must not count
    await createEngagement(unitB.id, 'IN_PROGRESS'); // must not leak

    const expectedUnitA = await ctx.prisma.client.auditEngagement.count({
      where: { orgUnitId: unitA.id, status: { in: ['PLANNING', 'IN_PROGRESS'] } },
    });
    expect(expectedUnitA).toBe(1);
    const unitBCount = await ctx.prisma.client.auditEngagement.count({
      where: { orgUnitId: unitB.id, status: { in: ['PLANNING', 'IN_PROGRESS'] } },
    });
    expect(unitBCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'AUDIT_ENGAGEMENT_OPEN_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // FINDING_OPEN_COUNT_BY_SEVERITY — BY_BUCKET
  // ---------------------------------------------------------------------
  it('FINDING_OPEN_COUNT_BY_SEVERITY — open-finding bucket count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('finding-open');
    const actor = await createUnitScopedActor('finding-open-actor', unitA, [
      'indicator:view',
      'finding:view',
    ]);

    async function createFinding(orgUnitId: string, severity: string, status: string) {
      return ctx.prisma.client.finding.create({
        data: {
          code: uniqueTestMarker('fnd'),
          orgUnitId,
          title: 'Achado para paridade de escopo',
          description: 'Descrição.',
          category: 'OBSERVATION',
          origin: 'INTERNAL_ASSESSMENT',
          severity: severity as never,
          priority: 'MEDIUM',
          ownerUserId: actor.id,
          identifiedOn: new Date('2026-01-01'),
          status: status as never,
        },
      });
    }

    await createFinding(unitA.id, 'CRITICAL', 'OPEN');
    await createFinding(unitA.id, 'HIGH', 'IN_REMEDIATION');
    await createFinding(unitA.id, 'MEDIUM', 'CLOSED'); // must not count (not open)
    await createFinding(unitB.id, 'CRITICAL', 'OPEN'); // must not leak

    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
    const expectedUnitA: Record<string, number> = {};
    for (const severity of severities) {
      expectedUnitA[severity] = await ctx.prisma.client.finding.count({
        where: {
          orgUnitId: unitA.id,
          severity,
          status: { in: ['OPEN', 'IN_REMEDIATION'] },
        },
      });
    }
    expect(expectedUnitA).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0 });

    const unitBCriticalCount = await ctx.prisma.client.finding.count({
      where: {
        orgUnitId: unitB.id,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'IN_REMEDIATION'] },
      },
    });
    expect(unitBCriticalCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'FINDING_OPEN_COUNT_BY_SEVERITY',
    });

    expect(result.valueByBucket).toEqual(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // ASSET_INACTIVE_COUNT — SINGLE_VALUE
  // ---------------------------------------------------------------------
  it('ASSET_INACTIVE_COUNT — inactive-asset count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('asset-inactive');
    const actor = await createUnitScopedActor('asset-inactive-actor', unitA, [
      'indicator:view',
      'asset:view',
    ]);

    async function createAsset(orgUnitId: string, isActive: boolean) {
      return ctx.prisma.client.asset.create({
        data: {
          code: uniqueTestMarker('ast'),
          name: 'Ativo para paridade de escopo',
          orgUnitId,
          isActive,
        },
      });
    }

    await createAsset(unitA.id, false);
    await createAsset(unitA.id, false);
    await createAsset(unitA.id, true); // must not count
    await createAsset(unitB.id, false); // must not leak

    const expectedUnitA = await ctx.prisma.client.asset.count({
      where: { orgUnitId: unitA.id, isActive: false },
    });
    expect(expectedUnitA).toBe(2);
    const unitBCount = await ctx.prisma.client.asset.count({
      where: { orgUnitId: unitB.id, isActive: false },
    });
    expect(unitBCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // PROCESS_INACTIVE_COUNT — SINGLE_VALUE
  // ---------------------------------------------------------------------
  it('PROCESS_INACTIVE_COUNT — inactive-process count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('process-inactive');
    const actor = await createUnitScopedActor('process-inactive-actor', unitA, [
      'indicator:view',
      'process:view',
    ]);

    async function createProcess(orgUnitId: string, isActive: boolean) {
      return ctx.prisma.client.process.create({
        data: {
          code: uniqueTestMarker('prc'),
          name: 'Processo para paridade de escopo',
          orgUnitId,
          isActive,
        },
      });
    }

    await createProcess(unitA.id, false);
    await createProcess(unitA.id, true); // must not count
    await createProcess(unitB.id, false); // must not leak

    const expectedUnitA = await ctx.prisma.client.process.count({
      where: { orgUnitId: unitA.id, isActive: false },
    });
    expect(expectedUnitA).toBe(1);
    const unitBCount = await ctx.prisma.client.process.count({
      where: { orgUnitId: unitB.id, isActive: false },
    });
    expect(unitBCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // ACTION_OVERDUE_COUNT — SINGLE_VALUE (basic per-domain parity; the
  // predicate-parity guard against `isActionOverdue` lives in its own file,
  // `action-overdue-count-predicate-parity.spec.ts` — item 2 of this task).
  // ---------------------------------------------------------------------
  it('ACTION_OVERDUE_COUNT — overdue-action count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('action-overdue');
    const actor = await createUnitScopedActor('action-overdue-actor', unitA, [
      'indicator:view',
      'action:view',
    ]);

    const today = todayDateOnlyUtc();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    async function createAction(orgUnitId: string, status: string, dueOn: Date) {
      // Invariant A1 (DB CHECK `actions_completed_status_check`): `status =
      // 'COMPLETED'` iff `completedAt IS NOT NULL`, paired with
      // `completedByUserId` — both filled together whenever this helper is
      // asked for a COMPLETED row.
      const completed = status === 'COMPLETED';
      return ctx.prisma.client.action.create({
        data: {
          code: uniqueTestMarker('act'),
          orgUnitId,
          originType: 'CONTROL_ASSESSMENT',
          originId: randomUUID(),
          title: 'Ação para paridade de escopo',
          responsibleUserId: actor.id,
          dueOn,
          status: status as never,
          completedAt: completed ? new Date() : null,
          completedByUserId: completed ? actor.id : null,
        },
      });
    }

    await createAction(unitA.id, 'OPEN', yesterday); // overdue
    await createAction(unitA.id, 'OPEN', tomorrow); // not yet due
    await createAction(unitA.id, 'COMPLETED', yesterday); // terminal — never overdue
    await createAction(unitB.id, 'OPEN', yesterday); // must not leak

    // Manual, independent path: the two eligible statuses spelled out
    // directly from data-model.md §6 ("status ∈ {OPEN, IN_PROGRESS}"), not
    // imported from `grc/shared/domain/overdue.service.ts`'s own constant —
    // this is a genuinely separate restatement of the rule, not the
    // production code under test.
    const expectedUnitA = await ctx.prisma.client.action.count({
      where: { orgUnitId: unitA.id, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueOn: { lt: today } },
    });
    expect(expectedUnitA).toBe(1);
    const unitBCount = await ctx.prisma.client.action.count({
      where: { orgUnitId: unitB.id, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueOn: { lt: today } },
    });
    expect(unitBCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'ACTION_OVERDUE_COUNT',
    });

    expect(result.value).toBe(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // INCIDENT_OPEN_COUNT_BY_SEVERITY — BY_BUCKET
  // ---------------------------------------------------------------------
  it('INCIDENT_OPEN_COUNT_BY_SEVERITY — open-incident bucket count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('incident-open');
    const actor = await createUnitScopedActor('incident-open-actor', unitA, [
      'indicator:view',
      'incident:view',
    ]);

    async function createIncident(orgUnitId: string, severity: string, status: string) {
      return ctx.prisma.client.incident.create({
        data: {
          code: uniqueTestMarker('inc'),
          orgUnitId,
          title: 'Incidente para paridade de escopo',
          description: 'Descrição.',
          severity: severity as never,
          status: status as never,
          reportedByUserId: actor.id,
          ownerUserId: actor.id,
          reportedOn: new Date('2026-01-01'),
        },
      });
    }

    await createIncident(unitA.id, 'CRITICAL', 'OPEN');
    await createIncident(unitA.id, 'HIGH', 'RESOLVED'); // still "open" per OPEN_INCIDENT_STATUSES
    await createIncident(unitA.id, 'MEDIUM', 'CLOSED'); // must not count
    await createIncident(unitB.id, 'CRITICAL', 'OPEN'); // must not leak

    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
    const expectedUnitA: Record<string, number> = {};
    for (const severity of severities) {
      expectedUnitA[severity] = await ctx.prisma.client.incident.count({
        where: {
          orgUnitId: unitA.id,
          severity,
          status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] },
        },
      });
    }
    expect(expectedUnitA).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0 });

    const unitBCriticalCount = await ctx.prisma.client.incident.count({
      where: {
        orgUnitId: unitB.id,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] },
      },
    });
    expect(unitBCriticalCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
    });

    expect(result.valueByBucket).toEqual(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // PROBLEM_OPEN_COUNT_BY_SEVERITY — BY_BUCKET
  // ---------------------------------------------------------------------
  it('PROBLEM_OPEN_COUNT_BY_SEVERITY — open-problem bucket count matches a per-unit Prisma count, unitB excluded', async () => {
    const { unitA, unitB } = await createTwoUnits('problem-open');
    const actor = await createUnitScopedActor('problem-open-actor', unitA, [
      'indicator:view',
      'problem:view',
    ]);

    async function createProblem(orgUnitId: string, severity: string, status: string) {
      return ctx.prisma.client.problem.create({
        data: {
          code: uniqueTestMarker('prb'),
          orgUnitId,
          title: 'Problema para paridade de escopo',
          description: 'Descrição.',
          severity: severity as never,
          status: status as never,
          ownerUserId: actor.id,
          identifiedOn: new Date('2026-01-01'),
        },
      });
    }

    await createProblem(unitA.id, 'CRITICAL', 'OPEN');
    await createProblem(unitA.id, 'HIGH', 'IN_ANALYSIS'); // still "open"
    await createProblem(unitA.id, 'MEDIUM', 'CLOSED'); // must not count
    await createProblem(unitB.id, 'CRITICAL', 'OPEN'); // must not leak

    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
    const expectedUnitA: Record<string, number> = {};
    for (const severity of severities) {
      expectedUnitA[severity] = await ctx.prisma.client.problem.count({
        where: {
          orgUnitId: unitA.id,
          severity,
          status: { in: ['OPEN', 'IN_ANALYSIS', 'RESOLVED'] },
        },
      });
    }
    expect(expectedUnitA).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0 });

    const unitBCriticalCount = await ctx.prisma.client.problem.count({
      where: {
        orgUnitId: unitB.id,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'IN_ANALYSIS', 'RESOLVED'] },
      },
    });
    expect(unitBCriticalCount).toBe(1);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROBLEM_OPEN_COUNT_BY_SEVERITY',
    });

    expect(result.valueByBucket).toEqual(expectedUnitA);
  });

  // ---------------------------------------------------------------------
  // COMPLIANCE_PERCENTAGE — the ONE 'ORGANIZATION_WIDE' key (research.md
  // D-8). The opposite proof: two callers scoped to DIFFERENT units must
  // see the IDENTICAL value, because `Requirement`/`FrameworkVersion` carry
  // no organizational-unit column at all.
  // ---------------------------------------------------------------------
  it('COMPLIANCE_PERCENTAGE — two callers scoped to different units see the identical value (research.md D-8)', async () => {
    const { unitA, unitB } = await createTwoUnits('compliance-orgwide');
    const actorA = await createUnitScopedActor('compliance-actor-a', unitA, [
      'indicator:view',
      'compliance:view',
    ]);
    const actorB = await createUnitScopedActor('compliance-actor-b', unitB, [
      'indicator:view',
      'compliance:view',
    ]);

    // A framework, a PUBLISHED version, one requirement, one ACTIVE control
    // proven EFFECTIVE by an attested assessment, and the link between them
    // — enough for `calculateRequirementComplianceState` to reach
    // `COMPLIANT` (100%), a genuinely non-zero, non-trivial percentage.
    const framework = await ctx.prisma.client.framework.create({
      data: {
        code: uniqueTestMarker('fmk'),
        name: 'Framework para paridade organização inteira',
        description: 'Descrição.',
        origin: 'INTERNAL_POLICY',
      },
    });
    const frameworkVersion = await ctx.prisma.client.frameworkVersion.create({
      data: {
        frameworkId: framework.id,
        label: uniqueTestMarker('v'),
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByUserId: actorA.id,
      },
    });
    const requirement = await ctx.prisma.client.requirement.create({
      data: {
        frameworkVersionId: frameworkVersion.id,
        externalRef: 'A.1',
        title: 'Cláusula para paridade organização inteira',
        description: 'Descrição.',
        createdByUserId: actorA.id,
      },
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-compliance'),
        name: 'Controle para paridade organização inteira',
        orgUnitId: unitA.id,
        isActive: true,
        status: 'ACTIVE',
        ownerUserId: actorA.id,
      },
    });
    await ctx.prisma.client.controlAssessment.create({
      data: {
        controlId: control.id,
        assessedOn: new Date(),
        assessorUserId: actorA.id,
        result: 'EFFECTIVE',
        conclusion: 'Controle efetivo.',
        attestedAt: new Date(),
        attestedByUserId: actorA.id,
      },
    });
    await ctx.prisma.client.requirementControlLink.create({
      data: {
        requirementId: requirement.id,
        controlId: control.id,
        linkedAt: new Date(),
        linkedByUserId: actorA.id,
      },
    });

    const resultForUnitA = await useCase.execute({
      actorUserId: actorA.id,
      metricKey: 'COMPLIANCE_PERCENTAGE',
    });
    const resultForUnitB = await useCase.execute({
      actorUserId: actorB.id,
      metricKey: 'COMPLIANCE_PERCENTAGE',
    });

    expect(resultForUnitA.scopeApplicability).toBe('ORGANIZATION_WIDE');
    expect(resultForUnitB.scopeApplicability).toBe('ORGANIZATION_WIDE');
    // Non-trivial: proves the calculation genuinely ran (not a stub always
    // returning the same constant regardless of input).
    expect(resultForUnitA.value).toBe(100);
    expect(resultForUnitA.value).toBe(resultForUnitB.value);
  });
});
