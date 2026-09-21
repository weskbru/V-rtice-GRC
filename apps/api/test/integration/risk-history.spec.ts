/**
 * T163/US7 — proves `RiskHistoryQueryService`/`GetRiskHistoryUseCase`
 * merge assessments, treatment decisions, lifecycle transitions, approvals
 * and ownership changes into ONE chronological, attributed timeline, with
 * the EXACT ordering a real interleaved sequence of all five produces —
 * not merely that all five appear somewhere in the result.
 *
 * Also proves stable pagination across a page boundary with a genuine
 * timestamp tie (this task's explicit pagination-stability requirement):
 * two entries sharing the exact same `occurredAt` must never be dropped or
 * duplicated across pages, because the `(occurredAt DESC, id DESC)` sort
 * key is deterministic.
 */
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

  /** `AuditRecorder` reads `actorUserId` from `RequestContextStore`
   * (populated in production by `RequestContextMiddleware` before any
   * guard/controller runs) — calling a use case directly, as this
   * integration suite does, bypasses that middleware, so `audit_event
   * .actorUserId` would otherwise be `null` for every recorded action.
   * Mirrors `audit-transactional.spec.ts`'s own established pattern for
   * exactly this reason. */
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
    // F-CV-2: both are pure preconditions (this test's subject is the
    // history MERGE ORDER, never ownerA/ownerB's own permissions).
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

    // Steps 1-11 all performed by `actor` — one `RequestContextStore`
    // scope so every `AuditRecorder.record(...)` call along the way sees
    // `actorUserId: actor.id` (see `runAs`'s own doc comment).
    const { created, requested, afterRequested } = await runAs(actor.id, async () => {
      // 1. Create the risk (DRAFT) — owned by ownerA. Risk creation itself
      // is NOT one of the five merged categories, so it produces no entry.
      const created = await createRiskUseCase.execute({
        actorUserId: actor.id,
        title: 'Risco para teste de histórico',
        description: 'Descrição completa do risco.',
        categoryId: category.id,
        orgUnitId: orgUnit.id,
        ownerUserId: ownerA.id,
      });

      // 2. ASSESSMENT #1.
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

      // 3. TRANSITION DRAFT -> IDENTIFIED.
      const { risk: afterIdentified } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessment1.version,
        toStatus: 'IDENTIFIED',
      });

      // 4. TRANSITION IDENTIFIED -> ASSESSED.
      const { risk: afterAssessed1 } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterIdentified.version,
        toStatus: 'ASSESSED',
      });

      // 5. TREATMENT_DECISION.
      const { risk: afterTreatmentDecision } = await recordTreatmentUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessed1.version,
        strategy: 'MITIGATE',
        description: 'Mitigar por meio de controles adicionais.',
      });

      // 6. TRANSITION ASSESSED -> UNDER_TREATMENT.
      const { risk: afterUnderTreatment } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterTreatmentDecision.version,
        toStatus: 'UNDER_TREATMENT',
      });

      // 7. OWNERSHIP_CHANGE (ownerA -> ownerB).
      const afterOwnershipChange = await updateRiskUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterUnderTreatment.version,
        ownerUserId: ownerB.id,
      });

      // 8. TRANSITION UNDER_TREATMENT -> UNDER_REVIEW.
      const { risk: afterUnderReview } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterOwnershipChange.version,
        toStatus: 'UNDER_REVIEW',
      });

      // 9. ASSESSMENT #2 (reassessed during review).
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

      // 10. TRANSITION UNDER_REVIEW -> ASSESSED (REASSESSED_DURING_REVIEW met).
      const { risk: afterAssessed2 } = await performTransitionUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessment2.version,
        toStatus: 'ASSESSED',
      });

      // 11. APPROVAL requested (ASSESSED -> ACCEPTED, gated).
      const { approval: requested, risk: afterRequested } = await requestApprovalUseCase.execute({
        actorUserId: actor.id,
        riskId: created.id,
        expectedVersion: afterAssessed2.version,
        toStatus: 'ACCEPTED',
      });

      return { created, requested, afterRequested };
    });

    // 12. APPROVAL decided (APPROVED), by `approver` — writes BOTH an
    // APPROVAL decision entry and a TRANSITION entry (ASSESSED -> ACCEPTED,
    // approval-linked). Own `RequestContextStore` scope: a DIFFERENT actor.
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

    // The EXACT type sequence, newest first — proving real chronological
    // merge order across all five categories, not just that each appears.
    const expectedTypeSequence: readonly RiskHistoryEntryType[] = [
      'LIFECYCLE_TRANSITION', // 12b: ASSESSED -> ACCEPTED (approval-triggered)
      'APPROVAL', // 12a: decided (APPROVED)
      'APPROVAL', // 11: requested
      'LIFECYCLE_TRANSITION', // 10: UNDER_REVIEW -> ASSESSED
      'ASSESSMENT', // 9: assessment #2
      'LIFECYCLE_TRANSITION', // 8: UNDER_TREATMENT -> UNDER_REVIEW
      'OWNERSHIP_CHANGE', // 7: ownerA -> ownerB
      'LIFECYCLE_TRANSITION', // 6: ASSESSED -> UNDER_TREATMENT
      'TREATMENT_DECISION', // 5: MITIGATE
      'LIFECYCLE_TRANSITION', // 4: IDENTIFIED -> ASSESSED
      'LIFECYCLE_TRANSITION', // 3: DRAFT -> IDENTIFIED
      'ASSESSMENT', // 2: assessment #1
    ];
    expect(page.items.map((item) => item.type)).toEqual(expectedTypeSequence);

    // Spot-check attribution and content on a few entries, not just type.
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

    // F-9: the two ASSESSMENT entries carry the ASSERTED `assessedOn`
    // separately from the RECORDED `occurredAt` — never flattened into one.
    const assessmentEntries = page.items.filter((item) => item.type === 'ASSESSMENT');
    expect(assessmentEntries).toHaveLength(2);
    for (const entry of assessmentEntries) {
      expect(entry.assessedOn).not.toBeNull();
      expect(entry.occurredAt.getTime()).toBeGreaterThan(0);
    }
    // Every non-assessment entry leaves `assessedOn` null — the visibility
    // is exclusive to assessments, never ambiguous for other kinds.
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

    // Three `RiskLifecycleTransition` rows inserted directly (bypassing the
    // use case — this test is about the QUERY layer's tiebreak, not the
    // lifecycle state machine) sharing the EXACT SAME `performedAt`, with
    // deliberately chosen ids so their lexicographic order is known: id
    // "...003" > "...002" > "...001".
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

    // Deterministic tiebreak: `id DESC` alongside `occurredAt DESC` — the
    // three tied rows come back in strict id-descending order, split
    // exactly at the page boundary.
    expect(firstPage.items.map((item) => item.referenceId)).toEqual([ids[2], ids[1]]);
    expect(secondPage.items.map((item) => item.referenceId)).toEqual([ids[0]]);

    // No duplicate, no dropped row across the two pages.
    const allIds = [...firstPage.items, ...secondPage.items].map((item) => item.referenceId);
    expect(new Set(allIds).size).toBe(3);
    expect(allIds.sort()).toEqual([...ids].sort());
  });
});
