import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';
import {
  LinkIncidentAssetUseCase,
  ListIncidentAssetLinksUseCase,
  UnlinkIncidentAssetUseCase,
} from '../../src/modules/incidents/application/links/link-incident-asset.usecase';
import {
  LinkIncidentProcessUseCase,
  ListIncidentProcessLinksUseCase,
  UnlinkIncidentProcessUseCase,
} from '../../src/modules/incidents/application/links/link-incident-process.usecase';
import {
  LinkIncidentRiskUseCase,
  ListIncidentRiskLinksUseCase,
  UnlinkIncidentRiskUseCase,
} from '../../src/modules/incidents/application/links/link-incident-risk.usecase';
import { IncidentDirectoryModule } from '../../src/modules/incidents/incident-directory.module';
import { IncidentsModule } from '../../src/modules/incidents/incidents.module';
import {
  LinkProblemIncidentUseCase,
  ListProblemIncidentLinksUseCase,
  UnlinkProblemIncidentUseCase,
} from '../../src/modules/problems/application/links/link-problem-incident.usecase';
import {
  LinkProblemRiskUseCase,
  ListProblemRiskLinksUseCase,
  UnlinkProblemRiskUseCase,
} from '../../src/modules/problems/application/links/link-problem-risk.usecase';
import { ProblemsModule } from '../../src/modules/problems/problems.module';
import { NotFoundDomainError } from '../../src/shared/errors/domain-error';
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
import type { OrganizationalUnit, User } from '@prisma/client';

interface LinkedRecord {
  readonly id: string;
}

interface SourceScopeScenario {
  readonly sourceEntityType: AuditEntityType;
  readonly sourceEntityLabel: string;
  readonly sourceOrgUnitId: string;
  readonly sourceId: string;
  readonly actorInScopeId: string;
  readonly actorOutOfScopeId: string;
  attemptList(actorUserId: string, sourceId: string): Promise<readonly LinkedRecord[]>;
  attemptLink(actorUserId: string, sourceId: string): Promise<LinkedRecord>;
  attemptUnlink(actorUserId: string, sourceId: string, linkId: string): Promise<LinkedRecord>;
  createExistingLink(): Promise<string>;
  countLinks(): Promise<number>;
  findLinkRow(linkId: string): Promise<{ unlinkedAt: Date | null } | null>;
}

type ScenarioBuilder = (ctx: IntegrationTestContext) => Promise<SourceScopeScenario>;

function runAsActor<T>(actorUserId: string, fn: () => Promise<T>): Promise<T> {
  return RequestContextStore.run(
    {
      correlationId: randomUUID(),
      ipAddress: '203.0.113.40',
      userAgent: 'vitest-integration',
      method: 'POST',
      path: '/test/incident-problem-links-source-scope',
      actorUserId,
    },
    fn,
  );
}

async function setupActor(
  ctx: IntegrationTestContext,
  markerPrefix: string,
  orgUnit: OrganizationalUnit,
  permissions: readonly PermissionIdentifier[],
): Promise<User> {
  const actor = await createUserFixture(ctx.prisma, {
    email: `${uniqueTestMarker(markerPrefix)}@example.test`,
    primaryOrgUnitId: orgUnit.id,
  });
  const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
    name: `fixture-${markerPrefix}-role-${randomUUID()}`,
  });
  await assignRoleFixture(ctx.prisma, { user: actor, role });
  await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });
  return actor;
}

async function createIncidentFixture(
  ctx: IntegrationTestContext,
  orgUnitId: string,
  userId: string,
) {
  return ctx.prisma.client.incident.create({
    data: {
      code: uniqueTestMarker('inc-src-scope'),
      orgUnitId,
      title: 'Incidente para escopo de origem',
      description: 'Descrição do incidente.',
      severity: 'HIGH',
      reportedByUserId: userId,
      ownerUserId: userId,
      reportedOn: new Date('2026-02-01'),
    },
  });
}

