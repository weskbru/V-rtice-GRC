import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OrgUnitAdminService } from '../../src/core/organizations/application/org-unit-admin.service';
import { OrganizationsModule } from '../../src/core/organizations/organizations.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import { uniqueTestMarker } from './support/env';
import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Organizational unit reparenting (T174, ADR-004)', () => {
  let ctx: IntegrationTestContext;
  let orgUnitAdmin: OrgUnitAdminService;
  let actorId: string;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, OrganizationsModule],
    });
    orgUnitAdmin = ctx.app.get(OrgUnitAdminService);

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('org-reparent-actor')}@example.test`,
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('moving a unit under a new parent rewrites its own path/depth AND every descendant in its subtree', async () => {
    const root = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-root'),
      name: 'Root',
      parentId: undefined,
    });
    const source = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-source'),
      name: 'Source',
      parentId: root.id,
    });
    const child = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-child'),
      name: 'Child',
      parentId: source.id,
    });
    const grandchild = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-grandchild'),
      name: 'Grandchild',
      parentId: child.id,
    });
    const target = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-target'),
      name: 'Target',
      parentId: root.id,
    });

    await orgUnitAdmin.update({ actorUserId: actorId, orgUnitId: source.id, parentId: target.id });

    const movedSource = await orgUnitAdmin.getById(source.id);
    const movedChild = await orgUnitAdmin.getById(child.id);
    const movedGrandchild = await orgUnitAdmin.getById(grandchild.id);
    const unchangedTarget = await orgUnitAdmin.getById(target.id);

    expect(movedSource.parentId).toBe(target.id);
    expect(movedSource.path).toBe(`${unchangedTarget.path}${source.id}/`);
    expect(movedSource.depth).toBe(unchangedTarget.depth + 1);

    expect(movedChild.path).toBe(`${movedSource.path}${child.id}/`);
    expect(movedChild.depth).toBe(movedSource.depth + 1);
    expect(movedGrandchild.path).toBe(`${movedChild.path}${grandchild.id}/`);
    expect(movedGrandchild.depth).toBe(movedChild.depth + 1);

    expect(movedChild.path.startsWith(movedSource.path)).toBe(true);
    expect(movedGrandchild.path.startsWith(movedSource.path)).toBe(true);
  });

  it('records exactly one org_unit.reparented audit row for the moved unit, not one per descendant', async () => {
    const root = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-audit-root'),
      name: 'Root',
      parentId: undefined,
    });
    const source = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-audit-source'),
      name: 'Source',
      parentId: root.id,
    });
    await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-audit-child'),
      name: 'Child',
      parentId: source.id,
    });
    const target = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-audit-target'),
      name: 'Target',
      parentId: root.id,
    });

    await orgUnitAdmin.update({ actorUserId: actorId, orgUnitId: source.id, parentId: target.id });

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT,
        entityId: source.id,
        action: 'org_unit.reparented',
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.previousValues).toMatchObject({ parentId: root.id });
    expect(rows[0]!.newValues).toMatchObject({ parentId: target.id });
  });

  it('refuses a reparent that would make a unit its own ancestor (cycle) with 422, and changes nothing', async () => {
    const root = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-cycle-root'),
      name: 'Root',
      parentId: undefined,
    });
    const parent = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-cycle-parent'),
      name: 'Parent',
      parentId: root.id,
    });
    const child = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-cycle-child'),
      name: 'Child',
      parentId: parent.id,
    });

    await expect(
      orgUnitAdmin.update({ actorUserId: actorId, orgUnitId: parent.id, parentId: child.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const unchangedParent = await orgUnitAdmin.getById(parent.id);
    expect(unchangedParent.parentId).toBe(root.id);
    expect(unchangedParent.path).toBe(parent.path);

    const unchangedChild = await orgUnitAdmin.getById(child.id);
    expect(unchangedChild.path).toBe(child.path);
  });

  it('refuses moving a unit under itself (the trivial cycle) with 422', async () => {
    const root = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-self-root'),
      name: 'Root',
      parentId: undefined,
    });
    const unit = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-self-unit'),
      name: 'Unit',
      parentId: root.id,
    });

    await expect(
      orgUnitAdmin.update({ actorUserId: actorId, orgUnitId: unit.id, parentId: unit.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it('reparenting to root (parentId: null) is a legal, non-cyclical move', async () => {
    const root = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-toroot-root'),
      name: 'Root',
      parentId: undefined,
    });
    const parent = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-toroot-parent'),
      name: 'Parent',
      parentId: root.id,
    });
    const child = await orgUnitAdmin.create({
      actorUserId: actorId,
      code: uniqueTestMarker('org-reparent-toroot-child'),
      name: 'Child',
      parentId: parent.id,
    });

    await orgUnitAdmin.update({ actorUserId: actorId, orgUnitId: child.id, parentId: null });

    const movedChild = await orgUnitAdmin.getById(child.id);
    expect(movedChild.parentId).toBeUndefined();
    expect(movedChild.depth).toBe(0);
    expect(movedChild.path).toBe(`/${child.id}/`);
  });
});
