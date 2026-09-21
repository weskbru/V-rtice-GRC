/**
 * T024/T025/004-compliance-management — proves, against the real test
 * database:
 *
 *   T024: `FrameworkVersion`'s two-edge reachability (research.md D-3,
 *   FR-002/FR-006) — `DRAFT` is reached at creation, `PUBLISHED` is
 *   reached by publication, no operation reverts `PUBLISHED -> DRAFT`, and
 *   creating a new version does not alter or invalidate the previous one.
 *   The same discipline `FindingStatus` (Fase 1) and the `Control`
 *   lifecycle draft (Fase 2) needed a correction to acquire.
 *
 *   T025: publishing a version with zero requirements is refused with a
 *   `ValidationDomainError` (FR-005, edge case "versão publicada sem
 *   cláusulas"), and the version remains `DRAFT`, unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/create-framework-version.usecase';
import { PublishFrameworkVersionUseCase } from '../../src/modules/compliance/application/framework-versions/publish-framework-version.usecase';
import { CreateFrameworkUseCase } from '../../src/modules/compliance/application/frameworks/create-framework.usecase';
import { CreateRequirementUseCase } from '../../src/modules/compliance/application/requirements/create-requirement.usecase';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import { uniqueTestMarker } from './support/env';
import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('FrameworkVersion lifecycle and publish precondition (004-compliance-management, T024/T025)', () => {
  let ctx: IntegrationTestContext;
  let createFrameworkUseCase: CreateFrameworkUseCase;
  let createFrameworkVersionUseCase: CreateFrameworkVersionUseCase;
  let createRequirementUseCase: CreateRequirementUseCase;
  let publishFrameworkVersionUseCase: PublishFrameworkVersionUseCase;
  let actorUserId: string;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ComplianceModule],
    });
    createFrameworkUseCase = ctx.app.get(CreateFrameworkUseCase);
    createFrameworkVersionUseCase = ctx.app.get(CreateFrameworkVersionUseCase);
    createRequirementUseCase = ctx.app.get(CreateRequirementUseCase);
    publishFrameworkVersionUseCase = ctx.app.get(PublishFrameworkVersionUseCase);

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('fw-version-lifecycle-actor')}@example.test`,
    });
    actorUserId = actor.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('DRAFT is reached at creation, PUBLISHED is reached by publication, no operation reverts PUBLISHED -> DRAFT, and a new version does not alter the previous one', async () => {
    const framework = await createFrameworkUseCase.execute({
      actorUserId,
      name: uniqueTestMarker('lifecycle-framework'),
      description: 'Fixture framework for lifecycle reachability.',
      origin: 'EXTERNAL_STANDARD',
    });

    const v1 = await createFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      label: 'v1',
    });
    expect(v1.status).toBe('DRAFT');

    await createRequirementUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: v1.id,
      externalRef: 'A.1',
      title: 'Fixture requirement',
      description: 'Fixture requirement description.',
    });

    const published = await publishFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      versionId: v1.id,
      expectedVersion: v1.version,
    });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeDefined();
    expect(published.publishedBy?.id).toBe(actorUserId);

    // No operation in this contract reverts PUBLISHED -> DRAFT — the
    // lifecycle module itself declares no such transition
    // (`framework-version-lifecycle.ts`), so there is no use case call to
    // even attempt here. This is a structural guarantee, verified by
    // `canPublishFrameworkVersion`'s own exhaustive unit coverage — this
    // integration test instead confirms the REAL row, read back from the
    // database, still reports PUBLISHED and was never altered by a second
    // publish attempt.
    await expect(
      publishFrameworkVersionUseCase.execute({
        actorUserId,
        frameworkId: framework.id,
        versionId: v1.id,
        expectedVersion: published.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    // Creating the next version does not alter or invalidate v1 (FR-006).
    const v2 = await createFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      label: 'v2',
    });
    expect(v2.status).toBe('DRAFT');

    const v1Row = await ctx.prisma.client.frameworkVersion.findUniqueOrThrow({
      where: { id: v1.id },
    });
    expect(v1Row.status).toBe('PUBLISHED');
    expect(v1Row.label).toBe('v1');
    expect(v1Row.version).toBe(published.version);
  });

  it('publishing a version with zero requirements is refused, and the version remains DRAFT, unchanged (FR-005)', async () => {
    const framework = await createFrameworkUseCase.execute({
      actorUserId,
      name: uniqueTestMarker('empty-version-framework'),
      description: 'Fixture framework for the empty-version publish refusal.',
      origin: 'INTERNAL_POLICY',
    });
    const version = await createFrameworkVersionUseCase.execute({
      actorUserId,
      frameworkId: framework.id,
      label: 'v1',
    });

    await expect(
      publishFrameworkVersionUseCase.execute({
        actorUserId,
        frameworkId: framework.id,
        versionId: version.id,
        expectedVersion: version.version,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    const row = await ctx.prisma.client.frameworkVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    expect(row.status).toBe('DRAFT');
    expect(row.publishedAt).toBeNull();
    expect(row.version).toBe(version.version);
  });
});
