/**
 * T061-T071/005-audit-findings, US3 — `Finding ↔ Risk` (`FindingRiskLink`,
 * FR-013-FR-016, ADR-020, research.md D-4/D-11). Sibling of
 * `finding-control-link.spec.ts`, same structure, against the NEW
 * `RiskDirectoryPort` instead of the pre-existing `ControlDirectoryPort`.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreateFindingUseCase } from '../../src/grc/finding/application/create-finding.usecase';
import {
  LinkFindingRiskUseCase,
  UnlinkFindingRiskUseCase,
} from '../../src/grc/finding/application/links/link-finding-risk.usecase';
import { FindingModule } from '../../src/grc/finding/finding.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RiskDirectoryModule } from '../../src/modules/risk/risk-directory.module';
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
import type { FindingRiskLink } from '@prisma/client';

async function createFindingFixture(
  createFinding: CreateFindingUseCase,
  actorUserId: string,
  orgUnitId: string,
  ownerUserId: string,
) {
  return createFinding.execute({
    actorUserId,
    orgUnitId,
    title: uniqueTestMarker('achado-para-vinculo-risco'),
    description: 'Descrição do achado.',
    recommendation: undefined,
    category: 'NONCONFORMITY',
    origin: 'INTERNAL_ASSESSMENT',
    severity: 'HIGH',
    priority: 'HIGH',
    ownerUserId,
    identifiedOn: '2026-02-01',
  });
}

async function createRiskFixture(
  ctx: IntegrationTestContext,
  orgUnitId: string,
  ownerUserId: string,
  overrides: { archivedAt?: Date } = {},
) {
  return ctx.prisma.client.risk.create({
    data: {
      code: uniqueTestMarker('risk-for-finding'),
      title: 'Risco para vínculo de achado',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId,
      identifiedOn: new Date('2026-02-01'),
      archivedAt: overrides.archivedAt ?? null,
    },
  });
}

describe('Finding risk link/unlink — history, audit, ADR-020 (T061-T071, FR-013-FR-016)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingRiskUseCase;
  let unlinkUseCase: UnlinkFindingRiskUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, RiskDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingRiskUseCase);
    unlinkUseCase = ctx.app.get(UnlinkFindingRiskUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-link-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-finding-risk-link-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  it('link and unlink are each audited, and unlinking withdraws the row (stamped, not deleted) — FR-016', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-link-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'risk:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-link-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      riskId: risk.id,
    });
    expect(link.risk.id).toBe(risk.id);
    expect(link.linkedBy.id).toBe(actor.id);
    expect(link.unlinkedAt).toBeUndefined();

    const linkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.FINDING_RISK_LINK, entityId: link.id },
    });
    expect(linkAuditEvents).toHaveLength(1);
    expect(linkAuditEvents[0]!.action).toBe('finding_risk_link.linked');
    expect(linkAuditEvents[0]!.newValues).toMatchObject({ findingId: finding.id, riskId: risk.id });

    const unlinked = await unlinkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      linkId: link.id,
    });
    expect(unlinked.unlinkedAt).toBeDefined();
    expect(unlinked.unlinkedBy?.id).toBe(actor.id);

    const linkRow: FindingRiskLink = await ctx.prisma.client.findingRiskLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(linkRow.unlinkedAt).not.toBeNull();
    expect(linkRow.unlinkedByUserId).toBe(actor.id);
    expect(linkRow.linkedByUserId).toBe(actor.id);
    expect(linkRow.riskId).toBe(risk.id);

    const unlinkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.FINDING_RISK_LINK,
        entityId: link.id,
        action: 'finding_risk_link.unlinked',
      },
    });
    expect(unlinkAuditEvents).toHaveLength(1);
  });

  it('linking the same risk twice is refused 409 (ConflictDomainError)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-dup-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'risk:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-dup-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    await linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, riskId: risk.id });

    await expect(
      linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, riskId: risk.id }),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });

  it('T070: a risk that is ARCHIVED after being linked stays linked and legible — only the WRITE-time state is checked', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-archived-after-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'risk:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-archived-after-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      riskId: risk.id,
    });

    await ctx.prisma.client.risk.update({
      where: { id: risk.id },
      data: { archivedAt: new Date() },
    });

    const stillLinked = await ctx.prisma.client.findingRiskLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(stillLinked.unlinkedAt).toBeNull();
    expect(stillLinked.riskId).toBe(risk.id);
  });

  it('linking to an ARCHIVED risk is refused — the write-time check', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-archived-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'risk:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-archived-owner')}@example.test`,
    });
    const archivedRisk = await createRiskFixture(ctx, orgUnit.id, owner.id, {
      archivedAt: new Date(),
    });
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    await expect(
      linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        riskId: archivedRisk.id,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const links = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });
    expect(links).toBe(0);
  });

  it('T071: linking to an ARCHIVED finding is refused (invariant reused from assertFindingEditable)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-archived-finding-org'),
    });
    const actor = await setupActor(orgUnit.id, ['finding:create', 'finding:link', 'risk:view']);
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-archived-finding-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
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
      linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, riskId: risk.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const links = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });
    expect(links).toBe(0);
  });
});

describe('Finding risk link — risk:view is required on the referenced risk (ADR-020 part 5)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingRiskUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, RiskDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingRiskUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a caller holding finding:link but NOT risk:view is refused the SAME error a nonexistent risk produces, and NOTHING is written', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-noview-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-noview-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link'],
      { name: `fixture-finding-risk-noview-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-noview-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const countBefore = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });

    let noViewError: unknown;
    try {
      await linkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, riskId: risk.id });
    } catch (error) {
      noViewError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        riskId: randomUUID(),
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
      USER_MESSAGES.findings.link.riskNotFound,
    );

    const countAfter = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });
    expect(countAfter).toBe(countBefore);
  });
});

describe('Finding risk link — organizational scope enforced on the referenced risk (ADR-020 part 4, T066)', () => {
  let ctx: IntegrationTestContext;
  let createFinding: CreateFindingUseCase;
  let linkUseCase: LinkFindingRiskUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, FindingModule, RiskDirectoryModule],
    });
    createFinding = ctx.app.get(CreateFindingUseCase);
    linkUseCase = ctx.app.get(LinkFindingRiskUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a risk OUTSIDE the actor scope and a NONEXISTENT risk produce the exact same refusal, and NOTHING is written for either', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-scope-org'),
    });
    const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-scope-other-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-scope-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link', 'risk:view'],
      { name: `fixture-finding-risk-scope-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-scope-owner')}@example.test`,
    });
    const outOfScopeRisk = await createRiskFixture(ctx, otherOrgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);

    const countBefore = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });

    let outOfScopeError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        riskId: outOfScopeRisk.id,
      });
    } catch (error) {
      outOfScopeError = error;
    }

    let nonexistentError: unknown;
    try {
      await linkUseCase.execute({
        actorUserId: actor.id,
        findingId: finding.id,
        riskId: randomUUID(),
      });
    } catch (error) {
      nonexistentError = error;
    }

    expect(outOfScopeError).toBeInstanceOf(ValidationDomainError);
    expect(nonexistentError).toBeInstanceOf(ValidationDomainError);
    expect((outOfScopeError as ValidationDomainError).message).toBe(
      (nonexistentError as ValidationDomainError).message,
    );

    const countAfter = await ctx.prisma.client.findingRiskLink.count({
      where: { findingId: finding.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('unlinking a nonexistent linkId is 404; unlinking an already-withdrawn link is 422 (distinct, per contract)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('finding-risk-unlink-org'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-unlink-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['finding:create', 'finding:link', 'risk:view'],
      { name: `fixture-finding-risk-unlink-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('finding-risk-unlink-owner')}@example.test`,
    });
    const risk = await createRiskFixture(ctx, orgUnit.id, owner.id);
    const finding = await createFindingFixture(createFinding, actor.id, orgUnit.id, owner.id);
    const unlinkUseCase = ctx.app.get(UnlinkFindingRiskUseCase);

    await expect(
      unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: randomUUID() }),
    ).rejects.toBeInstanceOf(NotFoundDomainError);

    const link = await linkUseCase.execute({
      actorUserId: actor.id,
      findingId: finding.id,
      riskId: risk.id,
    });
    await unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: link.id });

    await expect(
      unlinkUseCase.execute({ actorUserId: actor.id, findingId: finding.id, linkId: link.id }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