async function createProblemFixture(
  ctx: IntegrationTestContext,
  orgUnitId: string,
  userId: string,
) {
  return ctx.prisma.client.problem.create({
    data: {
      code: uniqueTestMarker('prb-src-scope'),
      orgUnitId,
      title: 'Problema para escopo de origem',
      description: 'Descrição do problema.',
      severity: 'HIGH',
      ownerUserId: userId,
      identifiedOn: new Date('2026-02-01'),
    },
  });
}

async function createRiskFixture(ctx: IntegrationTestContext, orgUnitId: string, userId: string) {
  return ctx.prisma.client.risk.create({
    data: {
      code: uniqueTestMarker('risk-src-scope'),
      title: 'Risco para escopo de origem',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId: userId,
      identifiedOn: new Date('2026-02-01'),
    },
  });
}

async function createAssetFixture(ctx: IntegrationTestContext, orgUnitId: string) {
  return ctx.prisma.client.asset.create({
    data: {
      code: uniqueTestMarker('asset-src-scope'),
      name: 'Ativo para escopo de origem',
      orgUnitId,
    },
  });
}

async function createProcessFixture(ctx: IntegrationTestContext, orgUnitId: string) {
  return ctx.prisma.client.process.create({
    data: {
      code: uniqueTestMarker('process-src-scope'),
      name: 'Processo para escopo de origem',
      orgUnitId,
    },
  });
}

const buildIncidentRiskScenario: ScenarioBuilder = async (ctx) => {
  const sourceOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-risk-src-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-risk-src-other-org'),
  });
  const permissions: readonly PermissionIdentifier[] = ['incident:link', 'risk:view'];
  const actorInScope = await setupActor(ctx, 'inc-risk-src-in', sourceOrgUnit, permissions);
  const actorOutOfScope = await setupActor(ctx, 'inc-risk-src-out', otherOrgUnit, permissions);
  const incident = await createIncidentFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const risk = await createRiskFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const linkUseCase = ctx.app.get(LinkIncidentRiskUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentRiskUseCase);
  const listUseCase = ctx.app.get(ListIncidentRiskLinksUseCase);

  return {
    sourceEntityType: AuditEntityType.INCIDENT,
    sourceEntityLabel: USER_MESSAGES.incidents.entityLabel,
    sourceOrgUnitId: sourceOrgUnit.id,
    sourceId: incident.id,
    actorInScopeId: actorInScope.id,
    actorOutOfScopeId: actorOutOfScope.id,
    attemptList: (actorUserId, incidentId) =>
      listUseCase.execute({ actorUserId, incidentId, includeWithdrawn: false }),
    attemptLink: (actorUserId, incidentId) =>
      linkUseCase.execute({ actorUserId, incidentId, riskId: risk.id }),
    attemptUnlink: (actorUserId, incidentId, linkId) =>
      unlinkUseCase.execute({ actorUserId, incidentId, linkId }),
    createExistingLink: async () => {
      const link = await linkUseCase.execute({
        actorUserId: actorInScope.id,
        incidentId: incident.id,
        riskId: risk.id,
      });
      return link.id;
    },
    countLinks: () =>
      ctx.prisma.client.incidentRiskLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentRiskLink.findUnique({ where: { id: linkId } }),
  };
};

const buildIncidentAssetScenario: ScenarioBuilder = async (ctx) => {
  const sourceOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-asset-src-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-asset-src-other-org'),
  });
  const permissions: readonly PermissionIdentifier[] = ['incident:link', 'asset:view'];
  const actorInScope = await setupActor(ctx, 'inc-asset-src-in', sourceOrgUnit, permissions);
  const actorOutOfScope = await setupActor(ctx, 'inc-asset-src-out', otherOrgUnit, permissions);
  const incident = await createIncidentFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const asset = await createAssetFixture(ctx, sourceOrgUnit.id);
  const linkUseCase = ctx.app.get(LinkIncidentAssetUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentAssetUseCase);
  const listUseCase = ctx.app.get(ListIncidentAssetLinksUseCase);

  return {
    sourceEntityType: AuditEntityType.INCIDENT,
    sourceEntityLabel: USER_MESSAGES.incidents.entityLabel,
    sourceOrgUnitId: sourceOrgUnit.id,
    sourceId: incident.id,
    actorInScopeId: actorInScope.id,
    actorOutOfScopeId: actorOutOfScope.id,
    attemptList: (actorUserId, incidentId) =>
      listUseCase.execute({ actorUserId, incidentId, includeWithdrawn: false }),
    attemptLink: (actorUserId, incidentId) =>
      linkUseCase.execute({ actorUserId, incidentId, assetId: asset.id }),
    attemptUnlink: (actorUserId, incidentId, linkId) =>
      unlinkUseCase.execute({ actorUserId, incidentId, linkId }),
    createExistingLink: async () => {
      const link = await linkUseCase.execute({
        actorUserId: actorInScope.id,
        incidentId: incident.id,
        assetId: asset.id,
      });
      return link.id;
    },
    countLinks: () =>
      ctx.prisma.client.incidentAssetLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentAssetLink.findUnique({ where: { id: linkId } }),
  };
};

