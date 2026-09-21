/**
 * T034/T035/004-compliance-management, User Story 2 — end-to-end coverage
 * against the real database for `RequirementControlLink`: ADR-020 part 4
 * (scope checked BEFORE the write, NOTHING written for an out-of-scope or
 * nonexistent control — SC-005, FR-022), SC-001 (a control linked to
 * clauses of multiple frameworks stays one `controls` row), FR-008/FR-011
 * (duplicate-active refused, withdrawal preserves history, relink after
 * withdrawal permitted).
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import {
  LinkRequirementToControlUseCase,
  UnlinkRequirementFromControlUseCase,
} from '../../src/modules/compliance/application/links/link-requirement-control.usecase';
import { ListRequirementControlLinksUseCase } from '../../src/modules/compliance/application/links/list-requirement-control-links.usecase';
import { CreateRequirementUseCase } from '../../src/modules/compliance/application/requirements/create-requirement.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { ConflictDomainError, ValidationDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { User } from '@prisma/client';

describe('RequirementControlLink (T032-T035, ADR-020, SC-001, SC-005, FR-008/FR-011/FR-022)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let createRequirement: CreateRequirementUseCase;
  let linkUseCase: LinkRequirementToControlUseCase;
  let unlinkUseCase: UnlinkRequirementFromControlUseCase;
  let listUseCase: ListRequirementControlLinksUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFramework = ctx.app.get(CreateFrameworkUseCase);
    createVersion = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirement = ctx.app.get(CreateRequirementUseCase);
    linkUseCase = ctx.app.get(LinkRequirementToControlUseCase);
    unlinkUseCase = ctx.app.get(UnlinkRequirementFromControlUseCase);
    listUseCase = ctx.app.get(ListRequirementControlLinksUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('compliance-link-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    // ADR-020 part 5 — linking a control now also requires `control:view`
    // on the referenced control, not only `compliance:map`.
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['compliance:map', 'compliance:administer', 'compliance:view', 'control:view'],
      { name: `fixture-compliance-link-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupRequirement(actorUserId: string) {
    const framework = await createFramework.execute({
      actorUserId,
      name: uniqueTestMarker('Framework de vínculo'),
      description: 'Framework de teste para vínculo requisito-controle.',
      origin: 'EXTERNAL_STANDARD',
    });
    const version = await createVersion.execute({
      actorUserId,
      frameworkId: framework.id,
      label: uniqueTestMarker('v'),
    });
    const requirement = await createRequirement.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: version.id,
      externalRef: 'A.1',
      title: 'Requisito de teste',
      description: 'Descrição do requisito de teste.',
    });
    return { framework, version, requirement };
  }

  async function setupControl(orgUnitId: string, isActive = true) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-map'),
        name: 'Controle para mapeamento',
        orgUnitId,
        status: isActive ? 'ACTIVE' : 'RETIRED',
        isActive,
      },
    });
  }

  it('links a control within scope, auditing REQUIREMENT_CONTROL_LINK', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker('link-org') });
    const actor = await setupActor(orgUnit.id);
    const { requirement } = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    expect(link.control.id).toBe(control.id);
    expect(link.unlinkedAt).toBeUndefined();

    const auditEvent = await ctx.prisma.client.auditEvent.findFirst({
      where: { entityType: AuditEntityType.REQUIREMENT_CONTROL_LINK, entityId: link.id },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.action).toBe('compliance.requirement_control_linked');
  });

  it('a control OUTSIDE the actor scope and a NONEXISTENT control produce the exact same ValidationDomainError, and NOTHING is written for either (SC-005, FR-022)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-org-scope'),
    });
    const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-org-other'),
    });
    const actor = await setupActor(orgUnit.id);
    const { requirement } = await setupRequirement(actor.id);
    const outOfScopeControl = await setupControl(otherOrgUnit.id);

    const countBefore = await ctx.prisma.client.requirementControlLink.count();

    let outOfScopeError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        requirementId: requirement.id,
        controlId: outOfScopeControl.id,
      });
    } catch (error) {
      outOfScopeError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        requirementId: requirement.id,
        controlId: randomUUID(),
      });
    } catch (error) {
      nonexistentError = error;
    }

    expect(outOfScopeError).toBeInstanceOf(ValidationDomainError);
    expect(nonexistentError).toBeInstanceOf(ValidationDomainError);
    expect((outOfScopeError as ValidationDomainError).message).toBe(
      (nonexistentError as ValidationDomainError).message,
    );
    expect((outOfScopeError as ValidationDomainError).errors).toEqual(
      (nonexistentError as ValidationDomainError).errors,
    );

    const countAfter = await ctx.prisma.client.requirementControlLink.count();
    expect(countAfter).toBe(countBefore);
  });

  it('refuses a duplicate active link with 409-shaped ConflictDomainError, permits relinking after withdrawal (FR-008/FR-011)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-org-dup'),
    });
    const actor = await setupActor(orgUnit.id);
    const { requirement } = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    const firstLink = await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    await expect(
      linkUseCase.execute({
        actorUserId: actor.id,
        requirementId: requirement.id,
        controlId: control.id,
      }),
    ).rejects.toBeInstanceOf(ConflictDomainError);

    await unlinkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      linkId: firstLink.id,
    });

    const relinked = await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });
    expect(relinked.id).not.toBe(firstLink.id);

    const withdrawnHistory = await listUseCase.execute({
      requirementId: requirement.id,
      includeWithdrawn: true,
    });
    const withdrawn = withdrawnHistory.find((entry) => entry.id === firstLink.id);
    expect(withdrawn?.unlinkedAt).toBeDefined();

    const activeOnly = await listUseCase.execute({
      requirementId: requirement.id,
      includeWithdrawn: false,
    });
    expect(activeOnly.map((entry) => entry.id)).toEqual([relinked.id]);
  });

  it('the same control, linked to requirements of two different frameworks, remains ONE controls row (SC-001, FR-009)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-org-sc001'),
    });
    const actor = await setupActor(orgUnit.id);
    const { requirement: requirementA } = await setupRequirement(actor.id);
    const { requirement: requirementB } = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    const controlsCountBefore = await ctx.prisma.client.control.count({
      where: { id: control.id },
    });

    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirementA.id,
      controlId: control.id,
    });
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirementB.id,
      controlId: control.id,
    });

    const controlsCountAfter = await ctx.prisma.client.control.count({ where: { id: control.id } });
    expect(controlsCountAfter).toBe(controlsCountBefore);
    expect(controlsCountAfter).toBe(1);
  });
});

/**
 * ADR-020 part 5, both halves (`docs/architecture/decisions.md`) — closing
 * the gap where only `compliance:map` (the registering side) was ever
 * enforced and `control:view` (the referenced side) was not. This is
 * exactly the shape the seeded `Compliance Manager` role shipped with
 * (`compliance:map` without `control:view`) until this task fixed it.
 * `LinkRequirementToControlUseCase` now folds a missing `control:view` into
 * the SAME refusal a nonexistent control already produces
 * (`ValidationDomainError`/`controlNotFoundOrOutOfScope`) — proven the same
 * way the SC-005/FR-022 test above proves out-of-scope vs. nonexistent.
 */
