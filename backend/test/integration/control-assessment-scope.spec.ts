import { randomUUID } from 'node:crypto';

import { describe, expect, it, afterAll, beforeAll } from 'vitest';

import { ControlAssessmentRepository } from '../../src/modules/controls/infrastructure/control-assessment.repository';

import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('ControlAssessmentRepository.listAssessmentIdsInScope — column, not join (007-implementation-remediation, D-11)', () => {
  let ctx: IntegrationTestContext;
  let repo: ControlAssessmentRepository;
  let unitAId: string;
  let unitBId: string;
  let assessorId: string;
  let controlId: string;
  let assessmentId: string;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule();
    repo = new ControlAssessmentRepository(ctx.prisma);

    const unitA = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker('ca-scope-a') });
    const unitB = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker('ca-scope-b') });
    unitAId = unitA.id;
    unitBId = unitB.id;

    const assessor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ca-scope-assessor')}@example.test`,
      primaryOrgUnitId: unitAId,
    });
    assessorId = assessor.id;

    controlId = randomUUID();
    await ctx.prisma.client.$executeRawUnsafe(
      `INSERT INTO controls (id, code, name, org_unit_id, is_active, status, version, created_at, updated_at)
       VALUES ($1::uuid, $2, 'Controle para prova de escopo por coluna', $3::uuid, true, 'DRAFT', 1, now(), now())`,
      controlId,
      uniqueTestMarker('ca-scope-ctrl'),
      unitAId,
    );

    const created = await repo.create({
      controlId,
      assessedOn: new Date(),
      assessorUserId: assessorId,
      result: 'EFFECTIVE',
      conclusion: 'Conclusão de teste.',
    });
    assessmentId = created.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it("a caller scoped to the control's unit (A) sees the assessment", async () => {
    const ids = await repo.listAssessmentIdsInScope({ kind: 'UNIT', unitIds: new Set([unitAId]) });
    expect(ids).toContain(assessmentId);
  });

  it('a caller scoped to a DIFFERENT unit (B) does not see it', async () => {
    const ids = await repo.listAssessmentIdsInScope({ kind: 'UNIT', unitIds: new Set([unitBId]) });
    expect(ids).not.toContain(assessmentId);
  });

  it('a GLOBAL-scoped caller sees it regardless of unit', async () => {
    const ids = await repo.listAssessmentIdsInScope({ kind: 'GLOBAL' });
    expect(ids).toContain(assessmentId);
  });

  it('THE decisive case: after the control moves from A to B, the SAME assessment flips scope with it — proving the column tracks the move rather than having been correct only by coincidence at creation time', async () => {
    const beforeA = await repo.listAssessmentIdsInScope({
      kind: 'UNIT',
      unitIds: new Set([unitAId]),
    });
    const beforeB = await repo.listAssessmentIdsInScope({
      kind: 'UNIT',
      unitIds: new Set([unitBId]),
    });
    expect(beforeA).toContain(assessmentId);
    expect(beforeB).not.toContain(assessmentId);

    await ctx.prisma.client.$executeRawUnsafe(
      `UPDATE controls SET org_unit_id = $2::uuid WHERE id = $1::uuid`,
      controlId,
      unitBId,
    );

    const afterA = await repo.listAssessmentIdsInScope({
      kind: 'UNIT',
      unitIds: new Set([unitAId]),
    });
    const afterB = await repo.listAssessmentIdsInScope({
      kind: 'UNIT',
      unitIds: new Set([unitBId]),
    });
    expect(
      afterA,
      "unit A's caller must lose visibility the moment the control leaves their scope — a stale column would still list this id here",
    ).not.toContain(assessmentId);
    expect(afterB, "unit B's caller must gain visibility now that the control is theirs").toContain(
      assessmentId,
    );
  });
});
