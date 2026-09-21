/**
 * T080 — proves, against the real test database, that:
 *
 *   1. Creation assigns a unique, human-readable, per-year code
 *      (FR-054) — two risks created back-to-back never collide.
 *   2. Creation is audited with the new field values (FR-032, ADR-005).
 *   3. Update records each CHANGED field's previous and new value
 *      (FR-033, FR-058) — a field re-submitted unchanged does not appear
 *      in the audit payload, and version increments (ADR-013).
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { UpdateRiskUseCase } from '../../src/modules/risk/application/update-risk.usecase';
import { RISK_CODE_PATTERN } from '../../src/modules/risk/domain/risk-code';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

/**
 * `AuditRecorder` reads `actorUserId`/`ipAddress`/`userAgent`/`correlationId`
 * from the AMBIENT `RequestContextStore` (ADR-005/ADR-012) — populated by
 * `RequestContextMiddleware` for a real HTTP request, but this suite calls
 * the use case directly with no HTTP request in the loop, exactly like
 * `test/integration/audit-transactional.spec.ts` does. Without this, every
 * audit row's `actorUserId` would be `null` even though `actorLabel` was
 * supplied explicitly.
 */
function withActorContext<T>(actorUserId: string, fn: () => Promise<T>): Promise<T> {
  return RequestContextStore.run(
    {
      correlationId: randomUUID(),
      ipAddress: '203.0.113.10',
      userAgent: 'vitest-integration',
      method: 'POST',
      path: '/test/risk-crud',
      actorUserId,
    },
    fn,
  );
}

describe('Risk creation and update (T080, FR-054, FR-032, FR-033, FR-058, ADR-005, ADR-013)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let updateRiskUseCase: UpdateRiskUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    updateRiskUseCase = ctx.app.get(UpdateRiskUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function buildActorWithAccess(orgUnitId: string) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-crud-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:edit'], {
      name: `fixture-risk-crud-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  /**
   * F-CV-2 (`risks-lifecycle-audit`): being assignable as owner/responsible
   * now also requires being able to SEE the risk once assigned —
   * `risk:view` plus scope reaching `orgUnitId`, on top of the pre-existing
   * assignment-line check this file never exercised in the first place
   * (every owner/responsible here has no `primaryOrgUnitId`, trivially in
   * line). Every bare `createUserFixture` owner/responsible in this file
   * needs this to keep passing.
   */
  async function makeEligibleAssignee(orgUnitId: string, email: string) {
    const user = await createUserFixture(ctx.prisma, { email });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:view'], {
      name: `fixture-risk-crud-viewer-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user, role });
    await grantUnitScopeFixture(ctx.prisma, { user, orgUnitId });
    return user;
  }

  it('assigns a unique, per-year code to each created risk (FR-054)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-crud-org'),
    });
    const actor = await buildActorWithAccess(orgUnit.id);
    const owner = await makeEligibleAssignee(
      orgUnit.id,
      `${uniqueTestMarker('risk-crud-owner')}@example.test`,
    );

    const riskA = await withActorContext(actor.id, () =>
      createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Risco A',
        description: 'Descrição do risco A.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      }),
    );
    const riskB = await withActorContext(actor.id, () =>
      createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Risco B',
        description: 'Descrição do risco B.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      }),
    );

    expect(riskA.code).toMatch(RISK_CODE_PATTERN);
    expect(riskB.code).toMatch(RISK_CODE_PATTERN);
    expect(riskA.code).not.toBe(riskB.code);
    expect(riskA.id).not.toBe(riskB.id);
  });

  it('audits creation with the new field values, and no previous values (FR-032)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-crud-org'),
    });
    const actor = await buildActorWithAccess(orgUnit.id);
    const owner = await makeEligibleAssignee(
      orgUnit.id,
      `${uniqueTestMarker('risk-crud-owner')}@example.test`,
    );

    const risk = await withActorContext(actor.id, () =>
      createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Risco Auditado na Criação',
        description: 'Descrição original.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      }),
    );

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.RISK, entityId: risk.id },
    });

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.action).toBe('risk.created');
    expect(event.actorUserId).toBe(actor.id);
    expect(event.organizationalUnitId).toBe(orgUnit.id);
    expect(event.previousValues).toBeNull();

    const newValues = event.newValues as Record<string, unknown>;
    expect(newValues.title).toBe('Risco Auditado na Criação');
    expect(newValues.description).toBe('Descrição original.');
    expect(newValues.orgUnitId).toBe(orgUnit.id);
    expect(newValues.ownerUserId).toBe(owner.id);

    // No secret/internal field ever reaches the payload (allow-list, FR-035).
    const raw = JSON.stringify(event);
    expect(raw).not.toMatch(/passwordHash/i);
    expect(raw).not.toMatch(/tokenHash/i);
  });

  it('audits an update with previous AND new values for each CHANGED field only (FR-033, FR-058)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-crud-org'),
    });
    const actor = await buildActorWithAccess(orgUnit.id);
    const owner = await makeEligibleAssignee(
      orgUnit.id,
      `${uniqueTestMarker('risk-crud-owner')}@example.test`,
    );
    const newResponsible = await makeEligibleAssignee(
      orgUnit.id,
      `${uniqueTestMarker('risk-crud-responsible')}@example.test`,
    );

    const risk = await withActorContext(actor.id, () =>
      createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Título original',
        description: 'Descrição original.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      }),
    );

    const updated = await withActorContext(actor.id, () =>
      updateRiskUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        title: 'Título atualizado',
        // Re-submitting the SAME description on purpose: must not appear in
        // the audit diff (only genuinely changed fields do).
        description: 'Descrição original.',
        responsibleUserId: newResponsible.id,
      }),
    );

    expect(updated.version).toBe(risk.version + 1);
    expect(updated.title).toBe('Título atualizado');
    expect(updated.responsible?.id).toBe(newResponsible.id);

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.RISK, entityId: risk.id, action: 'risk.updated' },
    });
    expect(events).toHaveLength(1);

    const event = events[0]!;
    const previousValues = event.previousValues as Record<string, unknown>;
    const newValues = event.newValues as Record<string, unknown>;

    expect(previousValues.title).toBe('Título original');
    expect(newValues.title).toBe('Título atualizado');
    expect(previousValues.responsibleUserId).toBeNull();
    expect(newValues.responsibleUserId).toBe(newResponsible.id);

    // The unchanged field must not appear in either side of the diff.
    expect(previousValues).not.toHaveProperty('description');
    expect(newValues).not.toHaveProperty('description');
  });
});