describe('RequirementControlLink — control:view is required on the referenced control (ADR-020 part 5)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let createRequirement: CreateRequirementUseCase;
  let linkUseCase: LinkRequirementToControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFramework = ctx.app.get(CreateFrameworkUseCase);
    createVersion = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirement = ctx.app.get(CreateRequirementUseCase);
    linkUseCase = ctx.app.get(LinkRequirementToControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Deliberately WITHOUT `control:view` — the exact shape the seeded
   * `Compliance Manager` role shipped with before this task fixed it. */
  async function setupActorWithoutControlView(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('compliance-link-noview-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['compliance:map', 'compliance:administer', 'compliance:view'],
      { name: `fixture-compliance-link-noview-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupActorWithControlView(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('compliance-link-bothperm-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['compliance:map', 'compliance:administer', 'compliance:view', 'control:view'],
      { name: `fixture-compliance-link-bothperm-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupRequirement(actorUserId: string) {
    const framework = await createFramework.execute({
      actorUserId,
      name: uniqueTestMarker('Framework de vínculo sem control:view'),
      description: 'Framework de teste para a checagem de control:view.',
      origin: 'EXTERNAL_STANDARD',
    });
    const version = await createVersion.execute({
      actorUserId,
      frameworkId: framework.id,
      label: uniqueTestMarker('v'),
    });
    const requirement = await createRequirement.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: version.id,
      externalRef: 'A.1',
      title: 'Requisito de teste',
      description: 'Descrição do requisito de teste.',
    });
    return requirement;
  }

  async function setupControl(orgUnitId: string) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-noview'),
        name: 'Controle visível apenas ao registro',
        orgUnitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  it('a caller holding compliance:map but NOT control:view is refused with the SAME error a nonexistent control produces, and nothing is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-noview-org'),
    });
    const actor = await setupActorWithoutControlView(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    const countBefore = await ctx.prisma.client.requirementControlLink.count();

    let noViewError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        requirementId: requirement.id,
        controlId: control.id,
      });
    } catch (error) {
      noViewError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        requirementId: requirement.id,
        controlId: randomUUID(),
      });
    } catch (error) {
      nonexistentError = error;
    }

    expect(noViewError).toBeInstanceOf(ValidationDomainError);
    expect(nonexistentError).toBeInstanceOf(ValidationDomainError);
    expect((noViewError as ValidationDomainError).message).toBe(
      (nonexistentError as ValidationDomainError).message,
    );
    expect((noViewError as ValidationDomainError).errors).toEqual(
      (nonexistentError as ValidationDomainError).errors,
    );

    const countAfter = await ctx.prisma.client.requirementControlLink.count();
    expect(countAfter).toBe(countBefore);
  });

  it('a caller holding BOTH compliance:map and control:view succeeds', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('link-bothperm-org'),
    });
    const actor = await setupActorWithControlView(orgUnit.id);
    const requirement = await setupRequirement(actor.id);
    const control = await setupControl(orgUnit.id);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: requirement.id,
      controlId: control.id,
    });

    expect(link.control.id).toBe(control.id);
  });
});
