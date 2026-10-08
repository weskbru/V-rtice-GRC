import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActionModule } from '../../src/grc/action/action.module';
import { CreateActionUseCase } from '../../src/grc/action/application/create-action.usecase';
import { ListActionUseCase } from '../../src/grc/action/application/list-action.usecase';
import { CreateEvidenceUseCase } from '../../src/grc/evidence/application/create-evidence.usecase';
import { LinkEvidenceUseCase } from '../../src/grc/evidence/application/link-evidence.usecase';
import { EvidenceModule } from '../../src/grc/evidence/evidence.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateControlAssessmentUseCase } from '../../src/modules/controls/application/assessments/create-control-assessment.usecase';
import { ControlAssessmentModule } from '../../src/modules/controls/control-assessment.module';
import { ControlRelationshipModule } from '../../src/modules/controls/control-relationship.module';
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

describe('Task C — CONTROL_ASSESSMENT action origin and CONTROL evidence subject, genuinely exercised', () => {
  let ctx: IntegrationTestContext;
  let createAssessmentUseCase: CreateControlAssessmentUseCase;
  let createActionUseCase: CreateActionUseCase;
  let listActionUseCase: ListActionUseCase;
  let createEvidenceUseCase: CreateEvidenceUseCase;
  let linkEvidenceUseCase: LinkEvidenceUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [
        LoggingModule,
        CacheModule,
        ControlAssessmentModule,
        ControlRelationshipModule,
        ActionModule,
        EvidenceModule,
      ],
    });
    createAssessmentUseCase = ctx.app.get(CreateControlAssessmentUseCase);
    createActionUseCase = ctx.app.get(CreateActionUseCase);
    listActionUseCase = ctx.app.get(ListActionUseCase);
    createEvidenceUseCase = ctx.app.get(CreateEvidenceUseCase);
    linkEvidenceUseCase = ctx.app.get(LinkEvidenceUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('ctl-collab-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-ctl-collab-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupControl(orgUnitId: string) {
    return ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-collab'),
        name: 'Controle para colaboração',
        orgUnitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  it('an Action created with originType CONTROL_ASSESSMENT appears in the shared work list, identified by its origin', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-collab-org'),
    });
    const actor = await setupActor(orgUnit.id, [
      'control:test',
      'control:edit',
      'action:create',
      'action:view',
    ]);

    const control = await setupControl(orgUnit.id);
    const assessment = await createAssessmentUseCase.execute({
      actorUserId: actor.id,
      controlId: control.id,
      assessedOn: new Date('2026-06-01T00:00:00.000Z'),
      result: 'INEFFECTIVE',
      conclusion: 'Falha identificada na execução do controle.',
    });

    const { record: action, originLabel } = await createActionUseCase.execute({
      actorUserId: actor.id,
      originType: 'CONTROL_ASSESSMENT',
      originId: assessment.id,
      title: 'Corrigir a falha identificada na verificação',
      responsibleUserId: actor.id,
      dueOn: '2026-07-01',
    });

    expect(action.originType).toBe('CONTROL_ASSESSMENT');
    expect(action.originId).toBe(assessment.id);
    expect(originLabel).toContain(control.code);

    const list = await listActionUseCase.execute({
      actorUserId: actor.id,
      page: 1,
      pageSize: 25,
      originType: 'CONTROL_ASSESSMENT',
      originId: assessment.id,
    });
    expect(list.items.map((item) => item.id)).toContain(action.id);
  });

  it('an origin (assessment) outside the caller organizational scope is refused when creating an action from it', async () => {
    const inScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-collab-scope-org'),
    });
    const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-collab-oos-org'),
    });

    const setupOwnerActor = await setupActor(outOfScopeOrgUnit.id, ['control:test']);
    const outOfScopeControl = await setupControl(outOfScopeOrgUnit.id);
    const outOfScopeAssessment = await createAssessmentUseCase.execute({
      actorUserId: setupOwnerActor.id,
      controlId: outOfScopeControl.id,
      assessedOn: new Date('2026-06-01T00:00:00.000Z'),
      result: 'INEFFECTIVE',
      conclusion: 'Falha identificada.',
    });

    const caller = await setupActor(inScopeOrgUnit.id, ['action:create', 'control:edit']);

    await expect(
      createActionUseCase.execute({
        actorUserId: caller.id,
        originType: 'CONTROL_ASSESSMENT',
        originId: outOfScopeAssessment.id,
        title: 'Ação a partir de origem fora de escopo',
        responsibleUserId: caller.id,
        dueOn: '2026-07-01',
      }),
    ).rejects.toThrow(NotFoundDomainError);
  });

  it('evidence can be linked directly to a CONTROL subject (FR-026), the same closed-type mechanism every other subject uses', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('ctl-collab-evidence-org'),
    });
    const actor = await setupActor(orgUnit.id, [
      'control:view',
      'evidence:create',
      'evidence:link',
    ]);
    const control = await setupControl(orgUnit.id);

    const evidence = await createEvidenceUseCase.execute({
      actorUserId: actor.id,
      orgUnitId: orgUnit.id,
      title: 'Registro de execução do controle',
      type: 'DOCUMENT',
      source: 'MANUAL_UPLOAD',
      ownerUserId: actor.id,
      collectedOn: '2026-06-01',
      observation: 'Evidência coletada durante a verificação.',
    });

    const link = await linkEvidenceUseCase.execute({
      actorUserId: actor.id,
      evidenceId: evidence.id,
      subjectType: 'CONTROL',
      subjectId: control.id,
    });

    expect(link.subjectType).toBe('CONTROL');
    expect(link.subjectId).toBe(control.id);

    const row = await ctx.prisma.client.evidenceLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.subjectType).toBe('CONTROL');
    expect(row.subjectId).toBe(control.id);
  });
});
