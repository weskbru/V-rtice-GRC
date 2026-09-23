import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { LinkControlToAssetUseCase } from '../../src/modules/controls/application/links/control-asset-link.usecase';
import {
  LinkControlToProcessUseCase,
  UnlinkControlFromProcessUseCase,
} from '../../src/modules/controls/application/links/control-process-link.usecase';
import { ListControlRiskLinksUseCase } from '../../src/modules/controls/application/links/list-control-links.usecase';
import { ControlRelationshipModule } from '../../src/modules/controls/control-relationship.module';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { User } from '@prisma/client';

describe('Control <-> process/asset relationship links (T042, ADR-020, FR-023-FR-025)', () => {
  let ctx: IntegrationTestContext;
  let linkProcessUseCase: LinkControlToProcessUseCase;
  let unlinkProcessUseCase: UnlinkControlFromProcessUseCase;
  let linkAssetUseCase: LinkControlToAssetUseCase;
  let listRiskLinksUseCase: ListControlRiskLinksUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ControlRelationshipModule],
    });
    linkProcessUseCase = ctx.app.get(LinkControlToProcessUseCase);
    unlinkProcessUseCase = ctx.app.get(UnlinkControlFromProcessUseCase);
    linkAssetUseCase = ctx.app.get(LinkControlToAssetUseCase);
    listRiskLinksUseCase = ctx.app.get(ListControlRiskLinksUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-link-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['control:edit', 'control:view', 'asset:view', 'process:view'],
      {
        name: `fixture-control-link-role-${randomUUID()}`,
      },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupControl(orgUnitId: string, status: 'ACTIVE' | 'RETIRED' = 'ACTIVE') {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-link'),
        name: 'Controle para vínculo',
        orgUnitId,
        status,
        isActive: status !== 'RETIRED',
      },
    });
  }

  it('links a control to a process within scope, audited with CONTROL_PROCESS_LINK', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const process = await ctx.prisma.client.process.create({
      data: {
        code: uniqueTestMarker('proc'),
        name: 'Processo de compras',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const link = await linkProcessUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      processId: process.id,
    });

    expect(link.entity.id).toBe(process.id);
    expect(link.unlinkedAt).toBeUndefined();

    const audit = await ctx.prisma.client.auditEvent.findFirst({
      where: { entityType: AuditEntityType.CONTROL_PROCESS_LINK, entityId: link.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.action).toBe('control.process_linked');
    expect(audit!.newValues).toMatchObject({ controlId: control.id, processId: process.id });
  });

  it('ADR-020 part 4 — a process outside the caller scope answers as nonexistent, and NOTHING is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-scope-org'),
    });
    const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-scope-other-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const outOfScopeProcess = await ctx.prisma.client.process.create({
      data: {
        code: uniqueTestMarker('proc-oos'),
        name: 'Processo fora de escopo',
        orgUnitId: outOfScopeOrgUnit.id,
        isActive: true,
      },
    });

    const countBefore = await ctx.prisma.client.controlProcessLink.count();

    await expect(
      linkProcessUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        processId: outOfScopeProcess.id,
      }),
    ).rejects.toThrow(NotFoundDomainError);

    const countAfter = await ctx.prisma.client.controlProcessLink.count();
    expect(countAfter).toBe(countBefore);

    await expect(
      linkProcessUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        processId: randomUUID(),
      }),
    ).rejects.toThrow(NotFoundDomainError);
    expect(await ctx.prisma.client.controlProcessLink.count()).toBe(countBefore);
  });

  it('a RETIRED control refuses new links (FR-006, 422)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-retired-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id, 'RETIRED');
    const process = await ctx.prisma.client.process.create({
      data: {
        code: uniqueTestMarker('proc-ret'),
        name: 'Processo',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    await expect(
      linkProcessUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        processId: process.id,
      }),
    ).rejects.toThrow(ValidationDomainError);
  });

  it('duplicate ACTIVE link is refused (409); withdraw then re-link the SAME pair is allowed and preserves the withdrawn row', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-dup-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const process = await ctx.prisma.client.process.create({
      data: {
        code: uniqueTestMarker('proc-dup'),
        name: 'Processo',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const firstLink = await linkProcessUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      processId: process.id,
    });

    await expect(
      linkProcessUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        processId: process.id,
      }),
    ).rejects.toThrow(ConflictDomainError);

    await unlinkProcessUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      linkId: firstLink.id,
    });

    const withdrawnRow = await ctx.prisma.client.controlProcessLink.findUniqueOrThrow({
      where: { id: firstLink.id },
    });
    expect(withdrawnRow.unlinkedAt).not.toBeNull();
    expect(withdrawnRow.unlinkedByUserId).toBe(actor.id);
    expect(withdrawnRow.linkedByUserId).toBe(actor.id);

    await expect(
      unlinkProcessUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        linkId: firstLink.id,
      }),
    ).rejects.toThrow(ValidationDomainError);

    const secondLink = await linkProcessUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      processId: process.id,
    });
    expect(secondLink.id).not.toBe(firstLink.id);

    const allLinks = await ctx.prisma.client.controlProcessLink.findMany({
      where: { controlId: control.id, processId: process.id },
      orderBy: { linkedAt: 'asc' },
    });
    expect(allLinks).toHaveLength(2);
    expect(allLinks[0]!.id).toBe(firstLink.id);
    expect(allLinks[0]!.unlinkedAt).not.toBeNull();
    expect(allLinks[1]!.id).toBe(secondLink.id);
    expect(allLinks[1]!.unlinkedAt).toBeNull();
  });

  it('links a control to an asset, audited with its OWN CONTROL_ASSET_LINK entity type — distinct from CONTROL_PROCESS_LINK', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-asset-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const asset = await ctx.prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('asset'),
        name: 'Servidor de aplicação',
        orgUnitId: orgUnit.id,
        isActive: true,
      },
    });

    const link = await linkAssetUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      assetId: asset.id,
    });

    const audit = await ctx.prisma.client.auditEvent.findFirst({
      where: { entityType: AuditEntityType.CONTROL_ASSET_LINK, entityId: link.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.action).toBe('control.asset_linked');

    const processAudit = await ctx.prisma.client.auditEvent.findFirst({
      where: { entityType: AuditEntityType.CONTROL_PROCESS_LINK, entityId: link.id },
    });
    expect(processAudit).toBeNull();
  });

  it('ADR-020 part 4 — an asset outside the caller scope answers as nonexistent, and NOTHING is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-asset-scope-org'),
    });
    const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-asset-scope-other-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const outOfScopeAsset = await ctx.prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('asset-oos'),
        name: 'Ativo fora de escopo',
        orgUnitId: outOfScopeOrgUnit.id,
        isActive: true,
      },
    });

    const countBefore = await ctx.prisma.client.controlAssetLink.count();

    await expect(
      linkAssetUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        assetId: outOfScopeAsset.id,
      }),
    ).rejects.toThrow(NotFoundDomainError);

    const countAfter = await ctx.prisma.client.controlAssetLink.count();
    expect(countAfter).toBe(countBefore);

    await expect(
      linkAssetUseCase.execute({
        actorUserId: actor.id,
        controlId: control.id,
        assetId: randomUUID(),
      }),
    ).rejects.toThrow(NotFoundDomainError);
    expect(await ctx.prisma.client.controlAssetLink.count()).toBe(countBefore);
  });

  it('FR-021 — GET risks reads the EXISTING RiskControlLink from the control side, creating nothing new', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-risk-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-link-risk-owner')}@example.test`,
    });
    const risk = await ctx.prisma.client.risk.create({
      data: {
        code: uniqueTestMarker('risk'),
        title: 'Risco tratado pelo controle',
        description: 'Descrição.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
        status: 'DRAFT',
        identifiedOn: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const existingLinkCountBefore = await ctx.prisma.client.riskControlLink.count();
    await ctx.prisma.client.riskControlLink.create({
      data: {
        riskId: risk.id,
        controlId: control.id,
        linkedByUserId: actor.id,
        linkedAt: new Date(),
      },
    });

    const links = await listRiskLinksUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      includeWithdrawn: false,
    });

    expect(links).toHaveLength(1);
    expect(links[0]!.risk.id).toBe(risk.id);
    expect(links[0]!.risk.code).toBe(risk.code);
    expect(links[0]!.risk.title).toBe(risk.title);

    const existingLinkCountAfter = await ctx.prisma.client.riskControlLink.count();
    expect(existingLinkCountAfter).toBe(existingLinkCountBefore + 1);
  });

  it('GET risks exposes only the ADR-020 part 4 minimum `RiskRef` shape — no other Risk field leaks', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-risk-shape-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const control = await setupControl(orgUnit.id);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-link-risk-shape-owner')}@example.test`,
    });
    const risk = await ctx.prisma.client.risk.create({
      data: {
        code: uniqueTestMarker('risk-shape'),
        title: 'Risco com forma mínima',
        description: 'Descrição que não deve aparecer na resposta.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
        status: 'DRAFT',
        identifiedOn: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await ctx.prisma.client.riskControlLink.create({
      data: {
        riskId: risk.id,
        controlId: control.id,
        linkedByUserId: actor.id,
        linkedAt: new Date(),
      },
    });

    const links = await listRiskLinksUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      includeWithdrawn: false,
    });

    expect(links).toHaveLength(1);
    expect(Object.keys(links[0]!.risk).sort()).toEqual(['code', 'id', 'title']);
  });

  it('ADR-020 part 4-style non-disclosure — GET risks on a control outside the caller scope answers exactly as a nonexistent control does', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-risk-scope-org'),
    });
    const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-link-risk-scope-other-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const outOfScopeControl = await setupControl(outOfScopeOrgUnit.id);

    await expect(
      listRiskLinksUseCase.execute({
        actorUserId: actor.id,
        controlId: outOfScopeControl.id,
        includeWithdrawn: false,
      }),
    ).rejects.toThrow(NotFoundDomainError);

    await expect(
      listRiskLinksUseCase.execute({
        actorUserId: actor.id,
        controlId: randomUUID(),
        includeWithdrawn: false,
      }),
    ).rejects.toThrow(NotFoundDomainError);
  });
});
