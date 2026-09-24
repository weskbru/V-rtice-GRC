import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreateFindingUseCase } from '../../src/grc/finding/application/create-finding.usecase';
import {
  LinkFindingControlUseCase,
  UnlinkFindingControlUseCase,
} from '../../src/grc/finding/application/links/link-finding-control.usecase';
import { FindingModule } from '../../src/grc/finding/finding.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { ControlDirectoryModule } from '../../src/modules/controls/control-directory.module';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../src/shared/errors/domain-error';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { FindingControlLink } from '@prisma/client';

async function createFindingFixture(
  createFinding: CreateFindingUseCase,
  actorUserId: string,
  orgUnitId: string,
  ownerUserId: string,
) {
  return createFinding.execute({
    actorUserId,
    orgUnitId,
    title: uniqueTestMarker('achado-para-vinculo-controle'),
    description: 'Descrição do achado.',
    recommendation: undefined,
    category: 'CONTROL_DEFICIENCY',
    origin: 'CONTROL_TESTING',
    severity: 'HIGH',
    priority: 'HIGH',
    ownerUserId,
    identifiedOn: '2026-02-01',
  });
}

describe('Finding control link/unlink — history, audit, ADR-020 (T060-T071, FR-013-FR-016)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingControlUseCase;
  let unlinkUseCase: UnlinkFindingControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, ControlDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingControlUseCase);
    unlinkUseCase = ctx.app.get(UnlinkFindingControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-link-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-finding-control-link-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  it('link and unlink are each audited, and unlinking withdraws the row (stamped, not deleted) — FR-016', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-link-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'control:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-link-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-for-finding'),
        name: 'Controle de acesso',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      controlId: control.id,
    });
    expect(link.control.id).toBe(control.id);
    expect(link.linkedBy.id).toBe(actor.id);
    expect(link.unlinkedAt).toBeUndefined();

    const linkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.FINDING_CONTROL_LINK, entityId: link.id },
    });
    expect(linkAuditEvents).toHaveLength(1);
    expect(linkAuditEvents[0]!.action).toBe('finding_control_link.linked');
    expect(linkAuditEvents[0]!.newValues).toMatchObject({
      findingId: finding.id,
      controlId: control.id,
    });

    const unlinked = await unlinkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      linkId: link.id,
    });
    expect(unlinked.unlinkedAt).toBeDefined();
    expect(unlinked.unlinkedBy?.id).toBe(actor.id);

    const linkRow: FindingControlLink =
      await ctx.prisma.client.findingControlLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(linkRow.unlinkedAt).not.toBeNull();
    expect(linkRow.unlinkedByUserId).toBe(actor.id);
    expect(linkRow.linkedByUserId).toBe(actor.id);
    expect(linkRow.controlId).toBe(control.id);

    const unlinkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.FINDING_CONTROL_LINK,
        entityId: link.id,
        action: 'finding_control_link.unlinked',
      },
    });
    expect(unlinkAuditEvents).toHaveLength(1);
  });

  it('linking the same control twice is refused 409 (ConflictDomainError)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-dup-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'control:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-dup-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-dup'),
        name: 'Controle duplicado',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      controlId: control.id,
    });

    await expect(
      linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, controlId: control.id }),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });

  it('re-linking after withdrawal is allowed and creates a new, distinct row', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-relink-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'control:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-relink-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-relink'),
        name: 'Controle reutilizável',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const first = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      controlId: control.id,
    });
    await unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: first.id });
    const second = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      controlId: control.id,
    });

    expect(second.id).not.toBe(first.id);
    const allLinks = await ctx.prisma.client.findingControlLink.findMany({
      where: { findingId: finding.id, controlId: control.id },
    });
    expect(allLinks).toHaveLength(2);
  });

  it('T071: linking to an ARCHIVED finding is refused (invariant reused from assertFindingEditable)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-archived-org'),
    });
    const actor = await setupActor(orgUnit.id, [
      'finding:create',
      'finding:link',
      'finding:close',
      'finding:administer',
      'control:view',
    ]);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-archived-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-archived-finding'),
        name: 'Controle',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);
    await ctx.prisma.client.finding.update({
      where: { id: finding.id },
      data: {
        status: 'ARCHIVED',
        closedAt: new Date(),
        closedByUserId: actor.id,
        archivedAt: new Date(),
        archivedByUserId: actor.id,
      },
    });

    await expect(
      linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, controlId: control.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const links = await ctx.prisma.client.findingControlLink.count({
      where: { findingId: finding.id },
    });
    expect(links).toBe(0);
  });
});

describe('Finding control link — control:view is required on the referenced control (ADR-020 part 5)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, ControlDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a caller holding finding:link but NOT control:view is refused the SAME error a nonexistent control produces, and NOTHING is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-noview-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-noview-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link'],
      { name: `fixture-finding-control-noview-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-noview-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-noview'),
        name: 'Controle visível ao registro apenas',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const countBefore = await ctx.prisma.client.findingControlLink.count({
      where: { findingId: finding.id },
    });

    let noViewError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        controlId: control.id,
      });
    } catch (error) {
      noViewError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
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
    expect((noViewError as ValidationDomainError).message).toBe(
      USER_MESSAGES.findings.link.controlNotFound,
    );

    const countAfter = await ctx.prisma.client.findingControlLink.count({
      where: { findingId: finding.id },
    });
    expect(countAfter).toBe(countBefore);
  });
});

describe('Finding control link — organizational scope enforced on the referenced control (ADR-020 part 4, T066)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingControlUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, ControlDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingControlUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a control OUTSIDE the actor scope and a NONEXISTENT control produce the exact same refusal, and NOTHING is written for either', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-scope-org'),
    });
    const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-scope-other-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-scope-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link', 'control:view'],
      { name: `fixture-finding-control-scope-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-scope-owner')}@example.test`,
    });
    const outOfScopeControl = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-out-of-scope-finding'),
        name: 'Controle de outra unidade',
        orgUnitId: otherOrgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const countBefore = await ctx.prisma.client.findingControlLink.count({
      where: { findingId: finding.id },
    });

    let outOfScopeError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        controlId: outOfScopeControl.id,
      });
    } catch (error) {
      outOfScopeError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
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

    const countAfter = await ctx.prisma.client.findingControlLink.count({
      where: { findingId: finding.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('unlinking a nonexistent linkId is 404; unlinking an already-withdrawn link is 422 (distinct, per contract)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-control-unlink-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-unlink-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link', 'control:view'],
      { name: `fixture-finding-control-unlink-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-control-unlink-owner')}@example.test`,
    });
    const control = await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-unlink'),
        name: 'Controle',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);
    const unlinkUseCase = ctx.app.get(UnlinkFindingControlUseCase);

    await expect(
      unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: randomUUID() }),
    ).rejects.toBeInstanceOf(NotFoundDomainError);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      controlId: control.id,
    });
    await unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: link.id });

    await expect(
      unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: link.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
