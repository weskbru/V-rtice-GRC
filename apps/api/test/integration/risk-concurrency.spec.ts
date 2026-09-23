import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { UpdateRiskUseCase } from '../../src/modules/risk/application/update-risk.usecase';
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

describe('Risk concurrent update (T081, FR-103, FR-085, ADR-013)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let updateRiskUseCase: UpdateRiskUseCase;
  let riskRepository: RiskRepositoryPort;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    updateRiskUseCase = ctx.app.get(UpdateRiskUseCase);
    riskRepository = ctx.app.get(RiskRepositoryPort);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('exactly one of two concurrent updates from the same version succeeds; the other gets a 409-mapped conflict, never last-write-wins', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-concurrency-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-concurrency-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:edit'], {
      name: `fixture-risk-concurrency-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-concurrency-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Título antes da corrida',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    expect(risk.version).toBe(0);

    const [outcomeA, outcomeB] = await Promise.allSettled([
      updateRiskUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        title: 'Vencedor A',
      }),
      updateRiskUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        title: 'Vencedor B',
      }),
    ]);

    const outcomes = [outcomeA, outcomeB];
    const fulfilled = outcomes.filter(
      (
        outcome,
      ): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof updateRiskUseCase.execute>>> =>
        outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0]!.reason).toBeInstanceOf(OptimisticLockDomainError);
    const conflictError = rejected[0]!.reason as OptimisticLockDomainError;
    expect(conflictError.expectedVersion).toBe(risk.version);
    expect(conflictError.actualVersion).toBe(risk.version + 1);

    const winnerTitle = fulfilled[0]!.value.title;
    expect(['Vencedor A', 'Vencedor B']).toContain(winnerTitle);

    const finalState = await riskRepository.findById(globalScope(), risk.id);
    expect(finalState).toBeDefined();
    expect(finalState!.version).toBe(risk.version + 1);
    expect(finalState!.title).toBe(winnerTitle);

    const updateEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: 'RISK', entityId: risk.id, action: 'risk.updated' },
    });
    expect(updateEvents).toHaveLength(1);
  });
});
