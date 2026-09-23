import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import {
  LinkControlUseCase,
  UnlinkControlUseCase,
} from '../../src/modules/risk/application/links/control-link.usecase';
import { RiskModule } from '../../src/modules/risk/risk.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { RiskControlLink } from '@prisma/client';

describe('Risk control link/unlink history and audit (T134, FR-076, FR-102)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let linkControlUseCase: LinkControlUseCase;
  let unlinkControlUseCase: UnlinkControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    linkControlUseCase = ctx.app.get(LinkControlUseCase);
    unlinkControlUseCase = ctx.app.get(UnlinkControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('link and unlink are each audited, and unlinking withdraws the row (stamped, not deleted)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      {
        name: `fixture-control-link-role-${randomUUID()}`,
      },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control'),
        name: 'Controle de acesso',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para vínculo de controle',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { link, risk: riskAfterLink } = await linkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      controlId: control.id,
    });

    expect(link.control.id).toBe(control.id);
    expect(link.linkedBy.id).toBe(actor.id);
    expect(link.unlinkedAt).toBeNull();
    expect(riskAfterLink.version).toBe(1);

    const linkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.RISK_CONTROL_LINK, entityId: link.id },
    });
    expect(linkAuditEvents).toHaveLength(1);
    expect(linkAuditEvents[0]!.action).toBe('risk.control_linked');
    expect(linkAuditEvents[0]!.newValues).toMatchObject({ riskId: risk.id, controlId: control.id });

    const riskAfterUnlink = await unlinkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      linkId: link.id,
      expectedVersion: riskAfterLink.version,
    });
    expect(riskAfterUnlink.version).toBe(2);

    const linkRow: RiskControlLink = await ctx.prisma.client.riskControlLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(linkRow.id).toBe(link.id);
    expect(linkRow.riskId).toBe(risk.id);
    expect(linkRow.controlId).toBe(control.id);
    expect(linkRow.unlinkedAt).not.toBeNull();
    expect(linkRow.unlinkedByUserId).toBe(actor.id);
    expect(linkRow.linkedByUserId).toBe(actor.id);

    const unlinkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.RISK_CONTROL_LINK,
        entityId: link.id,
        action: 'risk.control_unlinked',
      },
    });
    expect(unlinkAuditEvents).toHaveLength(1);
    expect(unlinkAuditEvents[0]!.newValues).toMatchObject({
      riskId: risk.id,
      controlId: control.id,
    });

    const allAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.RISK_CONTROL_LINK, entityId: link.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(allAuditEvents.map((event) => event.action)).toEqual([
      'risk.control_linked',
      'risk.control_unlinked',
    ]);
  });

  it('re-linking the same control after withdrawal is allowed and creates a new, distinct link row', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-relink-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-relink-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      {
        name: `fixture-control-relink-role-${randomUUID()}`,
      },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-relink-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-relink'),
        name: 'Controle reutilizável',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para re-vínculo de controle',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const first = await linkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      controlId: control.id,
    });
    const riskAfterUnlink = await unlinkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      linkId: first.link.id,
      expectedVersion: first.risk.version,
    });

    const second = await linkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: riskAfterUnlink.version,
      controlId: control.id,
    });

    expect(second.link.id).not.toBe(first.link.id);
    expect(second.link.unlinkedAt).toBeNull();

    const allLinks = await ctx.prisma.client.riskControlLink.findMany({
      where: { riskId: risk.id, controlId: control.id },
    });
    expect(allLinks).toHaveLength(2);
  });
});

