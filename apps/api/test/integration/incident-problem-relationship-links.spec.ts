/**
 * 008-incidents-problems, US3 — the five domain relationships
 * (Incident->Risk, Incident->Asset, Incident->Process, Problem->Risk,
 * Problem->Incident N:M) ALL follow the identical pattern this repository
 * has now had to fix four separate times (coordinator, 2026-09-11):
 *
 *   - ADR-020 part 5 — BOTH the "link" permission on the source AND the
 *     "view" permission on the target are checked, from the first line.
 *   - ADR-020 part 4 — the target's organizational scope is verified
 *     against its LIVE unit before any row is written; a target outside
 *     scope answers EXACTLY like a target that does not exist at all.
 *   - Every link/unlink is audited with its OWN `AuditEntityType`.
 *   - Unlinking preserves history (stamps `unlinkedAt`) rather than
 *     deleting the row.
 *
 * This suite proves each of the four GENERALIZES across all five pairs,
 * not for one and by assertion for the rest (this project's own
 * engineering rule — a single-instance fix has already left siblings
 * broken twice). Refusal proofs are checked by COUNTING rows before and
 * after (never by asserting only the error's type, which cannot by itself
 * show that nothing was written) — the same discipline
 * `finding-risk-link.spec.ts` established for its own single pair.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import {
  LinkIncidentAssetUseCase,
  UnlinkIncidentAssetUseCase,
} from '../../src/modules/incidents/application/links/link-incident-asset.usecase';
import {
  LinkIncidentProcessUseCase,
  UnlinkIncidentProcessUseCase,
} from '../../src/modules/incidents/application/links/link-incident-process.usecase';
import {
  LinkIncidentRiskUseCase,
  UnlinkIncidentRiskUseCase,
} from '../../src/modules/incidents/application/links/link-incident-risk.usecase';
import { IncidentDirectoryModule } from '../../src/modules/incidents/incident-directory.module';
import { IncidentsModule } from '../../src/modules/incidents/incidents.module';
import {
  LinkProblemIncidentUseCase,
  UnlinkProblemIncidentUseCase,
} from '../../src/modules/problems/application/links/link-problem-incident.usecase';
import {
  LinkProblemRiskUseCase,
  UnlinkProblemRiskUseCase,
} from '../../src/modules/problems/application/links/link-problem-risk.usecase';
import { ProblemsModule } from '../../src/modules/problems/problems.module';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';
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

interface LinkScenario {
  readonly notFoundMessage: string;
  readonly outOfScopeTargetId: string;
  readonly inScopeTargetId: string;
  readonly entityType: AuditEntityType;
  readonly linkedAction: string;
  readonly unlinkedAction: string;
  /** Uses the actor that holds BOTH the link permission on the source and
   * the view permission on the target. */
  attemptLinkWithView(targetId: string): Promise<LinkedRecord>;
  /** Uses a SEPARATE actor that holds the link permission but NOT the
   * view permission on the target (ADR-020 part 5). */
  attemptLinkNoView(targetId: string): Promise<LinkedRecord>;
  unlink(linkId: string): Promise<LinkedRecord>;
  countLinks(): Promise<number>;
  findLinkRow(
    linkId: string,
  ): Promise<{ unlinkedAt: Date | null; unlinkedByUserId: string | null } | null>;
}

type ScenarioBuilder = (ctx: IntegrationTestContext) => Promise<LinkScenario>;

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
      code: uniqueTestMarker('inc-for-link'),
      orgUnitId,
      title: 'Incidente para vínculo',
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
      code: uniqueTestMarker('prb-for-link'),
      orgUnitId,
      title: 'Problema para vínculo',
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
      code: uniqueTestMarker('risk-for-link'),
      title: 'Risco para vínculo',
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
      code: uniqueTestMarker('asset-for-link'),
      name: 'Ativo para vínculo',
      orgUnitId,
    },
  });
}

async function createProcessFixture(ctx: IntegrationTestContext, orgUnitId: string) {
  return ctx.prisma.client.process.create({
    data: {
      code: uniqueTestMarker('process-for-link'),
      name: 'Processo para vínculo',
      orgUnitId,
    },
  });
}

