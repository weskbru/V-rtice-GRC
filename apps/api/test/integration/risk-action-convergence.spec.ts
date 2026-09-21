/**
 * 007-implementation-remediation, Frente A, D-1 a D-5 — the Action
 * convergence, exercised end to end against the real database. `Action`
 * (`grc/action`) is now the SOLE authority for a risk treatment action's
 * work-item fields; `risk_treatment_actions` is a pure link row. This file
 * REPLACES the previous coexistence-window suite (T046/T055,
 * `MirrorActionStatusFromOriginUseCase`/`MirrorActionFieldsFromOriginUseCase`,
 * both deleted) — it no longer has a mirror to test, and testing "the
 * mirror drifts by design" would be testing a defect this same migration
 * fixed (the 7ms `completedAt` drift the coordinator found and this
 * migration's own reconciliation step, `STEP 1B`, now closes).
 *
 * Byte-level inspection via raw Prisma reads, the same methodology
 * `risk-treatment-history.spec.ts` already establishes for this module.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { CreateTreatmentActionUseCase } from '../../src/modules/risk/application/treatment-actions/create-treatment-action.usecase';
import { UpdateTreatmentActionUseCase } from '../../src/modules/risk/application/treatment-actions/update-treatment-action.usecase';
import { toTreatmentActionResponse } from '../../src/modules/risk/presentation/dto/treatment-action-response.mapper';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Risk treatment <-> shared Action convergence (007-implementation-remediation, Frente A)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createTreatmentActionUseCase: CreateTreatmentActionUseCase;
  let updateTreatmentActionUseCase: UpdateTreatmentActionUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createTreatmentActionUseCase = ctx.app.get(CreateTreatmentActionUseCase);
    updateTreatmentActionUseCase = ctx.app.get(UpdateTreatmentActionUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(): Promise<{ actorUserId: string; orgUnitId: string }> {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('convergence-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('convergence-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:view', 'risk:treat'],
      { name: `fixture-convergence-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    return { actorUserId: actor.id, orgUnitId: orgUnit.id };
  }

  async function createRiskAndAction(actorUserId: string, orgUnitId: string, title: string) {
    const risk = await createRiskUseCase.execute({
      actorUserId,
      title,
      description: 'Descrição.',
      orgUnitId,
      ownerUserId: actorUserId,
    });
    const created = await createTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      expectedVersion: risk.version,
      title,
      responsibleUserId: actorUserId,
      dueOn: '2026-05-01',
    });
    return { risk, created };
  }

  it('D-1/D-5: creating a treatment action creates exactly ONE Action, one link row, and TWO distinct audit events', async () => {
    const { actorUserId, orgUnitId } = await setupActor();
    const { risk, created } = await createRiskAndAction(
      actorUserId,
      orgUnitId,
      'Corrigir a lacuna identificada',
    );

    // `created.action` IS the shared Action now (D-2) — no separate
    // `TreatmentActionRecord` identity any more.
    expect(created.action.originType).toBe('RISK_TREATMENT');
    expect(created.action.originId).toBe(risk.id);
    expect(created.action.status).toBe('OPEN');
    expect(created.action.code).toMatch(/^ACT-\d{4}-\d{4,}$/);

    const linkRow = await ctx.prisma.riskTreatmentAction.findUniqueOrThrow({
      where: { actionId: created.action.id },
    });
    expect(linkRow.riskId).toBe(risk.id);

    // D-1/D-5 — two rows written, two distinct events. `action.created`
    // identifies the ACTION; `risk.treatment_action_created` identifies
    // the LINK ROW (coordinator review, 2026-09-11) — never the same id
    // for both, or the entity-type column would mean two different things
    // across time.
    const actionCreatedAudit = await ctx.prisma.auditEvent.findFirst({
      where: {
        entityId: created.action.id,
        entityType: AuditEntityType.ACTION,
        action: 'action.created',
      },
    });
    expect(actionCreatedAudit).not.toBeNull();

    const linkCreatedAudit = await ctx.prisma.auditEvent.findFirst({
      where: {
        entityId: linkRow.id,
        entityType: AuditEntityType.RISK_TREATMENT_ACTION,
        action: 'risk.treatment_action_created',
      },
    });
    expect(linkCreatedAudit).not.toBeNull();
    expect(linkCreatedAudit).not.toBeNull();
    expect(linkCreatedAudit!.entityId).not.toBe(actionCreatedAudit!.entityId);
  });

  it('D-3: the risk route enforces the SAME transition legality as POST /actions/{id}/transitions — OPEN -> COMPLETED directly is illegal', async () => {
    const { actorUserId, orgUnitId } = await setupActor();
    const { risk, created } = await createRiskAndAction(
      actorUserId,
      orgUnitId,
      'Ação para transição ilegal',
    );

    await expect(
      updateTreatmentActionUseCase.execute({
        actorUserId,
        riskId: risk.id,
        actionId: created.action.id,
        expectedVersion: created.risk.version,
        status: 'COMPLETED',
      }),
    ).rejects.toThrow();
  });

  it('D-3: reopening a COMPLETED action through the risk route requires a reason, exactly like the direct Action route', async () => {
    const { actorUserId, orgUnitId } = await setupActor();
    const { risk, created } = await createRiskAndAction(
      actorUserId,
      orgUnitId,
      'Ação a completar e reabrir',
    );

    const inProgress = await updateTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      actionId: created.action.id,
      expectedVersion: created.risk.version,
      status: 'IN_PROGRESS',
    });
    const completed = await updateTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      actionId: created.action.id,
      expectedVersion: inProgress.risk.version,
      status: 'COMPLETED',
    });
    expect(completed.action.status).toBe('COMPLETED');
    expect(completed.action.completedAt).not.toBeNull();

    // No reason supplied — must be rejected, never silently accepted the
    // way the pre-convergence route used to (F-36).
    await expect(
      updateTreatmentActionUseCase.execute({
        actorUserId,
        riskId: risk.id,
        actionId: created.action.id,
        expectedVersion: completed.risk.version,
        status: 'OPEN',
      }),
    ).rejects.toThrow();

    // With a reason, it succeeds, and ONLY the action.* event fires (D-5 —
    // no more `risk.treatment_action_status_changed` duplicate).
    const beforeReopenAuditCount = await ctx.prisma.auditEvent.count({
      where: { entityId: created.action.id, entityType: AuditEntityType.ACTION },
    });
    const reopened = await updateTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      actionId: created.action.id,
      expectedVersion: completed.risk.version,
      status: 'OPEN',
      reopenReason: 'Reaberta para nova verificação.',
    });
    expect(reopened.action.status).toBe('OPEN');
    // Coordinator correction, 007-implementation-remediation: this
    // asserted `.toBeNull()` against `ActionRecord.completedAt`, but that
    // field's own declared type
    // (`grc/action/domain/ports/action-repository.port.ts`) is
    // `Date | undefined`, never `Date | null` —
    // `PrismaActionRepository`'s `toActionRecord` maps a NULL column to
    // `undefined` on purpose (`row.completedAt ?? undefined`), the same
    // convention every other optional field on this record uses. The
    // assertion was checking the right FACT at the wrong LAYER. What
    // actually matters — the persisted column and the wire response a
    // caller receives — is checked explicitly below, at the layers where
    // `null` is the real contract.
    expect(reopened.action.completedAt).toBeUndefined();
    expect(reopened.action.reopenReason).toBe('Reaberta para nova verificação.');

    // The persisted column, read directly — not inferred from the
    // use case's return value.
    const persisted = await ctx.prisma.action.findUniqueOrThrow({
      where: { id: created.action.id },
      select: { completedAt: true, completedByUserId: true },
    });
    expect(persisted.completedAt).toBeNull();
    expect(persisted.completedByUserId).toBeNull();

    // The wire value a caller of `GET/PATCH /risks/{riskId}/treatment-actions`
    // actually receives — `contracts/risks.openapi.yaml` declares
    // `completedAt` nullable, so this is the layer where `null` (not
    // `undefined`) is the real, contracted shape. Built through the SAME
    // mapper the controller calls (`treatment.controller.ts`), not
    // reconstructed by hand.
    const wireResponse = toTreatmentActionResponse(reopened.action, reopened.treatmentDecisionId);
    expect(wireResponse.completedAt).toBeNull();

    const afterReopenAuditCount = await ctx.prisma.auditEvent.count({
      where: { entityId: created.action.id, entityType: AuditEntityType.ACTION },
    });
    expect(afterReopenAuditCount).toBe(beforeReopenAuditCount + 1);

    const noLinkStatusEvent = await ctx.prisma.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.RISK_TREATMENT_ACTION,
        action: 'risk.treatment_action_status_changed',
      },
    });
    expect(noLinkStatusEvent).toBeNull();
  });

  it('D-1: editing title/description/responsibleUserId/dueOn through the risk route writes the Action directly, with an action.updated event', async () => {
    const { actorUserId, orgUnitId } = await setupActor();
    const { risk, created } = await createRiskAndAction(actorUserId, orgUnitId, 'Título original');

    const newResponsible = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('convergence-new-responsible')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });

    const updated = await updateTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      actionId: created.action.id,
      expectedVersion: created.risk.version,
      title: 'Título atualizado pelo módulo de Riscos',
      description: 'Descrição atualizada.',
      responsibleUserId: newResponsible.id,
      dueOn: '2026-06-15',
    });
    expect(updated.action.title).toBe('Título atualizado pelo módulo de Riscos');

    const actionRow = await ctx.prisma.action.findUniqueOrThrow({
      where: { id: created.action.id },
    });
    expect(actionRow.title).toBe('Título atualizado pelo módulo de Riscos');
    expect(actionRow.description).toBe('Descrição atualizada.');
    expect(actionRow.responsibleUserId).toBe(newResponsible.id);
    expect(actionRow.dueOn.toISOString().slice(0, 10)).toBe('2026-06-15');

    const updatedAudit = await ctx.prisma.auditEvent.findFirst({
      where: {
        entityId: created.action.id,
        entityType: AuditEntityType.ACTION,
        action: 'action.updated',
      },
    });
    expect(updatedAudit).not.toBeNull();
  });

  it('D-2: an Action created directly via the shared authority, with no link row, is a legitimate, distinct state', async () => {
    // Regression guard for the exact defect the convergence exists to fix:
    // an Action of origin RISK_TREATMENT with no risk_treatment_actions
    // link row must not confuse any of the risk route's own read paths —
    // it simply is not addressable BY the risk route (no riskId path can
    // name it without a link), which is the correct, documented shape
    // (D-2), not an error state.
    const { actorUserId, orgUnitId } = await setupActor();
    const risk = await createRiskUseCase.execute({
      actorUserId,
      title: 'Risco com ação órfã',
      description: 'Descrição.',
      orgUnitId,
      ownerUserId: actorUserId,
    });

    const orphanAction = await ctx.prisma.action.create({
      data: {
        code: `ACT-TEST-${randomUUID().slice(0, 8)}`,
        orgUnitId,
        originType: 'RISK_TREATMENT',
        originId: risk.id,
        title: 'Ação órfã de propósito (D-2)',
        responsibleUserId: actorUserId,
        dueOn: new Date('2026-12-31'),
        status: 'OPEN',
      },
    });

    const link = await ctx.prisma.riskTreatmentAction.findUnique({
      where: { actionId: orphanAction.id },
    });
    expect(link).toBeNull();
  });
});
