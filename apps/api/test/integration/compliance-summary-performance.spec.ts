import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { GetFrameworkVersionComplianceSummaryUseCase } from '../../src/modules/compliance/application/compliance-summary/get-framework-version-compliance-summary.usecase';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';

import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

const REQUIREMENT_COUNT = 500;
const CONTROL_COUNT = 100;
const PERFORMANCE_BUDGET_MS = 2000;

describe('GetFrameworkVersionComplianceSummaryUseCase — 500-requirement performance budget (T055, SC-008, research.md D-10)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let getSummary: GetFrameworkVersionComplianceSummaryUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFramework = ctx.app.get(CreateFrameworkUseCase);
    createVersion = ctx.app.get(CreateFrameworkVersionUseCase);
    getSummary = ctx.app.get(GetFrameworkVersionComplianceSummaryUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('computes the summary for 500 requirements, each with a linked control, in under 2 seconds', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker('perf-org') });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('perf-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });

    const framework = await createFramework.execute({
      actorUserId: actor.id,
      name: uniqueTestMarker('Framework de desempenho'),
      description: 'Framework de teste para orçamento de desempenho (SC-008).',
      origin: 'EXTERNAL_STANDARD',
    });
    const version = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v'),
    });

    const controlIds = Array.from({ length: CONTROL_COUNT }, () => randomUUID());
    await ctx.prisma.client.control.createMany({
      data: controlIds.map((id, index) => ({
        id,
        code: `${uniqueTestMarker('perf-ctl')}-${String(index)}`,
        name: `Controle de desempenho ${String(index)}`,
        orgUnitId: orgUnit.id,
        status: 'ACTIVE',
        isActive: true,
      })),
    });

    const requirementIds = Array.from({ length: REQUIREMENT_COUNT }, () => randomUUID());
    await ctx.prisma.client.requirement.createMany({
      data: requirementIds.map((id, index) => ({
        id,
        frameworkVersionId: version.id,
        externalRef: `A.${String(index)}`,
        title: `Requisito de desempenho ${String(index)}`,
        description: 'Requisito criado para o teste de orçamento de desempenho.',
        createdByUserId: actor.id,
      })),
    });

    const now = new Date();
    await ctx.prisma.client.requirementControlLink.createMany({
      data: requirementIds.map((requirementId, index) => ({
        id: randomUUID(),
        requirementId,
        controlId: controlIds[index % CONTROL_COUNT]!,
        linkedAt: now,
        linkedByUserId: actor.id,
      })),
    });

    const startedAt = performance.now();
    const summary = await getSummary.execute({ frameworkId: framework.id, versionId: version.id });
    const elapsedMs = performance.now() - startedAt;

    expect(summary.totalRequirements).toBe(REQUIREMENT_COUNT);
    expect(summary.applicableRequirementCount).toBe(REQUIREMENT_COUNT);
    expect(summary.counts.notProven).toBe(REQUIREMENT_COUNT);
    expect(elapsedMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
  });
});
