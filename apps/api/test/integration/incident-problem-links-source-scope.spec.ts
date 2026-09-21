/**
 * 008-incidents-problems, US3 — organizational scope on the SOURCE side of
 * all five link pairs (Incident->Risk, Incident->Asset, Incident->Process,
 * Problem->Risk, Problem->Incident).
 *
 * `incident-problem-relationship-links.spec.ts` (T045/T049/T053b) already
 * proves ADR-020 parts 4/5 — the TARGET's organizational scope and the
 * REFERENCED-side permission — for all five pairs, with the actor always
 * scoped to the SAME unit as the source Incident/Problem. That file never
 * constructs an actor scoped to a DIFFERENT unit than the source record
 * itself, so it cannot show whether `list`/`link`/`unlink` refuse an actor
 * who can see one organizational unit but not the one the Incident/Problem
 * actually belongs to. Tracked as tasks.md T067 ("NÃO FEITO" — no
 * `incidents-scope.spec.ts`/`problems-scope.spec.ts` and no equivalent
 * anywhere else), reconciled against the code below: all five link use
 * cases resolve the SOURCE record — through `resolveInScopeIncident`
 * (Incident) or `ProblemRepositoryPort.findById(scope, ...)` (Problem) —
 * BEFORE touching the target, so this is a real, previously-unexercised
 * code path, not a duplicate of what already runs.
 *
 * Every write assertion follows this repository's row-count discipline
 * (`finding-risk-link.spec.ts`/`incident-problem-relationship-links.spec.ts`):
 * an error of the right TYPE is not proof that nothing was written — row
 * count/row state is checked directly, before and after.
 *
 * FR-030 non-disclosure: an out-of-scope source and a nonexistent source id
 * must produce the byte-identical `NotFoundDomainError` message, and the
 * DENIED audit row (`organization.denied.out_of_scope`) must carry the
 * REAL organizational unit of the out-of-scope record — proving the
 * refusal is a genuine scope decision, not an accidental "not found" that
 * would also fire for a typo'd id.
 */
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
  /** Creates one active link, using the legitimate in-scope actor. */
  createExistingLink(): Promise<string>;
  countLinks(): Promise<number>;
  findLinkRow(linkId: string): Promise<{ unlinkedAt: Date | null } | null>;
}

type ScenarioBuilder = (ctx: IntegrationTestContext) => Promise<SourceScopeScenario>;

/**
 * `AuditRecorder.record` reads `actorUserId` from `AuditContextPort`
 * (backed by `RequestContextStore`), NOT from any value passed by the
 * calling use case (see `AuditRecorder.record`'s own doc comment) — a
 * usecase called directly, with no ambient request context, produces a
 * `DENIED` row with `actorUserId: null`. `audit-denied.spec.ts` (T040b)
 * establishes the pattern this helper mirrors: wrap the call in
 * `RequestContextStore.run(...)` so the row is attributable the same way
 * an HTTP request populates it via middleware.
 */
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

/**
 * Every scenario builder below creates:
 *   - `sourceOrgUnit` — where the Incident/Problem actually lives.
 *   - `otherOrgUnit` — where the OUT-OF-SCOPE actor is scoped instead.
 *   - `actorInScope` — scoped to `sourceOrgUnit`, holds the link
 *     permission plus the target's view permission. Used only to create
 *     the pre-existing link the unlink scenario needs.
 *   - `actorOutOfScope` — scoped to `otherOrgUnit` ONLY, but holds the
 *     EXACT SAME permissions as `actorInScope`. Any refusal this actor
 *     receives is therefore attributable to organizational scope alone,
 *     never to a missing permission or an out-of-scope TARGET (the
 *     target is always placed inside `sourceOrgUnit` — in scope for
 *     `actorInScope` and irrelevant to `actorOutOfScope`'s refusal, since
 *     the source check runs strictly before the target check).
 */
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

        // Both refusals are the SAME error class, following the SAME
        // message template — never raw string equality between the two
        // messages, which necessarily differ (each embeds the id the
        // caller itself supplied). This is the same reasoning
        // `risk-scope.spec.ts` documents for its own `detail` comparison:
        // echoing back an id the client already typed discloses nothing.
        expect(outOfScopeError).toBeInstanceOf(NotFoundDomainError);
        expect(nonexistentError).toBeInstanceOf(NotFoundDomainError);
        expect((outOfScopeError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${scenario.sourceId} não foi encontrado(a).`,
        );
        expect((nonexistentError as NotFoundDomainError).message).toBe(
          `${scenario.sourceEntityLabel} ${nonexistentId} não foi encontrado(a).`,
        );

        // Control: the SAME actor CAN list when scoped correctly — proves
        // the refusal above is genuinely about scope, not e.g. a
        // permission the fixture forgot to grant.
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

        // The row-count proof: an error of the right TYPE is not, by
        // itself, proof that nothing was written.
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

        // Never unlinked — the row this actor was never allowed to reach.
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
