import { randomUUID } from 'node:crypto';

import { PrismaClient, RiskLevel, RiskStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OrgScopeRepositoryPort } from '../../src/core/organizations/domain/ports/org-scope-repository.port';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { ListRisksUseCase } from '../../src/modules/risk/application/list-risks.usecase';
import { RiskQueryService } from '../../src/modules/risk/infrastructure/risk-query.service';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { TEST_DATABASE_URL, uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { RiskQueryPort } from '../../src/modules/risk/domain/ports/risk-query.port';

describe('Risk register — combined filter, search and sort correctness (T102, FR-087, FR-088, FR-089)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let listRisksUseCase: ListRisksUseCase;
  let actorId: string;
  let orgUnitId: string;
  let marker: string;

  const riskIds: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    listRisksUseCase = ctx.app.get(ListRisksUseCase);

    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-query-org'),
    });
    orgUnitId = orgUnit.id;

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-query-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    actorId = actor.id;
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:view', 'risk:create'], {
      name: `fixture-risk-query-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-query-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    marker = uniqueTestMarker('QUERYMARK').toUpperCase().replace(/-/g, '');

    async function seed(
      key: string,
      overrides: { title: string; description?: string },
      dbOverrides: {
        status?: RiskStatus;
        residualLevel?: RiskLevel;
        inherentLevel?: RiskLevel;
        nextReviewOn?: Date | null;
      },
    ): Promise<void> {
      const risk = await createRiskUseCase.execute({
        actorUserId: actor.id,
        title: overrides.title,
        description: overrides.description ?? `Descrição ${marker}.`,
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      });
      riskIds[key] = risk.id;
      if (Object.keys(dbOverrides).length > 0) {
        await ctx.prisma.client.risk.update({ where: { id: risk.id }, data: dbOverrides });
      }
    }

    await seed(
      'a-draft-high-match',
      { title: `Alfa ${marker} risco de acesso` },
      {
        status: RiskStatus.DRAFT,
        residualLevel: RiskLevel.HIGH,
        inherentLevel: RiskLevel.CRITICAL,
      },
    );
    await seed(
      'b-draft-high-match',
      { title: `Beta ${marker} risco de acesso` },
      { status: RiskStatus.DRAFT, residualLevel: RiskLevel.HIGH, inherentLevel: RiskLevel.LOW },
    );
    await seed(
      'c-draft-low-match',
      { title: `Gama ${marker} risco de acesso` },
      { status: RiskStatus.DRAFT, residualLevel: RiskLevel.LOW, inherentLevel: RiskLevel.HIGH },
    );
    await seed(
      'd-identified-high-match',
      { title: `Delta ${marker} risco de acesso` },
      {
        status: RiskStatus.IDENTIFIED,
        residualLevel: RiskLevel.HIGH,
        inherentLevel: RiskLevel.HIGH,
      },
    );
    await seed(
      'e-draft-high-nomatch',
      { title: 'Épsilon sem relação alguma', description: 'Nada a ver com o marcador.' },
      { status: RiskStatus.DRAFT, residualLevel: RiskLevel.HIGH },
    );
    await seed(
      'f-overdue-review',
      { title: `Fita ${marker} revisão vencida` },
      { status: RiskStatus.DRAFT, nextReviewOn: new Date('2000-01-01T00:00:00.000Z') },
    );
    await seed(
      'g-future-review',
      { title: `Gama-dois ${marker} revisão futura` },
      { status: RiskStatus.DRAFT, nextReviewOn: new Date('2999-01-01T00:00:00.000Z') },
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('combines status + risk level (residual, the default basis) + search, in one AND — order by title asc', async () => {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.DRAFT],
      riskLevel: [RiskLevel.HIGH],
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'title',
      sortDirection: 'asc',
    });

    expect(result.items.map((row) => row.id)).toEqual([
      riskIds['a-draft-high-match'],
      riskIds['b-draft-high-match'],
    ]);
    expect(result.total).toBe(2);
  });

  it('riskLevelBasis=INHERENT filters by the inherent column instead of residual — a different result set from the default', async () => {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.DRAFT],
      riskLevel: [RiskLevel.HIGH],
      riskLevelBasis: 'INHERENT',
      includeDescendants: true,
      sortField: 'code',
      sortDirection: 'asc',
    });

    expect(result.items.map((row) => row.id)).toEqual([riskIds['c-draft-low-match']]);
  });

  it('a status filter that matches nothing in combination returns an empty page with total 0, not an error (US3 AS7)', async () => {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.ACCEPTED],
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'code',
      sortDirection: 'asc',
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('overdueReview restricts to risks whose next review date has passed, computed on read (FR-070)', async () => {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      overdueReview: true,
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'code',
      sortDirection: 'asc',
    });

    expect(result.items.map((row) => row.id)).toEqual([riskIds['f-overdue-review']]);
    expect(result.items[0]?.overdueReview).toBe(true);
  });

  it('descending sort reverses the order while the tiebreaker keeps it well-defined', async () => {
    const asc = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.DRAFT],
      riskLevel: [RiskLevel.HIGH],
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'title',
      sortDirection: 'asc',
    });
    const desc = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.DRAFT],
      riskLevel: [RiskLevel.HIGH],
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'title',
      sortDirection: 'desc',
    });

    expect(desc.items.map((row) => row.id)).toEqual([...asc.items.map((row) => row.id)].reverse());
  });

  it('issues one SQL statement to list a full page — no N+1 resolving category/orgUnit/owner (CLAUDE.md verification item 8)', async () => {
    let queryCount = 0;
    const loggingClient = new PrismaClient({
      datasourceUrl: TEST_DATABASE_URL,
      log: [{ emit: 'event', level: 'query' }],
    });
    (loggingClient as unknown as { $on: (event: string, cb: () => void) => void }).$on(
      'query',
      () => {
        queryCount += 1;
      },
    );

    try {
      const fakePrismaService = { client: loggingClient } as unknown as PrismaService;
      const orgScopeRepository = ctx.app.get(OrgScopeRepositoryPort);
      const queryService: RiskQueryPort = new RiskQueryService(
        fakePrismaService,
        orgScopeRepository,
      );

      const page = await queryService.listRegister({
        scope: { kind: 'UNIT', unitIds: new Set([orgUnitId]) },
        filters: { q: marker, riskLevelBasis: 'RESIDUAL', includeDescendants: true },
        sort: { field: 'code', direction: 'asc' },
        page: 1,
        pageSize: 50,
      });

      expect(page.items.length).toBeGreaterThan(0);
      for (const row of page.items) {
        expect(row.orgUnit.id).toBeTruthy();
        expect(row.owner.id).toBeTruthy();
      }
      expect(queryCount).toBe(1);
    } finally {
      await loggingClient.$disconnect();
    }
  });
});

describe('Risk register — sort=owner orders by display name, pt-BR-correct (FR-087)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let listRisksUseCase: ListRisksUseCase;
  let actorId: string;
  let marker: string;

  const OWNER_ZOE_ID = '00000000-0000-0000-0000-0000000000f1';
  const OWNER_ALVARO_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
  const OWNER_CARLOS_ID = '77777777-7777-7777-7777-777777777773';

  let ownerZoeName: string;
  let ownerAlvaroName: string;
  let ownerCarlosName: string;

  const riskIds: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    listRisksUseCase = ctx.app.get(ListRisksUseCase);

    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('risk-query-owner-sort-org'),
    });

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('risk-query-owner-sort-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    actorId = actor.id;
    const role = await createRoleWithPermissionsFixture(ctx.prisma, ['risk:view', 'risk:create'], {
      name: `fixture-risk-query-owner-sort-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    marker = uniqueTestMarker('OWNERSORT').toUpperCase().replace(/-/g, '');
    ownerZoeName = `Zoe ${marker}`;
    ownerAlvaroName = `Álvaro ${marker}`;
    ownerCarlosName = `Carlos ${marker}`;

    const ownerZoe = await createUserFixture(ctx.prisma, {
      id: OWNER_ZOE_ID,
      fullName: ownerZoeName,
      email: `${uniqueTestMarker('risk-query-owner-zoe')}@example.test`,
    });
    const ownerAlvaro = await createUserFixture(ctx.prisma, {
      id: OWNER_ALVARO_ID,
      fullName: ownerAlvaroName,
      email: `${uniqueTestMarker('risk-query-owner-alvaro')}@example.test`,
    });
    const ownerCarlos = await createUserFixture(ctx.prisma, {
      id: OWNER_CARLOS_ID,
      fullName: ownerCarlosName,
      email: `${uniqueTestMarker('risk-query-owner-carlos')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.prisma, { user: ownerZoe, orgUnitId: orgUnit.id });
    await makeRiskAssignmentVisible(ctx.prisma, { user: ownerAlvaro, orgUnitId: orgUnit.id });
    await makeRiskAssignmentVisible(ctx.prisma, { user: ownerCarlos, orgUnitId: orgUnit.id });

    async function seed(key: string, ownerId: string): Promise<void> {
      const risk = await createRiskUseCase.execute({
        actorUserId: actor.id,
        title: `Risco ${marker} ${key}`,
        description: `Descrição ${marker} ${key}.`,
        orgUnitId: orgUnit.id,
        ownerUserId: ownerId,
      });
      riskIds[key] = risk.id;
    }

    await seed('zoe-1', ownerZoe.id);
    await seed('alvaro-1', ownerAlvaro.id);
    await seed('carlos-1', ownerCarlos.id);
    await seed('carlos-2', ownerCarlos.id);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function listByOwner(
    direction: 'asc' | 'desc',
    page = 1,
    pageSize = 50,
  ): Promise<{ names: string[]; ids: string[]; total: number }> {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page,
      pageSize,
      q: marker,
      riskLevelBasis: 'RESIDUAL',
      includeDescendants: true,
      sortField: 'owner',
      sortDirection: direction,
    });
    return {
      names: result.items.map((row) => row.owner.fullName),
      ids: result.items.map((row) => row.id),
      total: result.total,
    };
  }

  it('orders ascending by the owner display name, pt-BR-correct — not by the owner id (FR-087)', async () => {
    const { names, ids, total } = await listByOwner('asc');

    expect(total).toBe(4);
    expect(names).toEqual([ownerAlvaroName, ownerCarlosName, ownerCarlosName, ownerZoeName]);
    expect(ids[0]).toBe(riskIds['alvaro-1']);
    expect(ids[3]).toBe(riskIds['zoe-1']);
  });

  it('breaks ties on the same owner by `code`, ascending, without duplicates across pages', async () => {
    const page1 = await listByOwner('asc', 1, 1);
    const page2 = await listByOwner('asc', 2, 1);
    const page3 = await listByOwner('asc', 3, 1);

    expect(page2.names).toEqual([ownerCarlosName]);
    expect(page3.names).toEqual([ownerCarlosName]);
    expect(page2.ids[0]).toBe(riskIds['carlos-1']);
    expect(page3.ids[0]).toBe(riskIds['carlos-2']);
    expect(page1.ids[0]).not.toBe(page2.ids[0]);
    expect(page2.ids[0]).not.toBe(page3.ids[0]);
  });

  it('order=desc reverses the owner-name order while keeping the tiebreaker well-defined', async () => {
    const asc = await listByOwner('asc');
    const desc = await listByOwner('desc');

    expect(desc.names).toEqual([...asc.names].reverse());
    expect(desc.ids).toEqual([...asc.ids].reverse());
  });
});

describe('Diagnostic guard — ICU collation required by RiskQueryService.SORT_COLUMNS.owner', () => {
  it('fails with an explicit message naming the file/constant if the database lacks the "pt-BR-x-icu" ICU collation', async () => {
    const client = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
    try {
      const rows = await client.$queryRaw<{ collname: string }[]>`
        SELECT collname FROM pg_collation WHERE collname = 'pt-BR-x-icu'
      `;

      if (rows.length === 0) {
        throw new Error(
          'Missing PostgreSQL ICU collation "pt-BR-x-icu" on this database. ' +
            "backend/src/modules/risk/infrastructure/risk-query.service.ts's " +
            'SORT_COLUMNS.owner constant sorts by `owner.full_name COLLATE "pt-BR-x-icu"`, and ' +
            '`pg_collation` reports no such collation here. GET /risks?sort=owner will fail at ' +
            'query time with a bare "collation ... does not exist" error until this database is ' +
            "rebuilt with ICU collation support (see SORT_COLUMNS.owner's comment in that file " +
            'for why the collation was chosen and why it was expected to be present).',
        );
      }

      expect(rows).toHaveLength(1);
    } finally {
      await client.$disconnect();
    }
  });
});