const buildIncidentRiskScenario: ScenarioBuilder = async (ctx) => {
  const orgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-risk-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-risk-other-org'),
  });
  const actorWithView = await setupActor(ctx, 'inc-risk-actor', orgUnit, [
    'incident:link',
    'risk:view',
  ]);
  const actorNoView = await setupActor(ctx, 'inc-risk-noview-actor', orgUnit, ['incident:link']);
  const incident = await createIncidentFixture(ctx, orgUnit.id, actorWithView.id);
  const outOfScopeRisk = await createRiskFixture(ctx, otherOrgUnit.id, actorWithView.id);
  const inScopeRisk = await createRiskFixture(ctx, orgUnit.id, actorWithView.id);
  const linkUseCase = ctx.app.get(LinkIncidentRiskUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentRiskUseCase);

  return {
    notFoundMessage: USER_MESSAGES.incidents.link.riskNotFound,
    outOfScopeTargetId: outOfScopeRisk.id,
    inScopeTargetId: inScopeRisk.id,
    entityType: AuditEntityType.INCIDENT_RISK_LINK,
    linkedAction: 'incident_risk_link.linked',
    unlinkedAction: 'incident_risk_link.unlinked',
    attemptLinkWithView: (riskId) =>
      linkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, riskId }),
    attemptLinkNoView: (riskId) =>
      linkUseCase.execute({ actorUserId: actorNoView.id, incidentId: incident.id, riskId }),
    unlink: (linkId) =>
      unlinkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, linkId }),
    countLinks: () =>
      ctx.prisma.client.incidentRiskLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentRiskLink.findUnique({ where: { id: linkId } }),
  };
};

const buildIncidentAssetScenario: ScenarioBuilder = async (ctx) => {
  const orgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-asset-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-asset-other-org'),
  });
  const actorWithView = await setupActor(ctx, 'inc-asset-actor', orgUnit, [
    'incident:link',
    'asset:view',
  ]);
  const actorNoView = await setupActor(ctx, 'inc-asset-noview-actor', orgUnit, ['incident:link']);
  const incident = await createIncidentFixture(ctx, orgUnit.id, actorWithView.id);
  const outOfScopeAsset = await createAssetFixture(ctx, otherOrgUnit.id);
  const inScopeAsset = await createAssetFixture(ctx, orgUnit.id);
  const linkUseCase = ctx.app.get(LinkIncidentAssetUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentAssetUseCase);

  return {
    notFoundMessage: USER_MESSAGES.incidents.link.assetNotFound,
    outOfScopeTargetId: outOfScopeAsset.id,
    inScopeTargetId: inScopeAsset.id,
    entityType: AuditEntityType.INCIDENT_ASSET_LINK,
    linkedAction: 'incident_asset_link.linked',
    unlinkedAction: 'incident_asset_link.unlinked',
    attemptLinkWithView: (assetId) =>
      linkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, assetId }),
    attemptLinkNoView: (assetId) =>
      linkUseCase.execute({ actorUserId: actorNoView.id, incidentId: incident.id, assetId }),
    unlink: (linkId) =>
      unlinkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, linkId }),
    countLinks: () =>
      ctx.prisma.client.incidentAssetLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentAssetLink.findUnique({ where: { id: linkId } }),
  };
};

