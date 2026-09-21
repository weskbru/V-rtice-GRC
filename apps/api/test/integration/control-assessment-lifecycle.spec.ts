/**
 * T035/003-controls-management, User Story 2 — end-to-end coverage
 * against the real database for the assessment/attestation lifecycle:
 * immutability, effectiveness before/after (D-2, FR-020), the two
 * independent segregation-of-duties invariants (C1/C2, FR-017/FR-018,
 * both audited on refusal per FR-019), and D-8's "at most one attestation
 * lifecycle, ever".
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateControlAssessmentUseCase } from '../../src/modules/controls/application/assessments/create-control-assessment.usecase';
import { DecideControlAssessmentAttestationUseCase } from '../../src/modules/controls/application/assessments/decide-control-assessment-attestation.usecase';
import { GetControlAssessmentUseCase } from '../../src/modules/controls/application/assessments/get-control-assessment.usecase';
import { RequestControlAssessmentAttestationUseCase } from '../../src/modules/controls/application/assessments/request-control-assessment-attestation.usecase';
import { ControlAssessmentModule } from '../../src/modules/controls/control-assessment.module';
import { calculateControlEffectiveness } from '../../src/modules/controls/domain/control-effectiveness.service';
import { ConflictDomainError, ValidationDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { ControlAssessmentResult, User } from '@prisma/client';

describe('Control assessment/attestation lifecycle (T035, FR-016-FR-020, D-2, D-3, D-8)', () => {
  let ctx: IntegrationTestContext;
  let createUseCase: CreateControlAssessmentUseCase;
  let getUseCase: GetControlAssessmentUseCase;
  let requestAttestationUseCase: RequestControlAssessmentAttestationUseCase;
  let decideAttestationUseCase: DecideControlAssessmentAttestationUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ControlAssessmentModule],
    });
    createUseCase = ctx.app.get(CreateControlAssessmentUseCase);
    getUseCase = ctx.app.get(GetControlAssessmentUseCase);
    requestAttestationUseCase = ctx.app.get(RequestControlAssessmentAttestationUseCase);
    decideAttestationUseCase = ctx.app.get(DecideControlAssessmentAttestationUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A single actor holding both `control:test` and `control:approve` —
   * used only as a NEUTRAL third party in the tests below, never as the
   * assessor/owner under test in a segregation assertion. */
  async function setupThirdPartyActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-third')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['control:test', 'control:approve', 'control:view'],
      { name: `fixture-control-assess-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupControl(orgUnitId: string, ownerUserId: string | null): Promise<string> {
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-assess'),
        name: 'Controle de acesso lógico',
        orgUnitId,
        ownerUserId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    return control.id;
  }

  async function recordAssessment(
    actorUserId: string,
    controlId: string,
    result: ControlAssessmentResult,
    assessedOn = '2026-06-01',
  ) {
    return createUseCase.execute({
      actorUserId,
      controlId,
      assessedOn: new Date(`${assessedOn}T00:00:00.000Z`),
      result,
      conclusion: 'Teste de efetividade conduzido conforme roteiro.',
    });
  }

  it('record -> not attest -> effectiveness unchanged (still NOT_ASSESSED); attest -> effectiveness changes to the attested result', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-org'),
    });
    const actor = await setupThirdPartyActor(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-owner')}@example.test`,
    });
    const controlId = await setupControl(orgUnit.id, owner.id);

    const assessment = await recordAssessment(actor.id, controlId, 'EFFECTIVE');

    // Recorded, but NOT attested: effectiveness is still NOT_ASSESSED
    // (FR-016 — registering is not declaring).
    const rows = await ctx.prisma.client.controlAssessment.findMany({ where: { controlId } });
    const effectivenessBeforeAttestation = calculateControlEffectiveness(
      rows.map((row) => ({
        assessedOn: row.assessedOn,
        createdAt: row.createdAt,
        result: row.result,
        attestedAt: row.attestedAt,
      })),
      null,
      new Date('2026-06-15T00:00:00.000Z'),
    );
    expect(effectivenessBeforeAttestation).toBe('NOT_ASSESSED');

    // A SECOND, DIFFERENT actor requests and decides attestation (a
    // neutral third party — never the assessor).
    const approver = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-approver')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const approverRole = await createRoleWithPermissionsFixture(ctx.prisma, ['control:approve'], {
      name: `fixture-control-approver-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: approver, role: approverRole });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId: orgUnit.id });

    await requestAttestationUseCase.execute({
      actorUserId: actor.id,
      controlId,
      assessmentId: assessment.id,
    });

    const decided = await decideAttestationUseCase.execute({
      actorUserId: approver.id,
      controlId,
      assessmentId: assessment.id,
      decision: 'APPROVED',
    });
    expect(decided.status).toBe('APPROVED');

    const attestedRow = await ctx.prisma.client.controlAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
    });
    expect(attestedRow.attestedAt).not.toBeNull();
    expect(attestedRow.attestedByUserId).toBe(approver.id);

    const rowsAfter = await ctx.prisma.client.controlAssessment.findMany({ where: { controlId } });
    const effectivenessAfterAttestation = calculateControlEffectiveness(
      rowsAfter.map((row) => ({
        assessedOn: row.assessedOn,
        createdAt: row.createdAt,
        result: row.result,
        attestedAt: row.attestedAt,
      })),
      null,
      new Date('2026-06-15T00:00:00.000Z'),
    );
    expect(effectivenessAfterAttestation).toBe('EFFECTIVE');

    // FR-020 — the change is audited with previous and new value.
    const effectivenessAudit = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: assessment.id,
        action: 'control.effectiveness.changed',
      },
    });
    expect(effectivenessAudit).not.toBeNull();
    expect(effectivenessAudit!.newValues).toMatchObject({
      previousEffectiveness: 'NOT_ASSESSED',
      newEffectiveness: 'EFFECTIVE',
    });
  });

  it('a second assessment leaves the first intact and attributable (FR-010, SC-003)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-immut-org'),
    });
    const actor = await setupThirdPartyActor(orgUnit.id);
    const controlId = await setupControl(orgUnit.id, actor.id);

    const first = await recordAssessment(actor.id, controlId, 'INEFFECTIVE', '2026-01-01');
    const second = await recordAssessment(actor.id, controlId, 'EFFECTIVE', '2026-06-01');

    const firstReRead = await getUseCase.execute({
      actorUserId: actor.id,
      controlId,
      assessmentId: first.id,
    });
    expect(firstReRead.result).toBe('INEFFECTIVE');
    expect(firstReRead.conclusion).toBe(first.conclusion);

    const secondReRead = await getUseCase.execute({
      actorUserId: actor.id,
      controlId,
      assessmentId: second.id,
    });
    expect(secondReRead.result).toBe('EFFECTIVE');

    const total = await ctx.prisma.client.controlAssessment.count({ where: { controlId } });
    expect(total).toBe(2);
  });

  it('C1 — the assessor cannot attest their own assessment: refused (422) and audited naming ASSESSOR', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-c1-org'),
    });
    const assessorActor = await setupThirdPartyActor(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-c1-owner')}@example.test`,
    });
    const controlId = await setupControl(orgUnit.id, owner.id);

    const assessment = await recordAssessment(assessorActor.id, controlId, 'EFFECTIVE');
    await requestAttestationUseCase.execute({
      actorUserId: assessorActor.id,
      controlId,
      assessmentId: assessment.id,
    });

    await expect(
      decideAttestationUseCase.execute({
        actorUserId: assessorActor.id,
        controlId,
        assessmentId: assessment.id,
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(ValidationDomainError);

    const refusalAudit = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: assessment.id,
        action: 'control.attestation.refused',
      },
    });
    expect(refusalAudit).not.toBeNull();
    expect(refusalAudit!.newValues).toMatchObject({ violatedRules: ['ASSESSOR'] });

    // Left PENDING — never attested.
    const row = await ctx.prisma.client.controlAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
    });
    expect(row.attestedAt).toBeNull();
  });

  it("C2 — the control's owner cannot attest, even a different person's assessment: refused and audited naming OWNER", async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-c2-org'),
    });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-c2-owner')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const ownerRole = await createRoleWithPermissionsFixture(ctx.prisma, ['control:approve'], {
      name: `fixture-control-owner-approve-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: owner, role: ownerRole });
    await grantUnitScopeFixture(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const assessorActor = await setupThirdPartyActor(orgUnit.id);
    const controlId = await setupControl(orgUnit.id, owner.id);

    const assessment = await recordAssessment(assessorActor.id, controlId, 'EFFECTIVE');
    await requestAttestationUseCase.execute({
      actorUserId: assessorActor.id,
      controlId,
      assessmentId: assessment.id,
    });

    await expect(
      decideAttestationUseCase.execute({
        actorUserId: owner.id,
        controlId,
        assessmentId: assessment.id,
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(ValidationDomainError);

    const refusalAudit = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: assessment.id,
        action: 'control.attestation.refused',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(refusalAudit).not.toBeNull();
    expect(refusalAudit!.newValues).toMatchObject({ violatedRules: ['OWNER'] });
  });

  it('C1 AND C2 together — the assessor who is also the owner: refused naming BOTH rules in the SAME audit event', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-both-org'),
    });
    const assessorOwner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-both')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['control:test', 'control:approve'],
      { name: `fixture-control-both-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: assessorOwner, role });
    await grantUnitScopeFixture(ctx.prisma, { user: assessorOwner, orgUnitId: orgUnit.id });

    const controlId = await setupControl(orgUnit.id, assessorOwner.id);
    const assessment = await recordAssessment(assessorOwner.id, controlId, 'EFFECTIVE');
    await requestAttestationUseCase.execute({
      actorUserId: assessorOwner.id,
      controlId,
      assessmentId: assessment.id,
    });

    await expect(
      decideAttestationUseCase.execute({
        actorUserId: assessorOwner.id,
        controlId,
        assessmentId: assessment.id,
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(ValidationDomainError);

    const refusalAudit = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: assessment.id,
        action: 'control.attestation.refused',
      },
    });
    expect(refusalAudit).not.toBeNull();
    const violated = (refusalAudit!.newValues as { violatedRules: string[] }).violatedRules;
    expect(new Set(violated)).toEqual(new Set(['ASSESSOR', 'OWNER']));
  });

  it('D-8 — requesting attestation a second time is refused, including after a decision', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-assess-d8-org'),
    });
    const actor = await setupThirdPartyActor(orgUnit.id);
    const controlId = await setupControl(orgUnit.id, null);
    const assessment = await recordAssessment(actor.id, controlId, 'EFFECTIVE');

    await requestAttestationUseCase.execute({
      actorUserId: actor.id,
      controlId,
      assessmentId: assessment.id,
    });

    // Second request while PENDING — refused.
    await expect(
      requestAttestationUseCase.execute({
        actorUserId: actor.id,
        controlId,
        assessmentId: assessment.id,
      }),
    ).rejects.toThrow(ConflictDomainError);

    // Decide it (no owner set, so no C2; a third party decides to avoid C1).
    const approver = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-assess-d8-approver')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const approverRole = await createRoleWithPermissionsFixture(ctx.prisma, ['control:approve'], {
      name: `fixture-control-d8-approver-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: approver, role: approverRole });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId: orgUnit.id });

    await decideAttestationUseCase.execute({
      actorUserId: approver.id,
      controlId,
      assessmentId: assessment.id,
      decision: 'REJECTED',
      justification: 'Evidência insuficiente.',
    });

    // Requesting AGAIN after a decision is refused too (D-8: "inclusive
    // depois de uma decisão de recusa").
    await expect(
      requestAttestationUseCase.execute({
        actorUserId: actor.id,
        controlId,
        assessmentId: assessment.id,
      }),
    ).rejects.toThrow(ConflictDomainError);
  });
});