const buildIncidentProcessScenario: ScenarioBuilder = async (ctx) => {
  const sourceOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-process-src-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-process-src-other-org'),
  });
  const permissions: readonly PermissionIdentifier[] = ['incident:link', 'process:view'];
  const actorInScope = await setupActor(ctx, 'inc-process-src-in', sourceOrgUnit, permissions);
  const actorOutOfScope = await setupActor(ctx, 'inc-process-src-out', otherOrgUnit, permissions);
  const incident = await createIncidentFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const process = await createProcessFixture(ctx, sourceOrgUnit.id);
  const linkUseCase = ctx.app.get(LinkIncidentProcessUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentProcessUseCase);
  const listUseCase = ctx.app.get(ListIncidentProcessLinksUseCase);

  return {
    sourceEntityType: AuditEntityType.INCIDENT,
    sourceEntityLabel: USER_MESSAGES.incidents.entityLabel,
    sourceOrgUnitId: sourceOrgUnit.id,
    sourceId: incident.id,
    actorInScopeId: actorInScope.id,
    actorOutOfScopeId: actorOutOfScope.id,
    attemptList: (actorUserId, incidentId) =>
      listUseCase.execute({ actorUserId, incidentId, includeWithdrawn: false }),
    attemptLink: (actorUserId, incidentId) =>
      linkUseCase.execute({ actorUserId, incidentId, processId: process.id }),
    attemptUnlink: (actorUserId, incidentId, linkId) =>
      unlinkUseCase.execute({ actorUserId, incidentId, linkId }),
    createExistingLink: async () => {
      const link = await linkUseCase.execute({
        actorUserId: actorInScope.id,
        incidentId: incident.id,
        processId: process.id,
      });
      return link.id;
    },
    countLinks: () =>
      ctx.prisma.client.incidentProcessLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentProcessLink.findUnique({ where: { id: linkId } }),
  };
};

