import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateReportDefinitionUseCase } from '../../src/modules/reports/application/create-report-definition.usecase';
import { RunReportUseCase } from '../../src/modules/reports/application/run-report.usecase';
import { ReportsModule } from '../../src/modules/reports/reports.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { OrganizationalUnit, User } from '@prisma/client';

describe('RunReportUseCase — organizational-scope parity across two callers (T056)', () => {
  let ctx: IntegrationTestContext;
  let createUseCase: CreateReportDefinitionUseCase;
  let runUseCase: RunReportUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ReportsModule],
    });
    createUseCase = ctx.app.get(CreateReportDefinitionUseCase);
    runUseCase = ctx.app.get(RunReportUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createUnitScopedActor(prefix: string, orgUnit: OrganizationalUnit): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker(prefix)}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['report:create', 'report:view', 'control:view', 'compliance:view'],
      { name: `fixture-${prefix}-role-${uniqueTestMarker('role')}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    return actor;
  }

  it('CONTROL_INACTIVE_COUNT differs per unit; COMPLIANCE_PERCENTAGE is identical for both callers', async () => {
    const unitA = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('report-scope-a'),
    });
    const unitB = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('report-scope-b'),
    });

    const actorA = await createUnitScopedActor('report-scope-actor-a', unitA);
    const actorB = await createUnitScopedActor('report-scope-actor-b', unitB);

    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-scope-a1'),
        name: 'Controle A1',
        orgUnitId: unitA.id,
        status: 'DRAFT',
      },
    });
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-scope-a2'),
        name: 'Controle A2',
        orgUnitId: unitA.id,
        status: 'SUSPENDED',
      },
    });
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-scope-b1'),
        name: 'Controle B1',
        orgUnitId: unitB.id,
        status: 'DRAFT',
      },
    });

    const framework = await ctx.prisma.client.framework.create({
      data: {
        code: uniqueTestMarker('fmk-report-scope'),
        name: 'Framework para paridade de relatório organização inteira',
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
        title: 'Cláusula para paridade de relatório organização inteira',
        description: 'Descrição.',
        createdByUserId: actorA.id,
      },
    });
    const complianceControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-report-compliance'),
        name: 'Controle efetivo para paridade de relatório',
        orgUnitId: unitA.id,
        isActive: true,
        status: 'ACTIVE',
        ownerUserId: actorA.id,
      },
    });
    await ctx.prisma.client.controlAssessment.create({
      data: {
        controlId: complianceControl.id,
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
        controlId: complianceControl.id,
        linkedAt: new Date(),
        linkedByUserId: actorA.id,
      },
    });

    const created = await createUseCase.execute({
      actorUserId: actorA.id,
      name: 'Relatório de paridade organizacional',
      description: 'Descrição.',
      metricKeys: ['CONTROL_INACTIVE_COUNT', 'COMPLIANCE_PERCENTAGE'],
    });

    const resultForA = await runUseCase.execute({
      actorUserId: actorA.id,
      reportId: created.record.id,
    });
    const resultForB = await runUseCase.execute({
      actorUserId: actorB.id,
      reportId: created.record.id,
    });

    const byKeyA = new Map(resultForA.items.map((item) => [item.metricKey, item]));
    const byKeyB = new Map(resultForB.items.map((item) => [item.metricKey, item]));

    const controlItemA = byKeyA.get('CONTROL_INACTIVE_COUNT')!;
    const controlItemB = byKeyB.get('CONTROL_INACTIVE_COUNT')!;
    expect(controlItemA.available).toBe(true);
    expect(controlItemB.available).toBe(true);
    expect(controlItemA.value).toBe(2);
    expect(controlItemB.value).toBe(1);
    expect(controlItemA.value).not.toBe(controlItemB.value);

    const complianceItemA = byKeyA.get('COMPLIANCE_PERCENTAGE')!;
    const complianceItemB = byKeyB.get('COMPLIANCE_PERCENTAGE')!;
    expect(complianceItemA.available).toBe(true);
    expect(complianceItemB.available).toBe(true);
    expect(complianceItemA.scopeApplicability).toBe('ORGANIZATION_WIDE');
    expect(complianceItemB.scopeApplicability).toBe('ORGANIZATION_WIDE');
    expect(Number.isFinite(complianceItemA.value)).toBe(true);
    expect(complianceItemA.value).toBeGreaterThan(0);
    expect(complianceItemA.value).toBe(complianceItemB.value);
  });
});
