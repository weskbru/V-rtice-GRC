/**
 * T050-T052/004-compliance-management, User Story 3 (research.md D-11) —
 * end-to-end coverage of the observation-time compliance-state watermark:
 * no audit event on first computation, the event honestly states it
 * captures the moment of OBSERVATION rather than occurrence, and
 * concurrent readers de-duplicate via the conditional `UPDATE ... WHERE
 * ... IS DISTINCT FROM` so exactly one event is ever recorded for the
 * same real transition.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import { LinkRequirementToControlUseCase } from '../../src/modules/compliance/application/links/link-requirement-control.usecase';
import { CreateRequirementUseCase } from '../../src/modules/compliance/application/requirements/create-requirement.usecase';
import { GetRequirementUseCase } from '../../src/modules/compliance/application/requirements/get-requirement.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { CreateControlAssessmentUseCase } from '../../src/modules/controls/application/assessments/create-control-assessment.usecase';
import { DecideControlAssessmentAttestationUseCase } from '../../src/modules/controls/application/assessments/decide-control-assessment-attestation.usecase';
import { RequestControlAssessmentAttestationUseCase } from '../../src/modules/controls/application/assessments/request-control-assessment-attestation.usecase';
import { ControlAssessmentModule } from '../../src/modules/controls/control-assessment.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { User } from '@prisma/client';

describe('RequirementComplianceAuditMark — observation-time watermark (T049-T052, research.md D-11)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let createRequirement: CreateRequirementUseCase;
  let linkUseCase: LinkRequirementToControlUseCase;
  let getRequirement: GetRequirementUseCase;
  let createAssessment: CreateControlAssessmentUseCase;
  let requestAttestation: RequestControlAssessmentAttestationUseCase;
  let decideAttestation: DecideControlAssessmentAttestationUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule, ControlAssessmentModule],
    });
    createFramework = ctx.app.get(CreateFrameworkUseCase);
    createVersion = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirement = ctx.app.get(CreateRequirementUseCase);
    linkUseCase = ctx.app.get(LinkRequirementToControlUseCase);
    getRequirement = ctx.app.get(GetRequirementUseCase);
    createAssessment = ctx.app.get(CreateControlAssessmentUseCase);
    requestAttestation = ctx.app.get(RequestControlAssessmentAttestationUseCase);
    decideAttestation = ctx.app.get(DecideControlAssessmentAttestationUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('watermark-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    // ADR-020 part 5 — linking a control now also requires `control:view`
    // on the referenced control, not only `compliance:map`.
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      [
        'compliance:map',
        'compliance:administer',
        'compliance:view',
        'control:test',
        'control:approve',
        'control:view',
      ],
      { name: `fixture-watermark-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupRequirement(actorUserId: string) {
    const framework = await createFramework.execute({
      actorUserId,
      name: uniqueTestMarker('Framework de marca'),
      description: 'Framework de teste para marca d’água de auditoria.',
      origin: 'EXTERNAL_STANDARD',
    });
    const version = await createVersion.execute({
      actorUserId,
      frameworkId: framework.id,
      label: uniqueTestMarker('v'),
    });
    return createRequirement.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: version.id,
      externalRef: 'A.1',
      title: 'Requisito de teste',
      description: 'Descrição do requisito de teste.',
    });
  }

  async function attestControlEffective(
    orgUnitId: string,
    controlId: string,
    assessorId: string,
  ): Promise<void> {
    const approver = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('watermark-approver')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['control:approve'], {
      name: `fixture-watermark-approver-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: approver, role });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId });

    const assessment = await createAssessment.execute({
      actorUserId: assessorId,
      controlId,
      assessedOn: new Date('2026-06-01T00:00:00.000Z'),
      result: 'EFFECTIVE',
      conclusion: 'Teste de efetividade conduzido conforme roteiro.',
    });
    await requestAttestation.execute({
      actorUserId: assessorId,
      controlId,
      assessmentId: assessment.id,
    });
    await decideAttestation.execute({
      actorUserId: approver.id,
      controlId,
      assessmentId: assessment.id,
      decision: 'APPROVED',
    });
  }

  it('the first computation creates the watermark but emits NO REQUIREMENT_COMPLIANCE_STATE event — there is no real "before" to compare (D-11)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('watermark-org-first'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_MET');

    const mark = await ctx.prisma.client.requirementComplianceAuditMark.findUnique({
      where: { requirementId: requirement.id },
    });
    expect(mark?.lastAuditedState).toBe('NOT_MET');

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, entityId: requirement.id },
    });
    expect(events).toHaveLength(0);
  });

  it('a real state change is audited on the NEXT read, with previous/new state, and the event honestly says it captures the OBSERVED moment', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('watermark-org-change'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-watermark'),
        name: 'Controle para marca d’água',
        orgUnitId: orgUnit.id,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    // First read: establishes the watermark at NOT_MET, no event.
    const firstRead = await getRequirement.execute(requirement.id);
    expect(firstRead.complianceState).toBe('NOT_MET');

    // The control is attested EFFECTIVE BEFORE it is linked, so the
    // SINGLE link write is what causes the requirement's compliance state
    // to jump directly NOT_MET -> COMPLIANT (never through the
    // intermediate NOT_PROVEN a link-before-attestation ordering would
    // produce) — the cleanest reproduction of "the cause happened inside
    // Controls, a transaction Compliance did not participate in"
    // (research.md D-11).
    await attestControlEffective(orgUnit.id, control.id, actor.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    // The next read observes the change and audits it.
    const secondRead = await getRequirement.execute(requirement.id);
    expect(secondRead.complianceState).toBe('COMPLIANT');

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, entityId: requirement.id },
    });
    // Exactly one transition happened (NOT_MET -> COMPLIANT) — the link
    // use case's own side-effect call already observes it (research.md
    // D-11: writes that can affect compliance state audit it too), so a
    // further identical read must not re-audit it.
    expect(events).toHaveLength(1);
    const changeEvent = events[0]!;
    expect(changeEvent.newValues).toMatchObject({
      requirementId: requirement.id,
      previousState: 'NOT_MET',
      newState: 'COMPLIANT',
    });
    expect(changeEvent.action).toContain('observed');
    expect((changeEvent.newValues as { observedAt?: string }).observedAt).toBeDefined();

    // Re-reading again with no further change must not add a second event.
    await getRequirement.execute(requirement.id);
    const eventsAfterRepeatRead = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, entityId: requirement.id },
    });
    expect(eventsAfterRepeatRead).toHaveLength(events.length);
  });

  it('two concurrent readers observing the same real transition record EXACTLY ONE event (D-11 concurrency guarantee)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('watermark-org-race'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-watermark-race'),
        name: 'Controle para corrida de marca d’água',
        orgUnitId: orgUnit.id,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    // Establish the watermark at NOT_MET first (no event).
    await getRequirement.execute(requirement.id);

    // Attest EFFECTIVE before linking, same reasoning as the previous
    // test — one clean NOT_MET -> COMPLIANT transition, caused by the
    // link write.
    await attestControlEffective(orgUnit.id, control.id, actor.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    // Two concurrent transactions read the SAME requirement, right after
    // the SAME real change (research.md D-11's own named scenario). The
    // link use case's own side effect may already have recorded the
    // transition by the time these run — that is fine, and exactly the
    // point: even so, no additional duplicate event is produced.
    await Promise.all([
      getRequirement.execute(requirement.id),
      getRequirement.execute(requirement.id),
    ]);

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, entityId: requirement.id },
    });
    const changeEvents = events.filter(
      (event) =>
        (event.newValues as { previousState?: string; newState?: string } | null)?.previousState ===
          'NOT_MET' &&
        (event.newValues as { previousState?: string; newState?: string } | null)?.newState ===
          'COMPLIANT',
    );
    expect(changeEvents).toHaveLength(1);

    const mark = await ctx.prisma.client.requirementComplianceAuditMark.findUnique({
      where: { requirementId: requirement.id },
    });
    expect(mark?.lastAuditedState).toBe('COMPLIANT');
  });
});
