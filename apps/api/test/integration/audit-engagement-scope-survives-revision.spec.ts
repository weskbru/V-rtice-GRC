/**
 * T037/005-audit-findings, User Story 1 — the scenario `quickstart.md` §1
 * names as the most important of this fase: the engagement's scope
 * survives a later revision of the standard, WITHOUT a second snapshot
 * mechanism (research.md D-2). A scope link is a real FK to the specific,
 * immutable-once-`PUBLISHED` `FrameworkVersion`/`Requirement` row — never
 * to the version-agnostic `Framework` — so pointing at the row already IS
 * the preservation FR-006 requires.
 *
 * Also exercises the "regra adicional" D-2 names as necessary for the
 * guarantee above to hold at all: a still-`DRAFT` version (or a requirement
 * inside one) is refused `422`, because auditing a standard that can still
 * change underneath the engagement would defeat the whole point of this
 * test file.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationModule } from '../../src/core/authorization/authorization.module';
import { OrganizationsModule } from '../../src/core/organizations/organizations.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateAuditEngagementUseCase } from '../../src/modules/audit-engagements/application/create-audit-engagement.usecase';
import { LinkAuditScopeToFrameworkVersionUseCase } from '../../src/modules/audit-engagements/application/scope/link-framework-version.usecase';
import { LinkAuditScopeToRequirementUseCase } from '../../src/modules/audit-engagements/application/scope/link-requirement.usecase';
import { ListAuditScopeUseCase } from '../../src/modules/audit-engagements/application/scope/list-audit-scope.usecase';
import { AuditEngagementsModule } from '../../src/modules/audit-engagements/audit-engagements.module';
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

describe('AuditEngagement scope survives a later revision of the standard (T037, research.md D-2)', () => {
  let ctx: IntegrationTestContext;
  let createEngagement: CreateAuditEngagementUseCase;
  let linkFrameworkVersion: LinkAuditScopeToFrameworkVersionUseCase;
  let linkRequirement: LinkAuditScopeToRequirementUseCase;
  let listScope: ListAuditScopeUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [
        LoggingModule,
        CacheModule,
        OrganizationsModule,
        AuthorizationModule,
        ComplianceModule,
        AuditEngagementsModule,
      ],
    });
    createEngagement = ctx.app.get(CreateAuditEngagementUseCase);
    linkFrameworkVersion = ctx.app.get(LinkAuditScopeToFrameworkVersionUseCase);
    linkRequirement = ctx.app.get(LinkAuditScopeToRequirementUseCase);
    listScope = ctx.app.get(ListAuditScopeUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('audit-scope-revision-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      [
        'audit-engagement:view',
        'audit-engagement:create',
        'audit-engagement:scope',
        'compliance:view',
      ],
      { name: `fixture-audit-scope-revision-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function createFramework() {
    return ctx.prisma.client.framework.create({
      data: {
        code: uniqueTestMarker('fmk-scope-revision'),
        name: 'Norma de teste — escopo sobrevive à revisão',
        description: 'Framework de teste para T037.',
        origin: 'EXTERNAL_STANDARD',
      },
    });
  }

  async function createFrameworkVersion(
    frameworkId: string,
    label: string,
    status: 'DRAFT' | 'PUBLISHED',
  ) {
    return ctx.prisma.client.frameworkVersion.create({
      data: { frameworkId, label, status, publishedAt: status === 'PUBLISHED' ? new Date() : null },
    });
  }

  async function createRequirement(
    frameworkVersionId: string,
    externalRef: string,
    title: string,
    createdByUserId: string,
  ) {
    return ctx.prisma.client.requirement.create({
      data: {
        frameworkVersionId,
        externalRef,
        title,
        description: `Descrição de ${externalRef}.`,
        createdByUserId,
      },
    });
  }

  it('a requirement scope link keeps pointing at its ORIGINAL version/requirement after a second version is published', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('scope-revision-org'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework();

    const version2022 = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('2022'),
      'PUBLISHED',
    );
    const requirementA516 = await createRequirement(
      version2022.id,
      'A.5.16',
      'Gestão de identidade',
      actor.id,
    );

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Auditoria contra a norma revisável.',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-01-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    await linkRequirement.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      requirementId: requirementA516.id,
    });

    // A SECOND version of the SAME framework is published, with a
    // DIFFERENT requirement row (a real renumbering — a new id, not an
    // edit of the old one, since `requirements_immutable_after_publish`
    // forbids that trigger-side).
    const version2023 = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('2023'),
      'PUBLISHED',
    );
    await createRequirement(
      version2023.id,
      'A.5.16-rev',
      'Gestão de identidade (revisada)',
      actor.id,
    );

    const scope = await listScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });

    expect(scope).toHaveLength(1);
    const entry = scope[0];
    expect(entry).toBeDefined();
    expect(entry?.targetType).toBe('REQUIREMENT');
    // Still points at the ORIGINAL requirement — the 2023 revision never
    // moved, rewrote or invalidated this link (research.md D-2's own
    // "FK ingênuo" failure mode this design rejects).
    expect(entry?.target.id).toBe(requirementA516.id);
    expect(entry?.target.label).toBe('A.5.16 — Gestão de identidade');

    // The requirement itself never changed content — immutability holds
    // independent of this module too (004-compliance-management's own
    // trigger).
    const reread = await ctx.prisma.client.requirement.findUniqueOrThrow({
      where: { id: requirementA516.id },
    });
    expect(reread.externalRef).toBe('A.5.16');
    expect(reread.title).toBe('Gestão de identidade');
  });

  it('a framework-version scope link keeps pointing at its ORIGINAL version after a second version is published', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('scope-revision-org-fv'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework();
    const version2022 = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('2022'),
      'PUBLISHED',
    );

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Auditoria contra a versão publicada.',
      periodStart: new Date('2026-02-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-28T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    await linkFrameworkVersion.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      frameworkVersionId: version2022.id,
    });

    await createFrameworkVersion(framework.id, uniqueTestMarker('2023'), 'PUBLISHED');

    const scope = await listScope.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
    });
    expect(scope).toHaveLength(1);
    const entry = scope[0];
    expect(entry).toBeDefined();
    expect(entry?.targetType).toBe('FRAMEWORK_VERSION');
    expect(entry?.target.id).toBe(version2022.id);
  });

  it('linking scope against a DRAFT framework version is refused 422, nothing recorded (research.md D-2 "regra adicional")', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('scope-revision-org-draft-fv'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework();
    const draftVersion = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('draft'),
      'DRAFT',
    );

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Tentativa de escopar contra rascunho.',
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    const before = await ctx.prisma.client.auditScopeFrameworkVersion.count({
      where: { auditEngagementId: engagement.id },
    });

    await expect(
      linkFrameworkVersion.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        frameworkVersionId: draftVersion.id,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const after = await ctx.prisma.client.auditScopeFrameworkVersion.count({
      where: { auditEngagementId: engagement.id },
    });
    expect(after).toBe(before);
  });

  it('linking scope against a requirement of a DRAFT version is refused 422, nothing recorded', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('scope-revision-org-draft-req'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework();
    const draftVersion = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('draft-2'),
      'DRAFT',
    );
    const requirement = await createRequirement(
      draftVersion.id,
      'B.1',
      'Requisito em rascunho',
      actor.id,
    );

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Tentativa de escopar requisito de rascunho.',
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-30T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    const before = await ctx.prisma.client.auditScopeRequirement.count({
      where: { auditEngagementId: engagement.id },
    });

    await expect(
      linkRequirement.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        requirementId: requirement.id,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const after = await ctx.prisma.client.auditScopeRequirement.count({
      where: { auditEngagementId: engagement.id },
    });
    expect(after).toBe(before);
  });

  it('adding the SAME framework version to scope twice is refused as a conflict (409-equivalent)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('scope-revision-org-dup'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework();
    const version = await createFrameworkVersion(
      framework.id,
      uniqueTestMarker('dup'),
      'PUBLISHED',
    );

    const engagement = await createEngagement.execute({
      actorUserId: actor.id,
      objective: 'Engajamento com vínculo duplicado.',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-31T00:00:00.000Z'),
      orgUnitId: orgUnit.id,
      leadAuditorUserId: actor.id,
    });

    await linkFrameworkVersion.execute({
      actorUserId: actor.id,
      auditEngagementId: engagement.id,
      frameworkVersionId: version.id,
    });

    await expect(
      linkFrameworkVersion.execute({
        actorUserId: actor.id,
        auditEngagementId: engagement.id,
        frameworkVersionId: version.id,
      }),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });
});
