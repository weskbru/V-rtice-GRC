/**
 * T117 — FR-068: a methodology version change does NOT retroactively alter
 * the stored results of historical assessments. This is the test that
 * matters most for audit defensibility (per the dispatch brief): an
 * assessment's `methodologyVersionId` pins interpretation permanently, so a
 * later matrix/band change can never rescore it.
 *
 * Proof structure:
 *   1. Assess a risk under methodology version V1 (5x5 product matrix,
 *      standard LOW/MEDIUM/HIGH/CRITICAL bands) — factors (5,5) score 25,
 *      level CRITICAL.
 *   2. Publish version V2 under the SAME (active) methodology with a
 *      DELIBERATELY different matrix/bands — every score 1-25 maps to
 *      LOW.
 *   3. Assert the ORIGINAL assessment row's stored `inherentScore`/
 *      `inherentLevel`/`residualScore`/`residualLevel` are BYTE-FOR-BYTE
 *      unchanged (still 25/CRITICAL), and its `methodologyVersionId` still
 *      points at V1 — never silently repointed to V2.
 *   4. Assert a NEW assessment created after V2 is published, scored with
 *      the IDENTICAL factors (5,5), now yields LOW — proving V2 is
 *      genuinely active and interpretation genuinely changed prospectively,
 *      which is exactly the contrast that makes step 3 meaningful (this is
 *      not "nothing changed", it's "the OLD record specifically did not
 *      change while the RULES did").
 */
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
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    // V1: standard 5x5 product matrix, LOW/MEDIUM/HIGH/CRITICAL bands.
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

    // --- Publish V2 under the SAME methodology, with a matrix that maps
    // EVERY attainable score to LOW — the most extreme possible contrast
    // with V1's CRITICAL result for the same (5,5) factors. -----------------
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

    // --- The core assertion: V1's assessment is UNTOUCHED -------------------
    const storedAssessment: RiskAssessment =
      await ctx.prisma.client.riskAssessment.findUniqueOrThrow({ where: { id: assessment.id } });
    expect(storedAssessment.methodologyVersionId).toBe(v1.id);
    expect(storedAssessment.inherentScore).toBe(25);
    expect(storedAssessment.inherentLevel).toBe('CRITICAL');
    expect(storedAssessment.residualScore).toBe(25);
    expect(storedAssessment.residualLevel).toBe('CRITICAL');

    // The risk's own denormalized levels (set at assessment time from V1)
    // are equally untouched by V2's publication — nothing rescans/rewrites
    // `risks` when a new methodology version is published.
    const storedRisk = await ctx.prisma.client.risk.findUniqueOrThrow({ where: { id: risk.id } });
    expect(storedRisk.inherentLevel).toBe('CRITICAL');
    expect(storedRisk.residualLevel).toBe('CRITICAL');

    // --- Prospective contrast: a NEW assessment, same factors, now scores
    // under V2 and gets a genuinely different result — proving V2 is
    // actually active and the platform's rules truly changed, which is
    // what makes the untouched V1 record above meaningful rather than
    // coincidental. ----------------------------------------------------------
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

    // The FIRST assessment is STILL untouched after the second is recorded.
    const storedAssessmentAfterSecond = await ctx.prisma.client.riskAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
    });
    expect(storedAssessmentAfterSecond.inherentLevel).toBe('CRITICAL');
    expect(storedAssessmentAfterSecond.methodologyVersionId).toBe(v1.id);

    // --- A stale, no-longer-active version supplied explicitly is refused
    // with 422, never silently rescored (US4 AS5, FR-068). --------------------
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
