/**
 * T116 — FR-065/FR-064: reassessment APPENDS (never overwrites), preserves
 * every prior assessment, and repoints `Risk.currentAssessmentId` (plus the
 * denormalized levels/`lastAssessedOn`) to the newest one, all inside one
 * transaction.
 *
 * The core proof this test exists for: the FIRST assessment's row is
 * BYTE-FOR-BYTE IDENTICAL before and after a reassessment happens — not
 * merely "still present with the same id", but every column unchanged,
 * captured via a raw Prisma read before and after and compared with
 * `toEqual` on the whole row.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateAssessmentUseCase } from '../../src/modules/risk/application/create-assessment.usecase';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
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

describe('Risk assessment history (T116, FR-064, FR-065, SC-007)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createAssessmentUseCase: CreateAssessmentUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createAssessmentUseCase = ctx.app.get(CreateAssessmentUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('reassessment appends a new record, preserves the prior one byte-for-byte, and repoints the current pointer', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('assessment-history-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('assessment-history-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:assess'],
      { name: `fixture-assessment-history-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('assessment-history-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    await createMethodologyVersionFixture(ctx.prisma, actor.id);

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para histórico de avaliação',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    expect(risk.version).toBe(0);
    expect(risk.currentAssessmentId).toBeUndefined();

    // --- First assessment -------------------------------------------------
    const { assessment: first, risk: riskAfterFirst } = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      inherentProbability: 5,
      inherentImpact: 5,
      residualProbability: 3,
      residualImpact: 3,
      rationale: 'Primeira avaliação.',
    });

    expect(first.previousAssessmentId).toBeNull();
    expect(first.inherentScore).toBe(25);
    expect(first.inherentLevel).toBe('CRITICAL');
    expect(first.residualScore).toBe(9);
    expect(first.residualLevel).toBe('MEDIUM');
    expect(riskAfterFirst.currentAssessmentId).toBe(first.id);
    expect(riskAfterFirst.inherentLevel).toBe('CRITICAL');
    expect(riskAfterFirst.residualLevel).toBe('MEDIUM');
    expect(riskAfterFirst.version).toBe(1);

    // Snapshot the first assessment's raw row BEFORE reassessing.
    const firstRowBefore: RiskAssessment = await ctx.prisma.client.riskAssessment.findUniqueOrThrow(
      { where: { id: first.id } },
    );

    // --- Reassessment (different factors, different level) ----------------
    const { assessment: second, risk: riskAfterSecond } = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: riskAfterFirst.version,
      inherentProbability: 1,
      inherentImpact: 1,
      residualProbability: 1,
      residualImpact: 1,
      rationale: 'Reavaliação com fatores diferentes.',
    });

    expect(second.id).not.toBe(first.id);
    expect(second.previousAssessmentId).toBe(first.id);
    expect(second.inherentScore).toBe(1);
    expect(second.inherentLevel).toBe('LOW');
    expect(second.residualScore).toBe(1);
    expect(second.residualLevel).toBe('LOW');
    expect(riskAfterSecond.currentAssessmentId).toBe(second.id);
    expect(riskAfterSecond.inherentLevel).toBe('LOW');
    expect(riskAfterSecond.residualLevel).toBe('LOW');
    expect(riskAfterSecond.version).toBe(2);

    // --- The core proof: the FIRST row is untouched, byte-for-byte --------
    const firstRowAfter: RiskAssessment = await ctx.prisma.client.riskAssessment.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(firstRowAfter).toEqual(firstRowBefore);

    // --- Both assessments remain retrievable, newest first -----------------
    const history = await ctx.prisma.client.riskAssessment.findMany({
      where: { riskId: risk.id },
      orderBy: [{ assessedOn: 'desc' }, { id: 'desc' }],
    });
    expect(history).toHaveLength(2);
    expect(history[0]!.id).toBe(second.id);
    expect(history[1]!.id).toBe(first.id);

    // --- A reassessment yielding an identical level is still a new row
    // (edge case explicitly called out by data-model.md §9) -----------------
    const { assessment: third, risk: riskAfterThird } = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: riskAfterSecond.version,
      inherentProbability: 1,
      inherentImpact: 1,
      residualProbability: 1,
      residualImpact: 1,
      rationale: 'Reavaliação com o mesmo nível resultante.',
    });
    expect(third.id).not.toBe(second.id);
    expect(third.previousAssessmentId).toBe(second.id);
    expect(third.inherentLevel).toBe('LOW');
    expect(riskAfterThird.currentAssessmentId).toBe(third.id);

    const historyAfterThird = await ctx.prisma.client.riskAssessment.count({
      where: { riskId: risk.id },
    });
    expect(historyAfterThird).toBe(3);
  });
});
