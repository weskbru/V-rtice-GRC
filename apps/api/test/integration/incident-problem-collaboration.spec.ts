import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreateCommentUseCase } from '../../src/core/comments/application/create-comment.usecase';
import { CommentsModule } from '../../src/core/comments/comments.module';
import { UploadService } from '../../src/core/files/application/upload.service';
import { FilesModule } from '../../src/core/files/files.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { IncidentsModule } from '../../src/modules/incidents/incidents.module';
import { ProblemsModule } from '../../src/modules/problems/problems.module';
import { NotFoundDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

describe('008-incidents-problems — INCIDENT/PROBLEM attachable/commentable registration, genuinely exercised', () => {
  let ctx: IntegrationTestContext;
  let createCommentUseCase: CreateCommentUseCase;
  let uploadService: UploadService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [
        LoggingModule,
        CacheModule,
        IncidentsModule,
        ProblemsModule,
        CommentsModule,
        FilesModule,
      ],
    });
    createCommentUseCase = ctx.app.get(CreateCommentUseCase);
    uploadService = ctx.app.get(UploadService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ipc-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-ipc-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupIncident(orgUnitId: string, reporterId: string) {
    return ctx.prisma.client.incident.create({
      data: {
        code: uniqueTestMarker('ipc-inc'),
        orgUnitId,
        title: 'Serviço fora do ar',
        description: 'Incidente de teste para o registro de colaboração.',
        severity: 'HIGH',
        reportedByUserId: reporterId,
        ownerUserId: reporterId,
        reportedOn: new Date('2026-09-11T00:00:00.000Z'),
      },
    });
  }

  async function setupProblem(orgUnitId: string, ownerId: string) {
    return ctx.prisma.client.problem.create({
      data: {
        code: uniqueTestMarker('ipc-prb'),
        orgUnitId,
        title: 'Causa raiz recorrente',
        description: 'Problema de teste para o registro de colaboração.',
        severity: 'HIGH',
        ownerUserId: ownerId,
        identifiedOn: new Date('2026-09-11T00:00:00.000Z'),
      },
    });
  }

  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
      '53de0000000c4944415478da6360000002000155a5f9600000000049454e44ae426082',
    'hex',
  );

  describe('INCIDENT', () => {
    it('a comment can be created against an Incident and is retrievable', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-inc-org'),
      });
      const actor = await setupActor(orgUnit.id, ['incident:edit', 'incident:view']);
      const incident = await setupIncident(orgUnit.id, actor.id);

      const comment = await createCommentUseCase.execute({
        actorUserId: actor.id,
        entityType: 'INCIDENT',
        entityId: incident.id,
        body: 'Investigação em andamento.',
      });

      expect(comment.entityType).toBe('INCIDENT');
      expect(comment.entityId).toBe(incident.id);
    });

    it('an attachment can be uploaded against an Incident and is stored', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-inc-att-org'),
      });
      const actor = await setupActor(orgUnit.id, ['incident:edit', 'incident:view']);
      const incident = await setupIncident(orgUnit.id, actor.id);

      const attachment = await uploadService.execute({
        actorUserId: actor.id,
        entityType: 'INCIDENT',
        entityId: incident.id,
        fileName: 'evidencia.png',
        declaredContentType: 'image/png',
        content: png,
      });

      expect(attachment.entityType).toBe('INCIDENT');
      expect(attachment.entityId).toBe(incident.id);
    });

    it('a caller without incident:view is refused a comment against an Incident — indistinguishable from nonexistent (FR-030)', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-inc-noview-org'),
      });
      const owner = await setupActor(orgUnit.id, ['incident:edit']);
      const incident = await setupIncident(orgUnit.id, owner.id);

      const caller = await setupActor(orgUnit.id, []);

      await expect(
        createCommentUseCase.execute({
          actorUserId: caller.id,
          entityType: 'INCIDENT',
          entityId: incident.id,
          body: 'Não deveria ser permitido.',
        }),
      ).rejects.toThrow(NotFoundDomainError);
    });

    it('a caller whose scope excludes the Incident is refused — same refusal as a genuinely nonexistent id', async () => {
      const inScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-inc-scope-org'),
      });
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-inc-oos-org'),
      });

      const owner = await setupActor(outOfScopeOrgUnit.id, ['incident:edit']);
      const outOfScopeIncident = await setupIncident(outOfScopeOrgUnit.id, owner.id);

      const caller = await setupActor(inScopeOrgUnit.id, ['incident:view']);

      const nonexistentId = randomUUID();
      const [refusalForOutOfScope, refusalForNonexistent] = await Promise.all([
        createCommentUseCase
          .execute({
            actorUserId: caller.id,
            entityType: 'INCIDENT',
            entityId: outOfScopeIncident.id,
            body: 'Fora de escopo.',
          })
          .catch((error: unknown) => error),
        createCommentUseCase
          .execute({
            actorUserId: caller.id,
            entityType: 'INCIDENT',
            entityId: nonexistentId,
            body: 'Inexistente.',
          })
          .catch((error: unknown) => error),
      ]);

      expect(refusalForOutOfScope).toBeInstanceOf(NotFoundDomainError);
      expect(refusalForNonexistent).toBeInstanceOf(NotFoundDomainError);
      expect((refusalForOutOfScope as NotFoundDomainError).message).toBe(
        (refusalForNonexistent as NotFoundDomainError).message.replace(
          nonexistentId,
          outOfScopeIncident.id,
        ),
      );
    });
  });

  describe('PROBLEM', () => {
    it('a comment can be created against a Problem and is retrievable', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-prb-org'),
      });
      const actor = await setupActor(orgUnit.id, ['problem:edit', 'problem:view']);
      const problem = await setupProblem(orgUnit.id, actor.id);

      const comment = await createCommentUseCase.execute({
        actorUserId: actor.id,
        entityType: 'PROBLEM',
        entityId: problem.id,
        body: 'Causa raiz em análise.',
      });

      expect(comment.entityType).toBe('PROBLEM');
      expect(comment.entityId).toBe(problem.id);
    });

    it('an attachment can be uploaded against a Problem and is stored', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-prb-att-org'),
      });
      const actor = await setupActor(orgUnit.id, ['problem:edit', 'problem:view']);
      const problem = await setupProblem(orgUnit.id, actor.id);

      const attachment = await uploadService.execute({
        actorUserId: actor.id,
        entityType: 'PROBLEM',
        entityId: problem.id,
        fileName: 'analise.png',
        declaredContentType: 'image/png',
        content: png,
      });

      expect(attachment.entityType).toBe('PROBLEM');
      expect(attachment.entityId).toBe(problem.id);
    });

    it('a caller without problem:view is refused a comment against a Problem — indistinguishable from nonexistent (FR-030)', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-prb-noview-org'),
      });
      const owner = await setupActor(orgUnit.id, ['problem:edit']);
      const problem = await setupProblem(orgUnit.id, owner.id);

      const caller = await setupActor(orgUnit.id, []);

      await expect(
        createCommentUseCase.execute({
          actorUserId: caller.id,
          entityType: 'PROBLEM',
          entityId: problem.id,
          body: 'Não deveria ser permitido.',
        }),
      ).rejects.toThrow(NotFoundDomainError);
    });

    it('a caller whose scope excludes the Problem is refused — same refusal as a genuinely nonexistent id', async () => {
      const inScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-prb-scope-org'),
      });
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('ipc-prb-oos-org'),
      });

      const owner = await setupActor(outOfScopeOrgUnit.id, ['problem:edit']);
      const outOfScopeProblem = await setupProblem(outOfScopeOrgUnit.id, owner.id);

      const caller = await setupActor(inScopeOrgUnit.id, ['problem:view']);

      const nonexistentId = randomUUID();
      const [refusalForOutOfScope, refusalForNonexistent] = await Promise.all([
        createCommentUseCase
          .execute({
            actorUserId: caller.id,
            entityType: 'PROBLEM',
            entityId: outOfScopeProblem.id,
            body: 'Fora de escopo.',
          })
          .catch((error: unknown) => error),
        createCommentUseCase
          .execute({
            actorUserId: caller.id,
            entityType: 'PROBLEM',
            entityId: nonexistentId,
            body: 'Inexistente.',
          })
          .catch((error: unknown) => error),
      ]);

      expect(refusalForOutOfScope).toBeInstanceOf(NotFoundDomainError);
      expect(refusalForNonexistent).toBeInstanceOf(NotFoundDomainError);
      expect((refusalForOutOfScope as NotFoundDomainError).message).toBe(
        (refusalForNonexistent as NotFoundDomainError).message.replace(
          nonexistentId,
          outOfScopeProblem.id,
        ),
      );
    });
  });
});