describe('Risk control link — refusal is unchanged after the ControlDirectoryPort refactor (T011, research.md D-4)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let linkControlUseCase: LinkControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    linkControlUseCase = ctx.app.get(LinkControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a control id that does not exist is refused with the same ValidationDomainError/message as before the refactor', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-refusal-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-refusal-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      {
        name: `fixture-control-link-refusal-role-${randomUUID()}`,
      },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-refusal-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para recusa de vínculo de controle inexistente',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const nonExistentControlId = randomUUID();

    await expect(
      linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: nonExistentControlId,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    await expect(
      linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: nonExistentControlId,
      }),
    ).rejects.toThrow(USER_MESSAGES.risk.treatment.controlNotFound);

    const links = await ctx.prisma.client.riskControlLink.findMany({ where: { riskId: risk.id } });
    expect(links).toHaveLength(0);
  });

  it('a control that exists but is not active is refused with the same ValidationDomainError/message as before the refactor', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-inactive-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-inactive-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      {
        name: `fixture-control-link-inactive-role-${randomUUID()}`,
      },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-inactive-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const inactiveControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-inactive'),
        name: 'Controle inativo',
        orgUnitId: orgUnit.id,
        isActive: false,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para recusa de vínculo de controle inativo',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    await expect(
      linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: inactiveControl.id,
      }),
    ).rejects.toThrow(USER_MESSAGES.risk.treatment.controlNotFound);

    const links = await ctx.prisma.client.riskControlLink.findMany({
      where: { riskId: risk.id, controlId: inactiveControl.id },
    });
    expect(links).toHaveLength(0);
  });
});

describe('Risk control link — control:view is required on the referenced control (ADR-020 part 5)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let linkControlUseCase: LinkControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    linkControlUseCase = ctx.app.get(LinkControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a caller holding risk:treat but NOT control:view is refused with the SAME error a nonexistent control produces, and nothing is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-noview-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-noview-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:create', 'risk:treat'], {
      name: `fixture-control-link-noview-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-noview-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-noview'),
        name: 'Controle visível ao registro apenas',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para recusa por control:view ausente',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const countBefore = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });

    let noViewError: unknown;
    try {
      await linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: control.id,
      });
    } catch (error) {
      noViewError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
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
    expect((noViewError as ValidationDomainError).message).toBe(
      USER_MESSAGES.risk.treatment.controlNotFound,
    );

    const countAfter = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('a caller holding BOTH risk:treat and control:view succeeds', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-bothperm-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-bothperm-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      { name: `fixture-control-link-bothperm-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-bothperm-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-bothperm'),
        name: 'Controle visível',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para vínculo com ambas as permissões',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { link } = await linkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      controlId: control.id,
    });

    expect(link.control.id).toBe(control.id);
  });
});

describe('Risk control link — organizational scope is enforced on the referenced control (ADR-020 part 4, F-46)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let linkControlUseCase: LinkControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    linkControlUseCase = ctx.app.get(LinkControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-scope-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:treat', 'control:view'],
      { name: `fixture-control-link-scope-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  it('a control OUTSIDE the actor scope and a NONEXISTENT control produce the exact same ValidationDomainError, and NOTHING is written for either', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-scope-org'),
    });
    const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-scope-other-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-scope-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const outOfScopeControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-out-of-scope'),
        name: 'Controle de outra unidade',
        orgUnitId: otherOrgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para recusa de vínculo fora de escopo',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const countBefore = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });

    let outOfScopeError: unknown;
    try {
      await linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: outOfScopeControl.id,
      });
    } catch (error) {
      outOfScopeError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
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
    expect((outOfScopeError as ValidationDomainError).message).toBe(
      USER_MESSAGES.risk.treatment.controlNotFound,
    );

    const countAfter = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('a control with orgUnitId: null is refused for a UNIT-scoped actor with the same refusal', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-scope-null-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-scope-null-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const unscopedControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-null-org'),
        name: 'Controle sem unidade organizacional',
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para recusa de vínculo com controle sem unidade',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const countBefore = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });

    await expect(
      linkControlUseCase.execute({
        actorUserId: actor.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        controlId: unscopedControl.id,
      }),
    ).rejects.toThrow(USER_MESSAGES.risk.treatment.controlNotFound);

    const countAfter = await ctx.prisma.client.riskControlLink.count({
      where: { riskId: risk.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('an actor whose scope DOES cover the control succeeds', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('control-link-scope-ok-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('control-link-scope-ok-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    const inScopeControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-in-scope'),
        name: 'Controle da mesma unidade',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const risk = await createRiskUseCase.execute({
      actorUserId: actor.id,
      title: 'Risco para vínculo dentro do escopo',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const { link } = await linkControlUseCase.execute({
      actorUserId: actor.id,
      riskId: risk.id,
      expectedVersion: risk.version,
      controlId: inScopeControl.id,
    });

    expect(link.control.id).toBe(inScopeControl.id);
  });
});
