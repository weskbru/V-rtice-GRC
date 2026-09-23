import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { DecideApprovalUseCase } from '../../src/modules/risk/application/approvals/decide-approval.usecase';
import { RequestApprovalUseCase } from '../../src/modules/risk/application/approvals/request-approval.usecase';
import { CreateAssessmentUseCase } from '../../src/modules/risk/application/create-assessment.usecase';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { PerformTransitionUseCase } from '../../src/modules/risk/application/perform-transition.usecase';
import { RiskRepositoryPort } from '../../src/modules/risk/domain/ports/risk-repository.port';
import { RiskModule } from '../../src/modules/risk/risk.module';
import { globalScope } from '../../src/shared/persistence/scope-filter';

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

import type { User } from '@prisma/client';

describe('Risk approval decisions (T150, FR-029, FR-029a, FR-029b, FR-029c)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createAssessmentUseCase: CreateAssessmentUseCase;
  let performTransitionUseCase: PerformTransitionUseCase;
  let requestApprovalUseCase: RequestApprovalUseCase;
  let decideApprovalUseCase: DecideApprovalUseCase;
  let riskRepository: RiskRepositoryPort;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createAssessmentUseCase = ctx.app.get(CreateAssessmentUseCase);
    performTransitionUseCase = ctx.app.get(PerformTransitionUseCase);
    requestApprovalUseCase = ctx.app.get(RequestApprovalUseCase);
    decideApprovalUseCase = ctx.app.get(DecideApprovalUseCase);
    riskRepository = ctx.app.get(RiskRepositoryPort);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function buildAssessedRisk(): Promise<{
    riskId: string;
    version: number;
    requester: User;
    requesterId: string;
    orgUnitId: string;
  }> {
    const marker = uniqueTestMarker('risk-approval');
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: `${marker}-org` });
    const requester = await createUserFixture(ctx.prisma, {
      email: `${marker}-requester@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const requesterRole = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:edit', 'risk:assess', 'risk:transition'],
      { name: `fixture-${marker}-requester-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: requester, role: requesterRole });
    await grantUnitScopeFixture(ctx.prisma, { user: requester, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, { email: `${marker}-owner@example.test` });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });
    const category = await ctx.prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: `${marker}-category`,
        name: 'Categoria de teste',
        description: 'Fixture category.',
        sortOrder: 1,
        isActive: true,
      },
    });

    await createMethodologyVersionFixture(ctx.prisma, requester.id);

    const risk = await createRiskUseCase.execute({
      actorUserId: requester.id,
      title: 'Risco para decisão de aprovação',
      description: 'Descrição completa.',
      categoryId: category.id,
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { risk: riskWithAssessment } = await createAssessmentUseCase.execute({
      actorUserId: requester.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      inherentProbability: 4,
      inherentImpact: 4,
      residualProbability: 2,
      residualImpact: 2,
      rationale: 'Avaliação inicial.',
    });

    const { risk: identified } = await performTransitionUseCase.execute({
      actorUserId: requester.id,
      riskId: risk.id,
      expectedVersion: riskWithAssessment.version,
      toStatus: 'IDENTIFIED',
    });

    const { risk: assessed } = await performTransitionUseCase.execute({
      actorUserId: requester.id,
      riskId: risk.id,
      expectedVersion: identified.version,
      toStatus: 'ASSESSED',
    });

    expect(assessed.status).toBe('ASSESSED');

    return {
      riskId: risk.id,
      version: assessed.version,
      requester,
      requesterId: requester.id,
      orgUnitId: orgUnit.id,
    };
  }

  async function createApprover(orgUnitId: string, marker: string) {
    const approver = await createUserFixture(ctx.prisma, {
      email: `${marker}-approver@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const approverRole = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:view', 'risk:approve'],
      { name: `fixture-${marker}-approver-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: approver, role: approverRole });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId });
    return approver;
  }

  it('REJECTED clears the pending condition, records the decision, and leaves the risk status unchanged', async () => {
    const { riskId, version, requesterId, orgUnitId } = await buildAssessedRisk();
    const approver = await createApprover(orgUnitId, uniqueTestMarker('risk-approval-reject'));

    const { approval: requested, risk: withPending } = await requestApprovalUseCase.execute({
      actorUserId: requesterId,
      riskId,
      expectedVersion: version,
      toStatus: 'ACCEPTED',
    });

    expect(requested.status).toBe('PENDING');
    expect(withPending.status).toBe('ASSESSED');
    expect(withPending.pendingApprovalId).toBe(requested.id);

    const { approval: decided, risk: afterRejection } = await decideApprovalUseCase.execute({
      actorUserId: approver.id,
      riskId,
      approvalId: requested.id,
      expectedVersion: withPending.version,
      decision: 'REJECTED',
      justification: 'Faltam evidências para aceitar o risco.',
    });

    expect(decided.status).toBe('REJECTED');
    expect(decided.decidedBy).not.toBeNull();
    expect(decided.decidedBy!.id).toBe(approver.id);
    expect(decided.justification).toBe('Faltam evidências para aceitar o risco.');

    expect(afterRejection.status).toBe('ASSESSED');
    expect(afterRejection.pendingApprovalId).toBeUndefined();

    const persisted = await riskRepository.findById(globalScope(), riskId);
    expect(persisted!.status).toBe('ASSESSED');
    expect(persisted!.pendingApprovalId).toBeUndefined();

    const transitionRows = await ctx.prisma.client.riskLifecycleTransition.findMany({
      where: { riskId },
    });
    expect(transitionRows).toHaveLength(2);
    expect(transitionRows.every((row) => row.approvalId === null)).toBe(true);

    const auditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: 'APPROVAL', entityId: decided.id },
    });
    expect(auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining(['risk.approval_requested', 'risk.approval_rejected']),
    );
    expect(auditEvents.some((event) => event.action === 'risk.approval_approved')).toBe(false);
  });

  it('APPROVED applies the gated transition and writes a linked RiskLifecycleTransition row', async () => {
    const { riskId, version, requesterId, orgUnitId } = await buildAssessedRisk();
    const approver = await createApprover(orgUnitId, uniqueTestMarker('risk-approval-approve'));

    const { approval: requested, risk: withPending } = await requestApprovalUseCase.execute({
      actorUserId: requesterId,
      riskId,
      expectedVersion: version,
      toStatus: 'ACCEPTED',
    });

    const { approval: decided, risk: afterApproval } = await decideApprovalUseCase.execute({
      actorUserId: approver.id,
      riskId,
      approvalId: requested.id,
      expectedVersion: withPending.version,
      decision: 'APPROVED',
    });

    expect(decided.status).toBe('APPROVED');
    expect(decided.decidedBy!.id).toBe(approver.id);
    expect(afterApproval.status).toBe('ACCEPTED');
    expect(afterApproval.pendingApprovalId).toBeUndefined();

    const transitionRows = await ctx.prisma.client.riskLifecycleTransition.findMany({
      where: { riskId },
    });
    expect(transitionRows).toHaveLength(3);
    const gatedTransition = transitionRows.find((row) => row.approvalId !== null);
    expect(gatedTransition).toBeDefined();
    expect(gatedTransition!.fromStatus).toBe('ASSESSED');
    expect(gatedTransition!.toStatus).toBe('ACCEPTED');
    expect(gatedTransition!.approvalId).toBe(decided.id);
    expect(gatedTransition!.performedByUserId).toBe(approver.id);
  });

  it('a second decision on an already-decided approval is refused (application layer, mirroring the DB trigger below)', async () => {
    const { riskId, version, requesterId, orgUnitId } = await buildAssessedRisk();
    const approver = await createApprover(orgUnitId, uniqueTestMarker('risk-approval-twice'));

    const { approval: requested, risk: withPending } = await requestApprovalUseCase.execute({
      actorUserId: requesterId,
      riskId,
      expectedVersion: version,
      toStatus: 'ACCEPTED',
    });

    const { risk: afterFirstDecision } = await decideApprovalUseCase.execute({
      actorUserId: approver.id,
      riskId,
      approvalId: requested.id,
      expectedVersion: withPending.version,
      decision: 'REJECTED',
    });

    await expect(
      decideApprovalUseCase.execute({
        actorUserId: approver.id,
        riskId,
        approvalId: requested.id,
        expectedVersion: afterFirstDecision.version,
        decision: 'APPROVED',
      }),
    ).rejects.toThrow();
  });

  it('the requesting user cannot decide their own request, even holding risk:approve (application layer, FR-029a)', async () => {
    const { riskId, version, requester, requesterId, orgUnitId } = await buildAssessedRisk();

    const selfApproveRole = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:approve'], {
      name: `fixture-self-approve-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: requester, role: selfApproveRole });
    await grantUnitScopeFixture(ctx.prisma, { user: requester, orgUnitId });

    const { approval: requested, risk: withPending } = await requestApprovalUseCase.execute({
      actorUserId: requesterId,
      riskId,
      expectedVersion: version,
      toStatus: 'ACCEPTED',
    });

    await expect(
      decideApprovalUseCase.execute({
        actorUserId: requesterId,
        riskId,
        approvalId: requested.id,
        expectedVersion: withPending.version,
        decision: 'APPROVED',
      }),
    ).rejects.toThrow();

    const persisted = await riskRepository.findById(globalScope(), riskId);
    expect(persisted!.status).toBe('ASSESSED');
    expect(persisted!.pendingApprovalId).toBe(requested.id);
  });

  it('the database itself rejects a self-approval via the approvals_decided_by_requester_check CHECK constraint, independent of the application layer (FR-029a)', async () => {
    const marker = uniqueTestMarker('risk-approval-db-check');
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: `${marker}-org` });
    const requester = await createUserFixture(ctx.prisma, {
      email: `${marker}-requester@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });

    const pendingApproval = await ctx.prisma.client.approval.create({
      data: {
        id: randomUUID(),
        entityType: 'RISK',
        entityId: randomUUID(),
        requestedTransition: 'ASSESSED->ACCEPTED',
        requestedByUserId: requester.id,
        requestedAt: new Date(),
      },
    });

    await expect(
      ctx.prisma.client.$executeRawUnsafe(
        `UPDATE approvals SET status = 'APPROVED', decided_by_user_id = $1::uuid, decided_at = now() WHERE id = $2::uuid`,
        requester.id,
        pendingApproval.id,
      ),
    ).rejects.toThrow(/approvals_decided_by_requester_check/);
  });
});
