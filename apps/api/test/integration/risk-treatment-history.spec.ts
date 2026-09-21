/**
 * T133 — FR-073: recording a new treatment decision supersedes the
 * previous one by STAMPING it, never by overwriting it.
 *
 * The core proof this test exists for, mirroring `risk-assessment-history
 * .spec.ts`'s own "byte-for-byte" methodology: the FIRST decision's row is
 * captured via a raw Prisma read before and after the second decision is
 * recorded, and every column except `supersededAt`/`supersededById` is
 * asserted UNCHANGED with `toEqual` on the whole row minus those two
 * fields — not merely "still present with the same id".
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { RecordTreatmentUseCase } from '../../src/modules/risk/application/record-treatment.usecase';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { RiskTreatmentDecision } from '@prisma/client';

describe('Risk treatment decision history (T133, FR-072, FR-073)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let recordTreatmentUseCase: RecordTreatmentUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    recordTreatmentUseCase = ctx.app.get(RecordTreatmentUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a new decision supersedes the previous one by stamping it — the prior row is preserved unchanged, never overwritten', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('treatment-history-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('treatment-history-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:treat'], {
      name: `fixture-treatment-history-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('treatment-history-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para histórico de tratamento',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    expect(risk.version).toBe(0);
    expect(risk.currentTreatmentId).toBeUndefined();

    // --- First decision -----------------------------------------------
    const { decision: first, risk: riskAfterFirst } = await recordTreatmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      strategy: 'MITIGATE',
      description: 'Mitigar por meio de controles adicionais.',
      deadline: '2027-01-31',
    });

    expect(first.supersededAt).toBeNull();
    expect(riskAfterFirst.currentTreatmentId).toBe(first.id);
    expect(riskAfterFirst.version).toBe(1);

    // Snapshot the first decision's raw row BEFORE it is superseded.
    const firstRowBefore: RiskTreatmentDecision =
      await ctx.prisma.client.riskTreatmentDecision.findUniqueOrThrow({ where: { id: first.id } });
    expect(firstRowBefore.supersededAt).toBeNull();
    expect(firstRowBefore.supersededById).toBeNull();

    // --- Second decision — supersedes the first ------------------------
    const { decision: second, risk: riskAfterSecond } = await recordTreatmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: riskAfterFirst.version,
      strategy: 'ACCEPT',
      description: 'Aceitar o risco após reavaliação de contexto.',
      deadline: null,
    });

    expect(second.id).not.toBe(first.id);
    expect(second.supersededAt).toBeNull();
    expect(riskAfterSecond.currentTreatmentId).toBe(second.id);
    expect(riskAfterSecond.version).toBe(2);

    // --- The core proof: the FIRST row is preserved, not overwritten ---
    const firstRowAfter: RiskTreatmentDecision =
      await ctx.prisma.client.riskTreatmentDecision.findUniqueOrThrow({ where: { id: first.id } });

    // The ONLY two columns FR-073's supersession stamp is allowed to
    // change (and the database's own `risk_treatment_decisions_append_only`
    // trigger enforces this — see the migration).
    expect(firstRowAfter.supersededAt).not.toBeNull();
    expect(firstRowAfter.supersededById).toBe(second.id);

    // Every OTHER column is byte-for-byte identical to the pre-supersession
    // snapshot — the decision itself was never touched, only stamped.
    const { supersededAt: _s1, supersededById: _b1, ...firstBeforeRest } = firstRowBefore;
    const { supersededAt: _s2, supersededById: _b2, ...firstAfterRest } = firstRowAfter;
    expect(firstAfterRest).toEqual(firstBeforeRest);
    expect(firstRowAfter.riskId).toBe(firstRowBefore.riskId);
    expect(firstRowAfter.strategy).toBe(firstRowBefore.strategy);
    expect(firstRowAfter.description).toBe(firstRowBefore.description);
    expect(firstRowAfter.decidedByUserId).toBe(firstRowBefore.decidedByUserId);
    expect(firstRowAfter.decidedAt).toEqual(firstRowBefore.decidedAt);

    // --- Both decisions remain retrievable, newest first ---------------
    const history = await ctx.prisma.client.riskTreatmentDecision.findMany({
      where: { riskId: risk.id },
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
    });
    expect(history).toHaveLength(2);
    expect(history[0]!.id).toBe(second.id);
    expect(history[1]!.id).toBe(first.id);
  });

  it('the database itself refuses any UPDATE that is not the FR-073 supersession stamp (the trigger backstop)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('treatment-trigger-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('treatment-trigger-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:treat'], {
      name: `fixture-treatment-trigger-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('treatment-trigger-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para verificação do gatilho de apenas-inclusão',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { decision } = await recordTreatmentUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      strategy: 'TRANSFER',
      description: 'Transferir via apólice de seguro.',
    });

    // A DELETE is refused outright — no delete path ever exists for this
    // table (append-only).
    await expect(
      ctx.prisma.client.riskTreatmentDecision.delete({ where: { id: decision.id } }),
    ).rejects.toThrow();

    // An UPDATE to a business-content field (not the supersession stamp) is
    // refused by the trigger, even against the restricted application role.
    await expect(
      ctx.prisma.client.riskTreatmentDecision.update({
        where: { id: decision.id },
        data: { description: 'Tentativa de reescrever a decisão histórica.' },
      }),
    ).rejects.toThrow();
  });
});