const buildIncidentProcessScenario: ScenarioBuilder = async (ctx) => {
  const orgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-process-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('inc-process-other-org'),
  });
  const actorWithView = await setupActor(ctx, 'inc-process-actor', orgUnit, [
    'incident:link',
    'process:view',
  ]);
  const actorNoView = await setupActor(ctx, 'inc-process-noview-actor', orgUnit, ['incident:link']);
  const incident = await createIncidentFixture(ctx, orgUnit.id, actorWithView.id);
  const outOfScopeProcess = await createProcessFixture(ctx, otherOrgUnit.id);
  const inScopeProcess = await createProcessFixture(ctx, orgUnit.id);
  const linkUseCase = ctx.app.get(LinkIncidentProcessUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkIncidentProcessUseCase);

  return {
    notFoundMessage: USER_MESSAGES.incidents.link.processNotFound,
    outOfScopeTargetId: outOfScopeProcess.id,
    inScopeTargetId: inScopeProcess.id,
    entityType: AuditEntityType.INCIDENT_PROCESS_LINK,
    linkedAction: 'incident_process_link.linked',
    unlinkedAction: 'incident_process_link.unlinked',
    attemptLinkWithView: (processId) =>
      linkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, processId }),
    attemptLinkNoView: (processId) =>
      linkUseCase.execute({ actorUserId: actorNoView.id, incidentId: incident.id, processId }),
    unlink: (linkId) =>
      unlinkUseCase.execute({ actorUserId: actorWithView.id, incidentId: incident.id, linkId }),
    countLinks: () =>
      ctx.prisma.client.incidentProcessLink.count({ where: { incidentId: incident.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.incidentProcessLink.findUnique({ where: { id: linkId } }),
  };
};

const buildProblemRiskScenario: ScenarioBuilder = async (ctx) => {
  const orgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-risk-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-risk-other-org'),
  });
  const actorWithView = await setupActor(ctx, 'prb-risk-actor', orgUnit, [
    'problem:link',
    'risk:view',
  ]);
  const actorNoView = await setupActor(ctx, 'prb-risk-noview-actor', orgUnit, ['problem:link']);
  const problem = await createProblemFixture(ctx, orgUnit.id, actorWithView.id);
  const outOfScopeRisk = await createRiskFixture(ctx, otherOrgUnit.id, actorWithView.id);
  const inScopeRisk = await createRiskFixture(ctx, orgUnit.id, actorWithView.id);
  const linkUseCase = ctx.app.get(LinkProblemRiskUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkProblemRiskUseCase);

  return {
    notFoundMessage: USER_MESSAGES.problems.link.riskNotFound,
    outOfScopeTargetId: outOfScopeRisk.id,
    inScopeTargetId: inScopeRisk.id,
    entityType: AuditEntityType.PROBLEM_RISK_LINK,
    linkedAction: 'problem_risk_link.linked',
    unlinkedAction: 'problem_risk_link.unlinked',
    attemptLinkWithView: (riskId) =>
      linkUseCase.execute({ actorUserId: actorWithView.id, problemId: problem.id, riskId }),
    attemptLinkNoView: (riskId) =>
      linkUseCase.execute({ actorUserId: actorNoView.id, problemId: problem.id, riskId }),
    unlink: (linkId) =>
      unlinkUseCase.execute({ actorUserId: actorWithView.id, problemId: problem.id, linkId }),
    countLinks: () => ctx.prisma.client.problemRiskLink.count({ where: { problemId: problem.id } }),
    findLinkRow: (linkId) =>
      ctx.prisma.client.problemRiskLink.findUnique({ where: { id: linkId } }),
  };
};