const buildProblemRiskScenario: ScenarioBuilder = async (ctx) => {
  const sourceOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-risk-src-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-risk-src-other-org'),
  });
  const permissions: readonly PermissionIdentifier[] = ['problem:link', 'risk:view'];
  const actorInScope = await setupActor(ctx, 'prb-risk-src-in', sourceOrgUnit, permissions);
  const actorOutOfScope = await setupActor(ctx, 'prb-risk-src-out', otherOrgUnit, permissions);
  const problem = await createProblemFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const risk = await createRiskFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const linkUseCase = ctx.app.get(LinkProblemRiskUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkProblemRiskUseCase);
  const listUseCase = ctx.app.get(ListProblemRiskLinksUseCase);

  return {
    sourceEntityType: AuditEntityType.PROBLEM,
    sourceEntityLabel: USER_MESSAGES.problems.entityLabel,
    sourceOrgUnitId: sourceOrgUnit.id,
    sourceId: problem.id,
    actorInScopeId: actorInScope.id,
    actorOutOfScopeId: actorOutOfScope.id,
    attemptList: (actorUserId, problemId) =>
      listUseCase.execute({ actorUserId, problemId, includeWithdrawn: false }),
    attemptLink: (actorUserId, problemId) =>
      linkUseCase.execute({ actorUserId, problemId, riskId: risk.id }),
    attemptUnlink: (actorUserId, problemId, linkId) =>
      unlinkUseCase.execute({ actorUserId, problemId, linkId }),
    createExistingLink: async () => {
      const link = await linkUseCase.execute({
        actorUserId: actorInScope.id,
        problemId: problem.id,
        riskId: risk.id,
      });
      return link.id;
    },
    countLinks: () => ctx.prisma.client.problemRiskLink.count({ where: { problemId: problem.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.problemRiskLink.findUnique({ where: { id: linkId } }),
  };
};

const buildProblemIncidentScenario: ScenarioBuilder = async (ctx) => {
  const sourceOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-inc-src-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-inc-src-other-org'),
  });
  const permissions: readonly PermissionIdentifier[] = ['problem:link', 'incident:view'];
  const actorInScope = await setupActor(ctx, 'prb-inc-src-in', sourceOrgUnit, permissions);
  const actorOutOfScope = await setupActor(ctx, 'prb-inc-src-out', otherOrgUnit, permissions);
  const problem = await createProblemFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const targetIncident = await createIncidentFixture(ctx, sourceOrgUnit.id, actorInScope.id);
  const linkUseCase = ctx.app.get(LinkProblemIncidentUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkProblemIncidentUseCase);
  const listUseCase = ctx.app.get(ListProblemIncidentLinksUseCase);

  return {
    sourceEntityType: AuditEntityType.PROBLEM,
    sourceEntityLabel: USER_MESSAGES.problems.entityLabel,
    sourceOrgUnitId: sourceOrgUnit.id,
    sourceId: problem.id,
    actorInScopeId: actorInScope.id,
    actorOutOfScopeId: actorOutOfScope.id,
    attemptList: (actorUserId, problemId) =>
      listUseCase.execute({ actorUserId, problemId, includeWithdrawn: false }),
    attemptLink: (actorUserId, problemId) =>
      linkUseCase.execute({ actorUserId, problemId, incidentId: targetIncident.id }),
    attemptUnlink: (actorUserId, problemId, linkId) =>
      unlinkUseCase.execute({ actorUserId, problemId, linkId }),
    createExistingLink: async () => {
      const link = await linkUseCase.execute({
        actorUserId: actorInScope.id,
        problemId: problem.id,
        incidentId: targetIncident.id,
      });
      return link.id;
    },
    countLinks: () =>
      ctx.prisma.client.problemIncidentLink.count({ where: { problemId: problem.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.problemIncidentLink.findUnique({ where: { id: linkId } }),
  };
};

const PAIRS: readonly [string, ScenarioBuilder][] = [
  ['Incident -> Risk', buildIncidentRiskScenario],
  ['Incident -> Asset', buildIncidentAssetScenario],
  ['Incident -> Process', buildIncidentProcessScenario],
  ['Problem -> Risk', buildProblemRiskScenario],
  ['Problem -> Incident', buildProblemIncidentScenario],
];

describe(
  'The five link pairs (008-incidents-problems, US3) refuse an actor scoped ' +
    "OUTSIDE the source Incident/Problem's organizational unit (T067)",
  () => {
    let ctx: IntegrationTestContext;

    beforeAll(async () => {
      ctx = await buildIntegrationTestingModule({
        imports: [
          LoggingModule,
          CacheModule,
          IncidentsModule,
          ProblemsModule,
          IncidentDirectoryModule,
        ],
      });
    });

    afterAll(async () => {
      await ctx.close();
    });

    it.each(PAIRS)(
      '%s — list: an out-of-scope actor is refused identically to a nonexistent source id',
      async (_pairName, buildScenario) => {
        const scenario = await buildScenario(ctx);
        const nonexistentId = randomUUID();

        let outOfScopeError: unknown;
        try {
          await scenario.attemptList(scenario.actorOutOfScopeId, scenario.sourceId);
        } catch (error) {
          outOfScopeError = error;
        }

        let nonexistentError: unknown;
        try {
          await scenario.attemptList(scenario.actorOutOfScopeId, nonexistentId);
        } catch (error) {
          nonexistentError = error;
        }

        expect(outOfScopeError).toBeInstanceOf(NotFoundDomainError);
        expect(nonexistentError).toBeInstanceOf(NotFoundDomainError);
        expect((outOfScopeError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${scenario.sourceId} não foi encontrado(a).`,
        );
        expect((nonexistentError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${nonexistentId} não foi encontrado(a).`,
        );

        const inScopeResult = await scenario.attemptList(
          scenario.actorInScopeId,
          scenario.sourceId,
        );
        expect(inScopeResult).toEqual([]);
      },
    );

    it.each(PAIRS)(
      '%s — link: an out-of-scope actor is refused identically to a nonexistent source id, and no row is written',
      async (_pairName, buildScenario) => {
        const scenario = await buildScenario(ctx);
        const countBefore = await scenario.countLinks();
        const nonexistentId = randomUUID();

        let outOfScopeError: unknown;
        try {
          await scenario.attemptLink(scenario.actorOutOfScopeId, scenario.sourceId);
        } catch (error) {
          outOfScopeError = error;
        }

        let nonexistentError: unknown;
        try {
          await scenario.attemptLink(scenario.actorOutOfScopeId, nonexistentId);
        } catch (error) {
          nonexistentError = error;
        }

        expect(outOfScopeError).toBeInstanceOf(NotFoundDomainError);
        expect(nonexistentError).toBeInstanceOf(NotFoundDomainError);
        expect((outOfScopeError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${scenario.sourceId} não foi encontrado(a).`,
        );
        expect((nonexistentError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${nonexistentId} não foi encontrado(a).`,
        );

        const countAfter = await scenario.countLinks();
        expect(countAfter).toBe(countBefore);
      },
    );

    it.each(PAIRS)(
      '%s — unlink: an out-of-scope actor is refused identically to a nonexistent source id, and the link is left untouched',
      async (_pairName, buildScenario) => {
        const scenario = await buildScenario(ctx);
        const linkId = await scenario.createExistingLink();
        const nonexistentId = randomUUID();

        let outOfScopeError: unknown;
        try {
          await scenario.attemptUnlink(scenario.actorOutOfScopeId, scenario.sourceId, linkId);
        } catch (error) {
          outOfScopeError = error;
        }

        let nonexistentError: unknown;
        try {
          await scenario.attemptUnlink(scenario.actorOutOfScopeId, nonexistentId, linkId);
        } catch (error) {
          nonexistentError = error;
        }

        expect(outOfScopeError).toBeInstanceOf(NotFoundDomainError);
        expect(nonexistentError).toBeInstanceOf(NotFoundDomainError);
        expect((outOfScopeError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${scenario.sourceId} não foi encontrado(a).`,
        );
        expect((nonexistentError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${nonexistentId} não foi encontrado(a).`,
        );

        const row = await scenario.findLinkRow(linkId);
        expect(row).not.toBeNull();
        expect(row?.unlinkedAt).toBeNull();
      },
    );

    it.each(PAIRS)(
      '%s — the out-of-scope link attempt writes a DENIED audit row naming the REAL organizational unit (FR-037)',
      async (_pairName, buildScenario) => {
        const scenario = await buildScenario(ctx);

        await expect(
          runAsActor(scenario.actorOutOfScopeId, () =>
            scenario.attemptLink(scenario.actorOutOfScopeId, scenario.sourceId),
          ),
        ).rejects.toBeInstanceOf(NotFoundDomainError);

        const rows = await ctx.prisma.client.auditEvent.findMany({
          where: {
            entityType: scenario.sourceEntityType,
            entityId: scenario.sourceId,
            outcome: 'DENIED',
          },
        });

        expect(rows.length).toBeGreaterThanOrEqual(1);
        const row = rows[rows.length - 1]!;
        expect(row.actorUserId).toBe(scenario.actorOutOfScopeId);
        expect(row.action).toBe('organization.denied.out_of_scope');
        expect(row.organizationalUnitId).toBe(scenario.sourceOrgUnitId);
      },
    );
  },
);
