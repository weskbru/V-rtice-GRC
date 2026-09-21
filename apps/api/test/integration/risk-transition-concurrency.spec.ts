/**
 * T149 — proves FR-085 ("concurrent transition requests on the same risk
 * result in at most one applied transition") for real: two genuinely
 * concurrent `PerformTransitionUseCase.execute(...)` calls against the SAME
 * risk, both starting from the SAME `expectedVersion` and both requesting
 * the SAME legal transition (`DRAFT -> IDENTIFIED`), launched via
 * `Promise.allSettled` with NO artificial delay between them — they race
 * through the SAME real Postgres connection pool the whole application
 * uses (identical methodology to `test/integration/risk-concurrency.spec.ts`'s
 * own T081 proof for plain field updates), never two SEQUENTIAL calls. This
 * is what makes it a genuine race rather than a simulation of one: both
 * promises are created and awaited together, so whichever transaction's
 * conditional `UPDATE` reaches PostgreSQL first is decided by the database's
 * own row lock + `EvalPlanQual` re-check (`risk.repository.ts`'s
 * `applyLifecycleTransition`/`conditionalVersionUpdate` header), not by
 * anything this test controls or orders.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { PerformTransitionUseCase } from '../../src/modules/risk/application/perform-transition.usecase';
import { RiskRepositoryPort } from '../../src/modules/risk/domain/ports/risk-repository.port';
import { RiskModule } from '../../src/modules/risk/risk.module';
import { OptimisticLockDomainError } from '../../src/shared/errors/domain-error';
import { globalScope } from '../../src/shared/persistence/scope-filter';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Risk transition concurrency (T149, FR-085, ADR-006, ADR-013)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let performTransitionUseCase: PerformTransitionUseCase;
  let riskRepository: RiskRepositoryPort;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    performTransitionUseCase = ctx.app.get(PerformTransitionUseCase);
    riskRepository = ctx.app.get(RiskRepositoryPort);
    prisma = ctx.app.get(PrismaService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('exactly one of two concurrent DRAFT -> IDENTIFIED transitions from the same version applies; the other gets a 409-mapped conflict', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-transition-race-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-transition-race-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:edit'], {
      name: `fixture-risk-transition-race-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-transition-race-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: uniqueTestMarker('risk-transition-race-category'),
        name: 'Categoria de teste',
        description: 'Fixture category.',
        sortOrder: 1,
        isActive: true,
      },
    });

    // DRAFT_FIELDS_COMPLETE (FR-055) needs title, description, category,
    // orgUnit and owner — all supplied here so the transition's precondition
    // is met from the start; the race is about the VERSION check, not about
    // a precondition failing.
    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para corrida de transição',
      description: 'Descrição completa.',
      categoryId: category.id,
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    expect(risk.status).toBe('DRAFT');
    expect(risk.version).toBe(0);

    // Both requests read/hold the SAME version — exactly what two browser
    // tabs (or two users) acting on the same risk detail page would send as
    // `If-Match`.
    const [outcomeA, outcomeB] = await Promise.allSettled([
      performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        toStatus: 'IDENTIFIED',
      }),
      performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        toStatus: 'IDENTIFIED',
      }),
    ]);

    const outcomes = [outcomeA, outcomeB];
    const fulfilled = outcomes.filter(
      (
        outcome,
      ): outcome is PromiseFulfilledResult<
        Awaited<ReturnType<typeof performTransitionUseCase.execute>>
      > => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );

    // The core proof: never both succeed, never both fail (FR-085's "AT MOST
    // one applied transition" — combined with the earlier precondition
    // check, exactly one MUST apply here since preconditions are met).
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0]!.reason).toBeInstanceOf(OptimisticLockDomainError);
    const conflictError = rejected[0]!.reason as OptimisticLockDomainError;
    expect(conflictError.expectedVersion).toBe(risk.version);
    expect(conflictError.actualVersion).toBe(risk.version + 1);

    // The winner's write is the ONLY one ever persisted.
    expect(fulfilled[0]!.value.risk.status).toBe('IDENTIFIED');
    expect(fulfilled[0]!.value.risk.version).toBe(risk.version + 1);

    const finalState = await riskRepository.findById(globalScope(), risk.id);
    expect(finalState).toBeDefined();
    expect(finalState!.status).toBe('IDENTIFIED');
    expect(finalState!.version).toBe(risk.version + 1);

    // Exactly one `RiskLifecycleTransition` row was ever written — the
    // loser's attempt never committed anything (its transaction rolled back
    // before the transition INSERT could survive), so it left no trace at
    // all, not even an orphaned append-only row.
    const transitionRows = await prisma.client.riskLifecycleTransition.findMany({
      where: { riskId: risk.id },
    });
    expect(transitionRows).toHaveLength(1);
    expect(transitionRows[0]!.fromStatus).toBe('DRAFT');
    expect(transitionRows[0]!.toStatus).toBe('IDENTIFIED');

    // Exactly one audit row for the transition, for the same reason.
    const auditEvents = await prisma.client.auditEvent.findMany({
      where: { entityType: 'RISK_LIFECYCLE_TRANSITION', action: 'risk.transitioned' },
    });
    const auditEventsForThisRisk = auditEvents.filter(
      (event) => (event.newValues as { riskId?: string } | null)?.riskId === risk.id,
    );
    expect(auditEventsForThisRisk).toHaveLength(1);
  });
});
