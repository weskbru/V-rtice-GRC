import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';
import { DecideApprovalUseCase } from '../../src/modules/risk/application/approvals/decide-approval.usecase';
import { RequestApprovalUseCase } from '../../src/modules/risk/application/approvals/request-approval.usecase';
import { CreateAssessmentUseCase } from '../../src/modules/risk/application/create-assessment.usecase';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { GetRiskHistoryUseCase } from '../../src/modules/risk/application/get-risk-history.usecase';
import { PerformTransitionUseCase } from '../../src/modules/risk/application/perform-transition.usecase';
import { RecordTreatmentUseCase } from '../../src/modules/risk/application/record-treatment.usecase';
import { UpdateRiskUseCase } from '../../src/modules/risk/application/update-risk.usecase';
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

import type { RiskHistoryEntryType } from '../../src/modules/risk/domain/ports/risk-history-query.port';
import type { User } from '@prisma/client';

describe('Risk History (T163, US7, FR-105, ADR-006)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createAssessmentUseCase: CreateAssessmentUseCase;
  let performTransitionUseCase: PerformTransitionUseCase;
  let recordTreatmentUseCase: RecordTreatmentUseCase;
  let updateRiskUseCase: UpdateRiskUseCase;
  let requestApprovalUseCase: RequestApprovalUseCase;
  let decideApprovalUseCase: DecideApprovalUseCase;
  let getRiskHistoryUseCase: GetRiskHistoryUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createAssessmentUseCase = ctx.app.get(CreateAssessmentUseCase);
    performTransitionUseCase = ctx.app.get(PerformTransitionUseCase);
    recordTreatmentUseCase = ctx.app.get(RecordTreatmentUseCase);
    updateRiskUseCase = ctx.app.get(UpdateRiskUseCase);
    requestApprovalUseCase = ctx.app.get(RequestApprovalUseCase);
    decideApprovalUseCase = ctx.app.get(DecideApprovalUseCase);
    getRiskHistoryUseCase = ctx.app.get(GetRiskHistoryUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  function runAs<T>(actorUserId: string, callback: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      {
        correlationId: randomUUID(),
        ipAddress: '203.0.113.10',
        userAgent: 'vitest-integration',
        method: 'POST',
        path: '/test/risk-history',
        actorUserId,
      },
      callback,
    );
  }

  async function buildActor(orgUnitId: string, marker: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${marker}-actor@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:view', 'risk:edit', 'risk:assess', 'risk:treat', 'risk:transition'],
      { name: `fixture-${marker}-actor-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  it('merges assessments, treatment decisions, lifecycle transitions, approvals and ownership changes in EXACT chronological order (newest first)', async () => {
    const marker = uniqueTestMarker('risk-history');
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: `${marker}-org` });
    const actor = await buildActor(orgUnit.id, marker);
    const approver = await createUserFixture(ctx.prisma, {
      email: `${marker}-approver@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const approverRole = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:approve'], {
      name: `fixture-${marker}-approver-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: approver, role: approverRole });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId: orgUnit.id });

    const ownerA = await createUserFixture(ctx.prisma, { email: `${marker}-ownerA@example.test` });
    const ownerB = await createUserFixture(ctx.prisma, { email: `${marker}-ownerB@example.test` });
    await makeRiskAssignmentVisible(ctx.prisma, { user: ownerA, orgUnitId: orgUnit.id });
    await makeRiskAssignmentVisible(ctx.prisma, { user: ownerB, orgUnitId: orgUnit.id });
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
    await createMethodologyVersionFixture(ctx.prisma, actor.id);

    const { created, requested, afterRequested } = await runAs(actor.id, async () => {
      const created = await createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Risco para teste de histórico',
        description: 'Descrição completa do risco.',
        categoryId: category.id,
        orgUnitId: orgUnit.id,
        ownerUserId: ownerA.id,
      });

      const { risk: afterAssessment1 } = await createAssessmentUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: created.version,
        inherentProbability: 4,
        inherentImpact: 4,
        residualProbability: 3,
        residualImpact: 3,
        rationale: 'Primeira avaliação.',
      });

      const { risk: afterIdentified } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessment1.version,
        toStatus: 'IDENTIFIED',
      });

      const { risk: afterAssessed1 } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterIdentified.version,
        toStatus: 'ASSESSED',
      });

      const { risk: afterTreatmentDecision } = await recordTreatmentUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessed1.version,
        strategy: 'MITIGATE',
        description: 'Mitigar por meio de controles adicionais.',
      });

      const { risk: afterUnderTreatment } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterTreatmentDecision.version,
        toStatus: 'UNDER_TREATMENT',
      });

      const afterOwnershipChange = await updateRiskUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterUnderTreatment.version,
        ownerUserId: ownerB.id,
      });

      const { risk: afterUnderReview } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterOwnershipChange.version,
        toStatus: 'UNDER_REVIEW',
      });

      const { risk: afterAssessment2 } = await createAssessmentUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterUnderReview.version,
        inherentProbability: 4,
        inherentImpact: 4,
        residualProbability: 2,
        residualImpact: 2,
        rationale: 'Reavaliação durante a revisão.',
      });

      const { risk: afterAssessed2 } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessment2.version,
        toStatus: 'ASSESSED',
      });

      const { approval: requested, risk: afterRequested } = await requestApprovalUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessed2.version,
        toStatus: 'ACCEPTED',
      });

      return { created, requested, afterRequested };
    });

    const { decided } = await runAs(approver.id, async () => {
      const { approval: decided } = await decideApprovalUseCase.execute({
        actorUserId: approver.id,
        riskId: created.id,
        approvalId: requested.id,
        expectedVersion: afterRequested.version,
        decision: 'APPROVED',
      });
      return { decided };
    });

    const page = await getRiskHistoryUseCase.execute({
      actorUserId: actor.id,
      riskId: created.id,
      page: 1,
      pageSize: 50,
    });

    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(12);

    const expectedTypeSequence: readonly RiskHistoryEntryType[] = [
      'LIFECYCLE_TRANSITION',
      'APPROVAL',
      'APPROVAL',
      'LIFECYCLE_TRANSITION',
      'ASSESSMENT',
      'LIFECYCLE_TRANSITION',
      'OWNERSHIP_CHANGE',
      'LIFECYCLE_TRANSITION',
      'TREATMENT_DECISION',
      'LIFECYCLE_TRANSITION',
      'LIFECYCLE_TRANSITION',
      'ASSESSMENT',
    ];
    expect(page.items.map((item) => item.type)).toEqual(expectedTypeSequence);

    const ownershipEntry = page.items[6]!;
    expect(ownershipEntry.type).toBe('OWNERSHIP_CHANGE');
    expect(ownershipEntry.previousValue).toBe(ownerA.fullName);
    expect(ownershipEntry.newValue).toBe(ownerB.fullName);
    expect(ownershipEntry.referenceId).toBeNull();

    const decisionEntry = page.items[8]!;
    expect(decisionEntry.type).toBe('TREATMENT_DECISION');
    expect(decisionEntry.actor.id).toBe(actor.id);
    expect(decisionEntry.newValue).toBe('Mitigar');

    const approvalDecidedEntry = page.items[1]!;
    expect(approvalDecidedEntry.type).toBe('APPROVAL');
    expect(approvalDecidedEntry.referenceId).toBe(decided.id);
    expect(approvalDecidedEntry.actor.id).toBe(approver.id);
    expect(approvalDecidedEntry.newValue).toBe('Aprovada');

    const assessmentEntries = page.items.filter((item) => item.type === 'ASSESSMENT');
    expect(assessmentEntries).toHaveLength(2);
    for (const entry of assessmentEntries) {
      expect(entry.assessedOn).not.toBeNull();
      expect(entry.occurredAt.getTime()).toBeGreaterThan(0);
    }
    for (const entry of page.items) {
      if (entry.type !== 'ASSESSMENT') {
        expect(entry.assessedOn).toBeNull();
      }
    }
  });

  it('stable ordering survives pagination across a page boundary with tied timestamps (no duplicate, no dropped row)', async () => {
    const marker = uniqueTestMarker('risk-history-tie');
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: `${marker}-org` });
    const actor = await buildActor(orgUnit.id, marker);
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

    const created = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para teste de paginação estável',
      description: 'Descrição completa do risco.',
      categoryId: category.id,
      orgUnitId: orgUnit.id,
      ownerUserId: actor.id,
    });

    const tiedAt = new Date('2026-01-01T00:00:00.000Z');
    const ids = [
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000002',
      '00000000-0000-7000-8000-000000000003',
    ];
    for (const id of ids) {
      await ctx.prisma.client.riskLifecycleTransition.create({
        data: {
          id,
          riskId: created.id,
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          performedByUserId: actor.id,
          performedAt: tiedAt,
          justification: `tie fixture ${id}`,
        },
      });
    }

    const firstPage = await getRiskHistoryUseCase.execute({
      actorUserId: actor.id,
      riskId: created.id,
      page: 1,
      pageSize: 2,
    });
    const secondPage = await getRiskHistoryUseCase.execute({
      actorUserId: actor.id,
      riskId: created.id,
      page: 2,
      pageSize: 2,
    });

    expect(firstPage.total).toBe(3);
    expect(secondPage.total).toBe(3);

    expect(firstPage.items.map((item) => item.referenceId)).toEqual([ids[2], ids[1]]);
    expect(secondPage.items.map((item) => item.referenceId)).toEqual([ids[0]]);

    const allIds = [...firstPage.items, ...secondPage.items].map((item) => item.referenceId);
    expect(new Set(allIds).size).toBe(3);
    expect(allIds.sort()).toEqual([...ids].sort());
  });
});
