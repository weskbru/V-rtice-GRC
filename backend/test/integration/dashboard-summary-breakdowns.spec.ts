import { randomUUID } from 'node:crypto';

import { IndicatorMetricKey } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { GetDashboardSummaryUseCase } from '../../src/modules/dashboard/application/get-dashboard-summary.usecase';
import { DashboardSummaryModule } from '../../src/modules/dashboard/dashboard-summary.module';
import { ComplianceSummaryPort } from '../../src/shared/grc-ports/compliance-summary.port';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { ActionStatus } from '@prisma/client';

const BLOCK_PERMISSIONS: readonly PermissionIdentifier[] = [
  'action:view',
  'incident:view',
  'problem:view',
  'control:view',
  'compliance:view',
  'indicator:view',
];

function utcDateOnly(offsetDays: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

describe('GetDashboardSummaryUseCase — breakdowns over real data', () => {
  let ctx: IntegrationTestContext;
  let useCase: GetDashboardSummaryUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, DashboardSummaryModule],
    });
    useCase = ctx.app.get(GetDashboardSummaryUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function actor(scope: { unitId: string } | 'global'): Promise<{ id: string }> {
    const user = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('dbs-breakdowns-actor')}@example.test`,
      ...(scope === 'global' ? {} : { primaryOrgUnitId: scope.unitId }),
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, BLOCK_PERMISSIONS, {
      name: `fixture-dbs-breakdowns-role-${uniqueTestMarker('role')}`,
    });
    await assignRoleFixture(ctx.prisma, { user, role });
    if (scope === 'global') {
      await grantGlobalScopeFixture(ctx.prisma, { user });
    } else {
      await grantUnitScopeFixture(ctx.prisma, { user, orgUnitId: scope.unitId });
    }
    return user;
  }

  async function createAction(input: {
    orgUnitId: string;
    responsibleUserId: string;
    status: ActionStatus;
    dueOn: Date;
  }): Promise<void> {
    const finished = input.status === 'COMPLETED';
    await ctx.prisma.client.action.create({
      data: {
        code: uniqueTestMarker('dbs-act'),
        orgUnitId: input.orgUnitId,
        originType: 'CONTROL_ASSESSMENT',
        originId: randomUUID(),
        title: 'Ação do teste de resumo do dashboard',
        responsibleUserId: input.responsibleUserId,
        dueOn: input.dueOn,
        status: input.status,
        completedAt: finished ? new Date() : null,
        completedByUserId: finished ? input.responsibleUserId : null,
      },
    });
  }

  it('scopes actions, incidents and controls to the caller, and counts dueSoon and ineffective by their exact rules', async () => {
    const narrowUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('dbs-breakdowns-narrow'),
    });
    const otherUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('dbs-breakdowns-other'),
    });
    const narrow = await actor({ unitId: narrowUnit.id });
    const broad = await actor('global');

    await createAction({
      orgUnitId: narrowUnit.id,
      responsibleUserId: narrow.id,
      status: 'OPEN',
      dueOn: utcDateOnly(3),
    });
    await createAction({
      orgUnitId: narrowUnit.id,
      responsibleUserId: narrow.id,
      status: 'IN_PROGRESS',
      dueOn: utcDateOnly(0),
    });
    await createAction({
      orgUnitId: narrowUnit.id,
      responsibleUserId: narrow.id,
      status: 'OPEN',
      dueOn: utcDateOnly(-2),
    });
    await createAction({
      orgUnitId: narrowUnit.id,
      responsibleUserId: narrow.id,
      status: 'COMPLETED',
      dueOn: utcDateOnly(3),
    });
    await createAction({
      orgUnitId: narrowUnit.id,
      responsibleUserId: narrow.id,
      status: 'OPEN',
      dueOn: utcDateOnly(7),
    });
    await createAction({
      orgUnitId: otherUnit.id,
      responsibleUserId: broad.id,
      status: 'OPEN',
      dueOn: utcDateOnly(2),
    });

    for (const [orgUnitId, status] of [
      [narrowUnit.id, 'OPEN'],
      [narrowUnit.id, 'IN_PROGRESS'],
      [otherUnit.id, 'OPEN'],
    ] as const) {
      await ctx.prisma.client.incident.create({
        data: {
          code: uniqueTestMarker('dbs-inc'),
          orgUnitId,
          title: 'Incidente do teste de resumo do dashboard',
          description: 'Descrição do incidente.',
          severity: 'HIGH',
          status,
          reportedByUserId: narrow.id,
          ownerUserId: narrow.id,
          reportedOn: utcDateOnly(-1),
        },
      });
    }

    const today = utcDateOnly(0);
    async function control(
      orgUnitId: string,
      status: 'ACTIVE' | 'DRAFT',
      result?: 'EFFECTIVE' | 'INEFFECTIVE',
    ) {
      const created = await ctx.prisma.client.control.create({
        data: {
          code: uniqueTestMarker('dbs-ctl'),
          name: 'Controle do teste de resumo do dashboard',
          orgUnitId,
          status,
          isActive: status === 'ACTIVE',
        },
      });
      if (result) {
        await ctx.prisma.client.controlAssessment.create({
          data: {
            controlId: created.id,
            assessedOn: today,
            assessorUserId: narrow.id,
            result,
            conclusion: 'Conclusão do teste.',
            attestedAt: today,
            attestedByUserId: broad.id,
          },
        });
      }
    }
    await control(narrowUnit.id, 'ACTIVE', 'INEFFECTIVE');
    await control(narrowUnit.id, 'ACTIVE', 'EFFECTIVE');
    await control(narrowUnit.id, 'DRAFT', 'INEFFECTIVE');
    await control(otherUnit.id, 'ACTIVE', 'INEFFECTIVE');

    const narrowResult = await useCase.execute({ actorUserId: narrow.id });
    const broadResult = await useCase.execute({ actorUserId: broad.id });

    const narrowActions = narrowResult.breakdowns.actions;
    expect(narrowActions).toBeDefined();
    expect(narrowActions!.byStatus).toEqual({
      OPEN: 3,
      IN_PROGRESS: 1,
      COMPLETED: 1,
      CANCELLED: 0,
    });
    expect(narrowActions!.dueSoon).toBe(2);
    expect(narrowActions!.dueSoonWindowDays).toBe(7);

    expect(narrowResult.breakdowns.incidents!.byStatus).toEqual({
      OPEN: 1,
      IN_PROGRESS: 1,
      RESOLVED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    });

    expect(narrowResult.breakdowns.controls).toEqual({ total: 3, active: 2, ineffective: 1 });

    const broadActions = broadResult.breakdowns.actions!;
    const sum = (record: Readonly<Record<string, number>>): number =>
      Object.values(record).reduce((total, count) => total + count, 0);
    expect(sum(broadActions.byStatus)).toBeGreaterThan(sum(narrowActions!.byStatus));
    expect(broadActions.dueSoon).toBeGreaterThan(narrowActions!.dueSoon);
    expect(sum(broadResult.breakdowns.incidents!.byStatus)).toBeGreaterThan(
      sum(narrowResult.breakdowns.incidents!.byStatus),
    );
    expect(broadResult.breakdowns.controls!.ineffective).toBeGreaterThan(
      narrowResult.breakdowns.controls!.ineffective,
    );
  });

  it('decides indicators.breached by the most recent measurement only', async () => {
    const owner = await actor('global');

    const defined = new Set(
      (await ctx.prisma.client.indicatorDefinition.findMany({ select: { metricKey: true } })).map(
        (row) => row.metricKey,
      ),
    );
    const freeKey = Object.values(IndicatorMetricKey).find((key) => !defined.has(key));
    const metricKey = freeKey ?? Object.values(IndicatorMetricKey)[0]!;
    if (freeKey) {
      await ctx.prisma.client.indicatorDefinition.create({
        data: {
          code: uniqueTestMarker('dbs-ind'),
          metricKey,
          name: 'Indicador do teste de resumo do dashboard',
          description: 'Definição criada pelo teste.',
          ownerUserId: owner.id,
          createdByUserId: owner.id,
          isActive: true,
        },
      });
    } else {
      await ctx.prisma.client.indicatorDefinition.update({
        where: { metricKey },
        data: { isActive: true },
      });
    }

    const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);

    await ctx.prisma.client.indicatorMeasurement.create({
      data: { metricKey, breached: true, computedByUserId: owner.id, computedAt: hoursAgo(48) },
    });
    await ctx.prisma.client.indicatorMeasurement.create({
      data: { metricKey, breached: false, computedByUserId: owner.id, computedAt: hoursAgo(1) },
    });
    const beforeLatestBreach = await useCase.execute({ actorUserId: owner.id });

    await ctx.prisma.client.indicatorMeasurement.create({
      data: { metricKey, breached: true, computedByUserId: owner.id, computedAt: new Date() },
    });
    const afterLatestBreach = await useCase.execute({ actorUserId: owner.id });

    expect(afterLatestBreach.breakdowns.indicators!.breached).toBe(
      beforeLatestBreach.breakdowns.indicators!.breached + 1,
    );
    expect(afterLatestBreach.breakdowns.indicators!.monitored).toBe(
      beforeLatestBreach.breakdowns.indicators!.monitored,
    );
  });

  it('derives compliance counts from the same calculator as the published percentage', async () => {
    const author = await actor('global');
    const complianceSummary = ctx.app.get(ComplianceSummaryPort);

    const before = (await useCase.execute({ actorUserId: author.id })).breakdowns.compliance!;

    const framework = await ctx.prisma.client.framework.create({
      data: {
        code: uniqueTestMarker('dbs-framework'),
        name: uniqueTestMarker('Framework do teste de resumo'),
        description: 'Framework criado pelo teste.',
        origin: 'EXTERNAL_STANDARD',
      },
    });
    const version = await ctx.prisma.client.frameworkVersion.create({
      data: { frameworkId: framework.id, label: uniqueTestMarker('v'), status: 'PUBLISHED' },
    });
    const requirement = await ctx.prisma.client.requirement.create({
      data: {
        frameworkVersionId: version.id,
        externalRef: 'DBS.1',
        title: 'Requisito sem controle vinculado',
        description: 'Nunca conforme por omissão (FR-018).',
        createdByUserId: author.id,
      },
    });

    try {
      const after = (await useCase.execute({ actorUserId: author.id })).breakdowns.compliance!;

      expect(after.requirementCount).toBe(before.requirementCount + 1);
      expect(after.byState.NOT_MET).toBe(before.byState.NOT_MET + 1);

      const total = Object.values(after.byState).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(after.requirementCount);

      const applicable = after.requirementCount - after.byState.NOT_APPLICABLE;
      const implied = applicable === 0 ? undefined : (after.byState.COMPLIANT / applicable) * 100;
      expect(await complianceSummary.getOrganizationWideCompliancePercentage()).toBe(implied);
    } finally {
      await ctx.prisma.client.requirement.delete({ where: { id: requirement.id } });
      await ctx.prisma.client.frameworkVersion.delete({ where: { id: version.id } });
      await ctx.prisma.client.framework.delete({ where: { id: framework.id } });
    }
  });
});
