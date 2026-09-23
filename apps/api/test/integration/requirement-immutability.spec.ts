import { AuditEntityType, AuditOutcome } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { PublishFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/publish-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import { CreateRequirementUseCase } from '../../src/modules/compliance/application/requirements/create-requirement.usecase';
import { UpdateRequirementUseCase } from '../../src/modules/compliance/application/requirements/update-requirement.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import { uniqueTestMarker } from './support/env';
import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Requirement immutability after publish (004-compliance-management, T028/T029, FR-004, research.md D-4)', () => {
  let ctx: IntegrationTestContext;
  let createFrameworkUseCase: CreateFrameworkUseCase;
  let createFrameworkVersionUseCase: CreateFrameworkVersionUseCase;
  let createRequirementUseCase: CreateRequirementUseCase;
  let publishFrameworkVersionUseCase: PublishFrameworkVersionUseCase;
  let updateRequirementUseCase: UpdateRequirementUseCase;
  let actorUserId: string;

  async function seedPublishedRequirement(): Promise<{
    readonly requirementId: string;
    readonly requirementVersion: number;
  }> {
    const framework = await createFrameworkUseCase.execute({
      actorUserId,
      name: uniqueTestMarker('immutability-framework'),
      description: 'Fixture framework for immutability tests.',
      origin: 'EXTERNAL_STANDARD',
    });
    const version = await createFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      label: 'v1',
    });
    const requirement = await createRequirementUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: version.id,
      externalRef: 'A.1',
      title: 'Original title',
      description: 'Original description.',
    });
    await publishFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: version.id,
      expectedVersion: version.version,
    });

    return { requirementId: requirement.id, requirementVersion: requirement.version };
  }

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFrameworkUseCase = ctx.app.get(CreateFrameworkUseCase);
    createFrameworkVersionUseCase = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirementUseCase = ctx.app.get(CreateRequirementUseCase);
    publishFrameworkVersionUseCase = ctx.app.get(PublishFrameworkVersionUseCase);
    updateRequirementUseCase = ctx.app.get(UpdateRequirementUseCase);

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('immutability-actor')}@example.test`,
    });
    actorUserId = actor.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('T028 — a raw SQL UPDATE against a published requirement, bypassing every use case, is rejected by the database trigger', async () => {
    const { requirementId } = await seedPublishedRequirement();

    await expect(
      ctx.prisma.client.requirement.update({
        where: { id: requirementId },
        data: { title: 'Attempted raw SQL edit' },
      }),
    ).rejects.toThrow(/immutable/);

    const row = await ctx.prisma.client.requirement.findUniqueOrThrow({
      where: { id: requirementId },
    });
    expect(row.title).toBe('Original title');
  });

  it('T029 — the same edit, attempted through UpdateRequirementUseCase, is refused with a validation error and the attempt is audited', async () => {
    const { requirementId, requirementVersion } = await seedPublishedRequirement();

    await expect(
      updateRequirementUseCase.execute({
        actorUserId,
        requirementId,
        expectedVersion: requirementVersion,
        title: 'Attempted application-path edit',
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const row = await ctx.prisma.client.requirement.findUniqueOrThrow({
      where: { id: requirementId },
    });
    expect(row.title).toBe('Original title');
    expect(row.version).toBe(requirementVersion);

    const auditRow = await ctx.prisma.client.auditEvent.findFirst({
      where: {
        entityType: AuditEntityType.REQUIREMENT,
        entityId: requirementId,
        action: 'requirement.update_refused',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.outcome).toBe(AuditOutcome.FAILURE);
    expect((auditRow?.newValues as Record<string, unknown> | null)?.title).toBe(
      'Attempted application-path edit',
    );
  });
});
