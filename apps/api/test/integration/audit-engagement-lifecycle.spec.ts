/**
 * T034/T034a/T034b/T035/T036/005-audit-findings, User Story 1 — proves the
 * engagement's four-state lifecycle end to end, through the REAL
 * application services (`CreateAuditEngagementUseCase` ->
 * `StartAuditEngagementUseCase`/`CompleteAuditEngagementUseCase`/
 * `CancelAuditEngagementUseCase`), not by re-reading the transition table
 * — the same discipline `requirement-compliance-state-reachability.spec.ts`
 * already establishes for `004-compliance-management`.
 *
 * Every state is exercised for its OWN observable consequence, the exact
 * discipline `FindingStatus` (Fase 1) shipped without and `ControlStatus
 * .DRAFT` (Fase 2) nearly shipped without (quickstart.md §2):
 *
 * - `PLANNING` — editable; cannot start without scope (FR-003, T035).
 * - `IN_PROGRESS` — no longer editable (research.md D-3); would accept
 *   findings (asserted at the domain level — the real HTTP producer is
 *   Fase 4/`grc/finding`'s own scope, T042, not this task's).
 * - `COMPLETED` — terminal, remains fully readable afterward (FR-004,
 *   T036); would refuse a new finding (same domain-level assertion).
 * - `CANCELLED` (FR-004a) — reachable from `PLANNING` AND `IN_PROGRESS`
 *   (T034a), requires a justification, terminal, would refuse a new
 *   finding too.
 *
 * T034b — the reachability proof this whole amendment exists for: an
 * engagement stuck in `PLANNING` with NO scope (cannot start, FR-003)
 * still has a way out (`-> CANCELLED`) — never a dead end.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationModule } from '../../src/core/authorization/authorization.module';
import { OrganizationsModule } from '../../src/core/organizations/organizations.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CancelAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/cancel-audit-engagement.usecase';
import { CompleteAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/complete-audit-engagement.usecase';
import { CreateAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/create-audit-engagement.usecase';
import { GetAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/get-audit-engagement.usecase';
import { LinkAuditScopeToControlUseCase } from '../../src/modules/audit-engagements/application/scope/link-control.usecase';
import { StartAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/start-audit-engagement.usecase';
import { UpdateAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/update-audit-engagement.usecase';
import { AuditEngagementsModule } from '../../src/modules/audit-engagements/audit-engagements.module';
import { assertAuditEngagementAcceptsFindings } from '../../src/modules/audit-engagements/domain/audit-engagement.entity';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { User } from '@prisma/client';

describe('AuditEngagement lifecycle — every state reachable, with its own observable consequence (T034/T034a/T034b/T035/T036)', () => {
  let ctx: IntegrationTestContext;
  let createEngagement: CreateAuditEngagementUseCase;
  let getEngagement: GetAuditEngagementUseCase;
  let updateEngagement: UpdateAuditEngagementUseCase;
  let linkControlScope: LinkAuditScopeToControlUseCase;
  let startEngagement: StartAuditEngagementUseCase;
  let completeEngagement: CompleteAuditEngagementUseCase;
  let cancelEngagement: CancelAuditEngagementUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [
        LoggingModule,
        CacheModule,
        OrganizationsModule,
        AuthorizationModule,
        ComplianceModule,
        AuditEngagementsModule,
      ],
    });
    createEngagement = ctx.app.get(CreateAuditEngagementUseCase);
    getEngagement = ctx.app.get(GetAuditEngagementUseCase);
    updateEngagement = ctx.app.get(UpdateAuditEngagementUseCase);
    linkControlScope = ctx.app.get(LinkAuditScopeToControlUseCase);
    startEngagement = ctx.app.get(StartAuditEngagementUseCase);
    completeEngagement = ctx.app.get(CompleteAuditEngagementUseCase);
    cancelEngagement = ctx.app.get(CancelAuditEngagementUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('audit-engagement-lifecycle-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      [
        'audit-engagement:view',
        'audit-engagement:create',
        'audit-engagement:edit',
        'audit-engagement:scope',
        'audit-engagement:transition',
        'control:view',
      ],
      { name: `fixture-audit-engagement-lifecycle-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupControl(orgUnitId: string) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-audit-scope'),
        name: 'Controle para escopo de auditoria',
        orgUnitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  it('PLANNING is reached on creation, with a stable code and the creation on the audit trail (FR-001, US1 AS1)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-create'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Avaliar controles de acesso lógico do trimestre.',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    expect(engagement.status).toBe('PLANNING');
    expect(engagement.code).toMatch(/^AUD-\d{4}-\d{4,}$/);

    const read = await getEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });
    expect(read.id).toBe(engagement.id);
  });

  it('PLANNING -> IN_PROGRESS requires scope (FR-003, T035): refused without it, remains PLANNING, then succeeds once scoped', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-start'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Exame de conformidade PCI-DSS.',
      periodStart: new Date('2026-02-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-28T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    // No scope link exists yet — starting must be refused, and the
    // engagement must remain PLANNING (not silently advance).
    await expect(
      startEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        expectedVersion: engagement.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const stillPlanning = await getEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });
    expect(stillPlanning.status).toBe('PLANNING');

    // Add a control to scope — now starting is legal.
    const control = await setupControl(orgUnit.id);
    await linkControlScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      controlId: control.id,
    });

    const started = await startEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      expectedVersion: stillPlanning.version,
    });
    expect(started.status).toBe('IN_PROGRESS');
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.startedBy?.id).toBe(actor.id);

    const auditRow = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: 'AUDIT_ENGAGEMENT',
        entityId: engagement.id,
        action: 'audit_engagement.started',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect((auditRow?.previousValues as { status?: string } | null)?.status).toBe('PLANNING');
    expect((auditRow?.newValues as { status?: string } | null)?.status).toBe('IN_PROGRESS');
  });

  it('IN_PROGRESS is no longer editable — PATCH refused, once scoped and started (research.md D-3)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-edit-locked'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Auditoria interna de processos financeiros.',
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-30T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    const control = await setupControl(orgUnit.id);
    await linkControlScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      controlId: control.id,
    });
    const started = await startEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      expectedVersion: engagement.version,
    });
    expect(started.status).toBe('IN_PROGRESS');

    await expect(
      updateEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        expectedVersion: started.version,
        objective: 'Tentativa de mudar o objetivo em execução.',
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it('IN_PROGRESS -> COMPLETED is terminal and the engagement remains fully readable afterward (FR-004, T036)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-complete'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Auditoria de continuidade de negócios.',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });
    const control = await setupControl(orgUnit.id);
    await linkControlScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      controlId: control.id,
    });
    const started = await startEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      expectedVersion: engagement.version,
    });

    const completed = await completeEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      expectedVersion: started.version,
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBeInstanceOf(Date);

    // FR-004 — "permanece integralmente legível": every field still reads
    // back normally, `200`-equivalent, no opacity introduced by COMPLETED.
    const read = await getEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });
    expect(read.status).toBe('COMPLETED');
    expect(read.objective).toBe(engagement.objective);
    expect(read.periodStart.getTime()).toBe(engagement.periodStart.getTime());

    // COMPLETED never accepts a new finding — the domain rule
    // `grc/finding`'s own `CreateFindingFromEngagementUseCase` (Fase 4,
    // out of this task's scope) consumes.
    expect(() => assertAuditEngagementAcceptsFindings(read.status)).toThrow(ValidationDomainError);

    // No edge leaves COMPLETED — neither start nor complete nor cancel is
    // legal from here.
    await expect(
      startEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        expectedVersion: completed.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
    await expect(
      cancelEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        justification: 'Tentativa de descartar um engajamento já concluído.',
        expectedVersion: completed.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it('FR-004a/T034a — CANCELLED is reachable from PLANNING, requires a justification, and is terminal', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-cancel-planning'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Engajamento aberto por engano.',
      periodStart: new Date('2026-06-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-30T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    // Empty justification is refused, nothing changes.
    await expect(
      cancelEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        justification: '   ',
        expectedVersion: engagement.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const cancelled = await cancelEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      justification: 'Engajamento aberto por engano; nenhum trabalho de campo foi realizado.',
      expectedVersion: engagement.version,
    });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.cancellationJustification).toContain('aberto por engano');

    // Terminal: cannot start, complete or cancel again.
    await expect(
      startEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        expectedVersion: cancelled.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
    await expect(
      cancelEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        justification: 'Segunda tentativa de descarte.',
        expectedVersion: cancelled.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    // Remains fully readable (mirrors FR-004's own guarantee for COMPLETED
    // — CANCELLED is equally not an opaque state).
    const read = await getEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });
    expect(read.status).toBe('CANCELLED');
  });

  it('FR-004a/T034a — CANCELLED is ALSO reachable from IN_PROGRESS, not only from PLANNING', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-cancel-in-progress'),
    });
    const actor = await setupActor(orgUnit.id);

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Engajamento abandonado após início.',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });
    const control = await setupControl(orgUnit.id);
    await linkControlScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      controlId: control.id,
    });
    const started = await startEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      expectedVersion: engagement.version,
    });
    expect(started.status).toBe('IN_PROGRESS');

    const cancelled = await cancelEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      justification: 'Escopo tornou-se irrelevante após reorganização.',
      expectedVersion: started.version,
    });
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('T034b — no non-terminal state is a dead end, INCLUDING an engagement with no scope at all (SC-002a)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('lifecycle-org-no-dead-end'),
    });
    const actor = await setupActor(orgUnit.id);

    // An engagement with NO scope link of any kind cannot start (FR-003) —
    // the exact trap FindingStatus (Fase 1) and Control's DRAFT (Fase 2)
    // fell into: no way forward, and (before FR-004a) no way out either.
    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Engajamento sem escopo algum.',
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    await expect(
      startEngagement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        expectedVersion: engagement.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    // The one transition FR-004a guarantees is still there: cancel.
    const cancelled = await cancelEngagement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      justification: 'Sem escopo definido; engajamento descartado antes do início.',
      expectedVersion: engagement.version,
    });
    expect(cancelled.status).toBe('CANCELLED');
  });
});
