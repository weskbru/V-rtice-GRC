import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import { LinkRequirementToControlUseCase } from '../../src/modules/compliance/application/links/link-requirement-control.usecase';
import { ExecuteMappingMigrationUseCase } from '../../src/modules/compliance/application/mapping-migrations/execute-mapping-migration.usecase';
import { CreateRequirementUseCase } from '../../src/modules/compliance/application/requirements/create-requirement.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { User } from '@prisma/client';

describe('ExecuteMappingMigrationUseCase (T036-T042, research.md D-6, SC-004)', () => {
  let ctx: IntegrationTestContext;
  let createFramework: CreateFrameworkUseCase;
  let createVersion: CreateFrameworkVersionUseCase;
  let createRequirement: CreateRequirementUseCase;
  let linkUseCase: LinkRequirementToControlUseCase;
  let executeMigration: ExecuteMappingMigrationUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFramework = ctx.app.get(CreateFrameworkUseCase);
    createVersion = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirement = ctx.app.get(CreateRequirementUseCase);
    linkUseCase = ctx.app.get(LinkRequirementToControlUseCase);
    executeMigration = ctx.app.get(ExecuteMappingMigrationUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string): Promise<User> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('migration-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['compliance:map', 'compliance:administer', 'compliance:view', 'control:view'],
      { name: `fixture-migration-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupControl(orgUnitId: string) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-migration'),
        name: 'Controle para migração',
        orgUnitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  it('COPIED only for a target named in correspondences; two requirements sharing the SAME externalRef but absent from the body both come back PENDING_DECISION — never inferred by code coincidence (D-6)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('migration-org-infer'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework.execute({
      actorUserId: actor.id,
      name: uniqueTestMarker('Framework de migração'),
      description: 'Framework de teste para migração.',
      origin: 'EXTERNAL_STANDARD',
    });
    const sourceVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-origem'),
    });
    const targetVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-destino'),
    });

    const sourceRequirement = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: sourceVersion.id,
      externalRef: 'A.5.16',
      title: 'Cláusula de origem',
      description: 'Descrição da cláusula de origem.',
    });
    const targetRequirementSameCode = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.5.16',
      title: 'Cláusula de destino (mesmo código, sem correspondência decidida)',
      description: 'Descrição da cláusula de destino.',
    });
    const targetRequirementDecided = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'B.1',
      title: 'Cláusula de destino (com correspondência decidida)',
      description: 'Descrição da cláusula de destino decidida.',
    });

    const control = await setupControl(orgUnit.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: sourceRequirement.id,
      controlId: control.id,
    });

    const detail = await executeMigration.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      targetVersionId: targetVersion.id,
      sourceFrameworkVersionId: sourceVersion.id,
      correspondences: [
        {
          targetRequirementId: targetRequirementDecided.id,
          sourceRequirementIds: [sourceRequirement.id],
        },
      ],
    });

    const decidedItem = detail.items.find(
      (item) => item.targetRequirement.id === targetRequirementDecided.id,
    );
    const sameCodeItem = detail.items.find(
      (item) => item.targetRequirement.id === targetRequirementSameCode.id,
    );

    expect(decidedItem?.outcome).toBe('COPIED');
    expect(decidedItem?.copiedLinkCount).toBe(1);
    expect(sameCodeItem?.outcome).toBe('PENDING_DECISION');
    expect(sameCodeItem?.sourceRequirements).toEqual([]);
  });

  it('never overwrites a target that already has an active link — even a deliberate attempt to force it via correspondences returns SKIPPED_ALREADY_MAPPED (FR-014)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('migration-org-skip'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework.execute({
      actorUserId: actor.id,
      name: uniqueTestMarker('Framework de migração skip'),
      description: 'Framework de teste para skip.',
      origin: 'EXTERNAL_STANDARD',
    });
    const sourceVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-origem'),
    });
    const targetVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-destino'),
    });

    const sourceRequirement = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: sourceVersion.id,
      externalRef: 'A.1',
      title: 'Origem',
      description: 'Descrição.',
    });
    const targetRequirement = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.1',
      title: 'Destino já mapeado manualmente',
      description: 'Descrição.',
    });

    const sourceControl = await setupControl(orgUnit.id);
    const manuallyLinkedControl = await setupControl(orgUnit.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: sourceRequirement.id,
      controlId: sourceControl.id,
    });
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: targetRequirement.id,
      controlId: manuallyLinkedControl.id,
    });

    const detail = await executeMigration.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      targetVersionId: targetVersion.id,
      sourceFrameworkVersionId: sourceVersion.id,
      correspondences: [
        { targetRequirementId: targetRequirement.id, sourceRequirementIds: [sourceRequirement.id] },
      ],
    });

    const item = detail.items.find((entry) => entry.targetRequirement.id === targetRequirement.id);
    expect(item?.outcome).toBe('SKIPPED_ALREADY_MAPPED');
    expect(item?.copiedLinkCount).toBe(0);

    const links = await ctx.prisma.client.requirementControlLink.findMany({
      where: { requirementId: targetRequirement.id, unlinkedAt: null },
    });
    expect(links).toHaveLength(1);
    expect(links[0]!.controlId).toBe(manuallyLinkedControl.id);
  });

  it('is re-runnable: a second execution over the same target version only processes requirements still undecided, never revisiting COPIED/SKIPPED items (edge case)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('migration-org-rerun'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework.execute({
      actorUserId: actor.id,
      name: uniqueTestMarker('Framework de migração re-execução'),
      description: 'Framework de teste para re-execução.',
      origin: 'EXTERNAL_STANDARD',
    });
    const sourceVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-origem'),
    });
    const targetVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-destino'),
    });

    const sourceRequirement = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: sourceVersion.id,
      externalRef: 'A.1',
      title: 'Origem',
      description: 'Descrição.',
    });
    const targetOne = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.1',
      title: 'Destino um (decidido na primeira execução)',
      description: 'Descrição.',
    });
    const targetTwo = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.2',
      title: 'Destino dois (pendente na primeira, decidido na segunda)',
      description: 'Descrição.',
    });

    const control = await setupControl(orgUnit.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: sourceRequirement.id,
      controlId: control.id,
    });

    const firstRun = await executeMigration.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      targetVersionId: targetVersion.id,
      sourceFrameworkVersionId: sourceVersion.id,
      correspondences: [
        { targetRequirementId: targetOne.id, sourceRequirementIds: [sourceRequirement.id] },
      ],
    });
    const firstTargetOneItem = firstRun.items.find(
      (item) => item.targetRequirement.id === targetOne.id,
    );
    const firstTargetTwoItem = firstRun.items.find(
      (item) => item.targetRequirement.id === targetTwo.id,
    );
    expect(firstTargetOneItem?.outcome).toBe('COPIED');
    expect(firstTargetTwoItem?.outcome).toBe('PENDING_DECISION');

    const secondRun = await executeMigration.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      targetVersionId: targetVersion.id,
      sourceFrameworkVersionId: sourceVersion.id,
      correspondences: [
        { targetRequirementId: targetOne.id, sourceRequirementIds: [sourceRequirement.id] },
        { targetRequirementId: targetTwo.id, sourceRequirementIds: [sourceRequirement.id] },
      ],
    });
    const secondTargetOneItem = secondRun.items.find(
      (item) => item.targetRequirement.id === targetOne.id,
    );
    const secondTargetTwoItem = secondRun.items.find(
      (item) => item.targetRequirement.id === targetTwo.id,
    );
    expect(secondTargetOneItem?.outcome).toBe('SKIPPED_ALREADY_MAPPED');
    expect(secondTargetTwoItem?.outcome).toBe('COPIED');

    const targetOneLinks = await ctx.prisma.client.requirementControlLink.findMany({
      where: { requirementId: targetOne.id, unlinkedAt: null },
    });
    expect(targetOneLinks).toHaveLength(1);
  });

  it('records EXACTLY ONE audit event per execution, carrying the outcome counts — never one event per copied link (SC-004)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('migration-org-audit'),
    });
    const actor = await setupActor(orgUnit.id);
    const framework = await createFramework.execute({
      actorUserId: actor.id,
      name: uniqueTestMarker('Framework de migração auditoria'),
      description: 'Framework de teste para auditoria única.',
      origin: 'EXTERNAL_STANDARD',
    });
    const sourceVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-origem'),
    });
    const targetVersion = await createVersion.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      label: uniqueTestMarker('v-destino'),
    });

    const sourceRequirementA = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: sourceVersion.id,
      externalRef: 'A.1',
      title: 'Origem A',
      description: 'Descrição.',
    });
    const sourceRequirementB = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: sourceVersion.id,
      externalRef: 'A.2',
      title: 'Origem B',
      description: 'Descrição.',
    });
    const targetCopied = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.1',
      title: 'Destino copiado',
      description: 'Descrição.',
    });
    const targetPending = await createRequirement.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      versionId: targetVersion.id,
      externalRef: 'A.2',
      title: 'Destino pendente',
      description: 'Descrição.',
    });

    const controlA = await setupControl(orgUnit.id);
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: sourceRequirementA.id,
      controlId: controlA.id,
    });
    await linkUseCase.execute({
      actorUserId: actor.id,
      requirementId: sourceRequirementB.id,
      controlId: controlA.id,
    });

    const detail = await executeMigration.execute({
      actorUserId: actor.id,
      frameworkId: framework.id,
      targetVersionId: targetVersion.id,
      sourceFrameworkVersionId: sourceVersion.id,
      correspondences: [
        { targetRequirementId: targetCopied.id, sourceRequirementIds: [sourceRequirementA.id] },
      ],
    });
    void targetPending;

    const events = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.REQUIREMENT_CONTROL_MAPPING_MIGRATION,
        entityId: detail.id,
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.newValues).toMatchObject({
      frameworkId: framework.id,
      sourceFrameworkVersionId: sourceVersion.id,
      targetFrameworkVersionId: targetVersion.id,
      copiedCount: 1,
      pendingDecisionCount: 1,
      skippedAlreadyMappedCount: 0,
    });

    const linkEvents = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.REQUIREMENT_CONTROL_LINK },
    });
    const migrationCreatedLinkEvents = linkEvents.filter(
      (event) =>
        (event.newValues as { requirementId?: string } | null)?.requirementId === targetCopied.id,
    );
    expect(migrationCreatedLinkEvents).toHaveLength(0);
  });
});