const buildProblemIncidentScenario: ScenarioBuilder = async (ctx) => {
  const orgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-inc-org'),
  });
  const otherOrgUnit = await createOrgUnitFixture(ctx.prisma, {
    code: uniqueTestMarker('prb-inc-other-org'),
  });
  const actorWithView = await setupActor(ctx, 'prb-inc-actor', orgUnit, [
    'problem:link',
    'incident:view',
  ]);
  const actorNoView = await setupActor(ctx, 'prb-inc-noview-actor', orgUnit, ['problem:link']);
  const problem = await createProblemFixture(ctx, orgUnit.id, actorWithView.id);
  const outOfScopeIncident = await createIncidentFixture(ctx, otherOrgUnit.id, actorWithView.id);
  const inScopeIncident = await createIncidentFixture(ctx, orgUnit.id, actorWithView.id);
  const linkUseCase = ctx.app.get(LinkProblemIncidentUseCase);
  const unlinkUseCase = ctx.app.get(UnlinkProblemIncidentUseCase);

  return {
    notFoundMessage: USER_MESSAGES.problems.link.incidentNotFound,
    outOfScopeTargetId: outOfScopeIncident.id,
    inScopeTargetId: inScopeIncident.id,
    entityType: AuditEntityType.PROBLEM_INCIDENT_LINK,
    linkedAction: 'problem_incident_link.linked',
    unlinkedAction: 'problem_incident_link.unlinked',
    attemptLinkWithView: (incidentId) =>
      linkUseCase.execute({ actorUserId: actorWithView.id, problemId: problem.id, incidentId }),
    attemptLinkNoView: (incidentId) =>
      linkUseCase.execute({ actorUserId: actorNoView.id, problemId: problem.id, incidentId }),
    unlink: (linkId) =>
      unlinkUseCase.execute({ actorUserId: actorWithView.id, problemId: problem.id, linkId }),
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

describe('The five domain relationships (008-incidents-problems, US3)', () => {
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
    '%s — ADR-020 part 4: an out-of-scope target and a nonexistent target produce the identical refusal, proved by row count',
    async (_pairName, buildScenario) => {
      const scenario = await buildScenario(ctx);
      const countBefore = await scenario.countLinks();

      let outOfScopeError: unknown;
      try {
        await scenario.attemptLinkWithView(scenario.outOfScopeTargetId);
      } catch (error) {
        outOfScopeError = error;
      }

      let nonexistentError: unknown;
      try {
        await scenario.attemptLinkWithView(randomUUID());
      } catch (error) {
        nonexistentError = error;
      }

      expect(outOfScopeError).toBeInstanceOf(ValidationDomainError);
      expect(nonexistentError).toBeInstanceOf(ValidationDomainError);
      expect((outOfScopeError as ValidationDomainError).message).toBe(
        (nonexistentError as ValidationDomainError).message,
      );
      expect((outOfScopeError as ValidationDomainError).message).toBe(scenario.notFoundMessage);

      // The row-count proof: an error of the right TYPE is not, by itself,
      // proof that nothing was written — this is what actually checks it,
      // for every one of the five pairs, not just one.
      const countAfter = await scenario.countLinks();
      expect(countAfter).toBe(countBefore);
    },
  );

  it.each(PAIRS)(
    '%s — ADR-020 part 5: missing view permission on an IN-SCOPE target is refused identically to nonexistent, proved by row count',
    async (_pairName, buildScenario) => {
      const scenario = await buildScenario(ctx);
      const countBefore = await scenario.countLinks();

      let noViewError: unknown;
      try {
        await scenario.attemptLinkNoView(scenario.inScopeTargetId);
      } catch (error) {
        noViewError = error;
      }

      let nonexistentError: unknown;
      try {
        await scenario.attemptLinkNoView(randomUUID());
      } catch (error) {
        nonexistentError = error;
      }

      expect(noViewError).toBeInstanceOf(ValidationDomainError);
      expect(nonexistentError).toBeInstanceOf(ValidationDomainError);
      expect((noViewError as ValidationDomainError).message).toBe(
        (nonexistentError as ValidationDomainError).message,
      );
      expect((noViewError as ValidationDomainError).message).toBe(scenario.notFoundMessage);

      const countAfter = await scenario.countLinks();
      expect(countAfter).toBe(countBefore);
    },
  );

  it.each(PAIRS)(
    '%s — link and unlink are each audited with their own entity type, and unlinking preserves history (stamps, never deletes)',
    async (_pairName, buildScenario) => {
      const scenario = await buildScenario(ctx);

      const link = await scenario.attemptLinkWithView(scenario.inScopeTargetId);

      const linkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
        where: {
          entityType: scenario.entityType,
          entityId: link.id,
          action: scenario.linkedAction,
        },
      });
      expect(linkAuditEvents).toHaveLength(1);

      const unlinked = await scenario.unlink(link.id);
      expect(unlinked.id).toBe(link.id);

      const rowAfterUnlink = await scenario.findLinkRow(link.id);
      expect(rowAfterUnlink).not.toBeNull();
      expect(rowAfterUnlink?.unlinkedAt).not.toBeNull();
      expect(rowAfterUnlink?.unlinkedByUserId).not.toBeNull();

      // Preserved, not deleted — the row still counts.
      const countAfterUnlink = await scenario.countLinks();
      expect(countAfterUnlink).toBeGreaterThanOrEqual(1);

      const unlinkAuditEvents = await ctx.prisma.client.auditEvent.findMany({
        where: {
          entityType: scenario.entityType,
          entityId: link.id,
          action: scenario.unlinkedAction,
        },
      });
      expect(unlinkAuditEvents).toHaveLength(1);
    },
  );
});
