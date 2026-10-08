import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { DeclareRequirementNotApplicableUseCase } from '../../src/modules/compliance/application/applicability/declare-requirement-not-applicable.usecase';
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

import type { ControlAssessmentResult, User } from '@prisma/client';

describe('RequirementComplianceState — all five values reachable through real data (T048)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let createRequirement: CreateRequirementUseCase;
  let linkUseCase: LinkRequirementToControlUseCase;
  let declareNotApplicable: DeclareRequirementNotApplicableUseCase;
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
    declareNotApplicable = ctx.app.get(DeclareRequirementNotApplicableUseCase);
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
      email: `${uniqueTestMarker('compliance-state-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
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
      { name: `fixture-compliance-state-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupRequirement(actorUserId: string) {
    const framework = await createFramework.execute({
      actorUserId,
      name: uniqueTestMarker('Framework de estado'),
      description: 'Framework de teste para estado de conformidade.',
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

  async function setupControl(orgUnitId: string, isActive = true) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-state'),
        name: 'Controle para estado de conformidade',
        orgUnitId,
        status: isActive ? 'ACTIVE' : 'RETIRED',
        isActive,
      },
    });
  }

  async function attestControl(
    orgUnitId: string,
    controlId: string,
    assessorId: string,
    result: ControlAssessmentResult,
  ): Promise<void> {
    const approver = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('compliance-state-approver')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['control:approve'], {
      name: `fixture-compliance-state-approver-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: approver, role });
    await grantUnitScopeFixture(ctx.prisma, { user: approver, orgUnitId });

    const assessment = await createAssessment.execute({
      actorUserId: assessorId,
      controlId,
      assessedOn: new Date('2026-06-01T00:00:00.000Z'),
      result,
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

  it('NOT_APPLICABLE — an active not-applicable declaration excludes the requirement from compliance (FR-016)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-na'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);

    await declareNotApplicable.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      justification: 'Cláusula não se aplica ao escopo certificado da organização.',
    });

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_APPLICABLE');
  });

  it('NOT_MET — applicable, zero linked controls (FR-018) — never COMPLIANT by omission', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-nm'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_MET');
  });

  it('NOT_PROVEN — applicable, one linked control, never assessed (FR-019) — distinct from NOT_MET', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-np'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_PROVEN');
  });

  it('NOT_PROVEN — a RETIRED control linked to a live requirement never sustains compliance, but the link stays readable (edge case)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-retired'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const activeControl = await setupControl(orgUnit.id, true);

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: activeControl.id,
    });
    await attestControl(orgUnit.id, activeControl.id, actor.id, 'EFFECTIVE');

    await ctx.prisma.client.control.update({
      where: { id: activeControl.id },
      data: { status: 'RETIRED', isActive: false },
    });

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_PROVEN');
  });

  it('PARTIALLY_MET — one control proves fully, another does not (AS6) — the mix is the reason this state exists', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-pm'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const effectiveControl = await setupControl(orgUnit.id);
    const unassessedControl = await setupControl(orgUnit.id);

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: effectiveControl.id,
    });
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: unassessedControl.id,
    });
    await attestControl(orgUnit.id, effectiveControl.id, actor.id, 'EFFECTIVE');

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('PARTIALLY_MET');
  });

  it('COMPLIANT — every linked control active and attested EFFECTIVE (SC-002)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-compliant'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });
    await attestControl(orgUnit.id, control.id, actor.id, 'EFFECTIVE');

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('COMPLIANT');
  });

  it('a not-applicable requirement keeps its control link readable, excluded from compliance but not hidden (edge case)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('state-org-na-link'),
    });
    const actor = await setupActor(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });
    await declareNotApplicable.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      justification: 'Cláusula não se aplica; o vínculo é mantido para referência histórica.',
    });

    const read = await getRequirement.execute(requirement.id);
    expect(read.complianceState).toBe('NOT_APPLICABLE');
    expect(read.applicability).not.toBeNull();
  });
});
