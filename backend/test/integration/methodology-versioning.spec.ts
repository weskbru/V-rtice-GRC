import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateAssessmentUseCase } from '../../src/modules/risk/application/create-assessment.usecase';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { PublishMethodologyVersionUseCase } from '../../src/modules/risk/application/publish-methodology-version.usecase';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import {
  createMethodologyVersionFixture,
  createOrgUnitFixture,
  createUserFixture,
} from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { RiskAssessment } from '@prisma/client';

const SCALE_1_TO_5 = [1, 2, 3, 4, 5].map((value) => ({ value, label: `P${String(value)}` }));

describe('Methodology versioning does not rescore history (T117, FR-068, SC-007)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createAssessmentUseCase: CreateAssessmentUseCase;
  let publishMethodologyVersionUseCase: PublishMethodologyVersionUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createAssessmentUseCase = ctx.app.get(CreateAssessmentUseCase);
    publishMethodologyVersionUseCase = ctx.app.get(PublishMethodologyVersionUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('an assessment pinned to V1 keeps its stored score/level after V2 publishes with a different matrix', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('methodology-versioning-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('methodology-versioning-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:assess', 'methodology:administer'],
      { name: `fixture-methodology-versioning-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('methodology-versioning-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const { version: v1 } = await createMethodologyVersionFixture(ctx.prisma, actor.id);

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para teste de versionamento de metodologia',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { assessment } = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      inherentProbability: 5,
      inherentImpact: 5,
      residualProbability: 5,
      residualImpact: 5,
      rationale: 'Avaliação sob a versão V1.',
    });

    expect(assessment.inherentScore).toBe(25);
    expect(assessment.inherentLevel).toBe('CRITICAL');
    expect(assessment.residualScore).toBe(25);
    expect(assessment.residualLevel).toBe('CRITICAL');
    expect(assessment.methodologyVersion.id).toBe(v1.id);

    const flatMatrix = SCALE_1_TO_5.flatMap((p) =>
      SCALE_1_TO_5.map((i) => ({
        probability: p.value,
        impact: i.value,
        score: p.value * i.value,
        level: 'LOW' as const,
      })),
    );
    const v2 = await publishMethodologyVersionUseCase.execute({
      actorUserId: actor.id,
      probabilityScale: SCALE_1_TO_5,
      impactScale: SCALE_1_TO_5,
      matrix: flatMatrix,
      levelBands: [{ level: 'LOW', minScore: 1, maxScore: 25 }],
    });

    expect(v2.id).not.toBe(v1.id);
    expect(v2.versionNumber).toBe(v1.versionNumber + 1);

    const storedAssessment: RiskAssessment =
      await ctx.prisma.client.riskAssessment.findUniqueOrThrow({ where: { id: assessment.id } });
    expect(storedAssessment.methodologyVersionId).toBe(v1.id);
    expect(storedAssessment.inherentScore).toBe(25);
    expect(storedAssessment.inherentLevel).toBe('CRITICAL');
    expect(storedAssessment.residualScore).toBe(25);
    expect(storedAssessment.residualLevel).toBe('CRITICAL');

    const storedRisk = await ctx.prisma.client.risk.findUniqueOrThrow({ where: { id: risk.id } });
    expect(storedRisk.inherentLevel).toBe('CRITICAL');
    expect(storedRisk.residualLevel).toBe('CRITICAL');

    const { assessment: secondAssessment } = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: 1,
      inherentProbability: 5,
      inherentImpact: 5,
      residualProbability: 5,
      residualImpact: 5,
      rationale: 'Avaliação sob a versão V2.',
    });

    expect(secondAssessment.methodologyVersion.id).toBe(v2.id);
    expect(secondAssessment.inherentScore).toBe(25);
    expect(secondAssessment.inherentLevel).toBe('LOW');
    expect(secondAssessment.residualLevel).toBe('LOW');

    const storedAssessmentAfterSecond = await ctx.prisma.client.riskAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
    });
    expect(storedAssessmentAfterSecond.inherentLevel).toBe('CRITICAL');
    expect(storedAssessmentAfterSecond.methodologyVersionId).toBe(v1.id);

    await expect(
      createAssessmentUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: 2,
        inherentProbability: 5,
        inherentImpact: 5,
        residualProbability: 5,
        residualImpact: 5,
        methodologyVersionId: v1.id,
      }),
    ).rejects.toThrow();
  });
});
