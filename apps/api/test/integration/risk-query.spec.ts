/**
 * T102 — combined filter, search and sort correctness against the real
 * test database (US3, `ListRisksUseCase`/`RiskQueryService`).
 *
 * CLAUDE.md is explicit that testing one filter at a time is not enough —
 * "a combinação é onde o bug mora" — so every scenario below applies AT
 * LEAST a status filter, a risk-level filter and a search term together,
 * and asserts the exact set AND order of the surviving rows, not just
 * "some rows came back".
 *
 * `inherentLevel`/`residualLevel`/`inherentScore`/`residualScore` are
 * written here directly through `ctx.prisma.client.risk.update(...)`
 * rather than through an assessment use case — US4 (assessment) is out of
 * scope for this task (CLAUDE.md's explicit boundary) and does not exist
 * yet. This is legitimate because T102's subject is the REGISTER's read
 * side: given values in those columns (however they got there), does
 * filtering/sorting/`riskLevelBasis` behave correctly. `data-model.md` §8
 * itself describes these columns as "a denormalization ... maintained in
 * the same transaction" by a later use case; this test exercises the
 * reader, not the writer.
 */
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

  /** Ids keyed by a short mnemonic so assertions read as intent, not UUIDs. */
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
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(ctx.prisma, { user: owner, orgUnitId: orgUnit.id });

    // `marker` makes every seeded title/description uniquely findable by
    // `q`, isolating this suite's assertions from any other risk that
    // might exist in the (shared, never-truncated) `risks` table.
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

    // Deliberately varied on every axis a combined filter can touch, so a
    // query that silently drops a predicate (AND becoming OR, or one
    // filter overriding another instead of combining) produces a WRONG
    // set, not coincidentally the right one.
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
      'c-draft-low-match', // wrong risk level — must be excluded by the HIGH filter
      { title: `Gama ${marker} risco de acesso` },
      { status: RiskStatus.DRAFT, residualLevel: RiskLevel.LOW, inherentLevel: RiskLevel.HIGH },
    );
    await seed(
      'd-identified-high-match', // wrong status — must be excluded by the DRAFT filter
      { title: `Delta ${marker} risco de acesso` },
      {
        status: RiskStatus.IDENTIFIED,
        residualLevel: RiskLevel.HIGH,
        inherentLevel: RiskLevel.HIGH,
      },
    );
    await seed(
      'e-draft-high-nomatch', // wrong text — must be excluded by the search term
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

    // Only rows satisfying ALL THREE predicates together: DRAFT status,
    // RESIDUAL level HIGH, and the search marker in the text.
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

    // 'a' has inherent CRITICAL (excluded), 'b' has inherent LOW (excluded),
    // 'c' has inherent HIGH (residual LOW — excluded under RESIDUAL, but
    // matches here) — proving the basis switch changes which column is
    // actually consulted, not just which risks happen to match.
    expect(result.items.map((row) => row.id)).toEqual([riskIds['c-draft-low-match']]);
  });

  it('a status filter that matches nothing in combination returns an empty page with total 0, not an error (US3 AS7)', async () => {
    const result = await listRisksUseCase.execute({
      actorUserId: actorId,
      page: 1,
      pageSize: 50,
      q: marker,
      status: [RiskStatus.ACCEPTED], // none of the seeded rows are ACCEPTED
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

  /**
   * N+1 proof (CLAUDE.md verification item 8): a page of 50 rows resolves
   * category/orgUnit/owner/responsible via the JOINs already in
   * `RiskQueryService`'s single statement, never one query per row. A
   * SEPARATE `PrismaClient` with query-event logging enabled is used here
   * (rather than the shared `PrismaService`, which does not enable Prisma's
   * `log: [{emit: 'event', level: 'query'}]` option in production — adding
   * it there would be a production behavior change this task does not
   * need) pointed at the SAME test database, running the exact same
   * `RiskQueryService` implementation.
   */
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
      // Every relation the row needs (category/orgUnit/owner/responsible)
      // must already be populated — proof the JOINs actually ran, not
      // just that the count stayed low by coincidence.
      for (const row of page.items) {
        expect(row.orgUnit.id).toBeTruthy();
        expect(row.owner.id).toBeTruthy();
      }
      // Exactly one statement for the data (the window-function query);
      // the empty-page COUNT(*) fallback is not reached here since this
      // page has rows.
      expect(queryCount).toBe(1);
    } finally {
      await loggingClient.$disconnect();
    }
  });
});

/**
 * `sort=owner` orders by the owner's DISPLAY NAME (`owner.full_name`), not
 * the owner's opaque `owner_user_id`, and does so with pt-BR-correct
 * (accent-aware) ordering — see `RiskQueryService`'s `SORT_COLUMNS.owner`
 * comment for the collation reasoning and the measured performance cost.
 *
 * Owner ids are deliberately assigned so that UUID order and display-name
 * order DISAGREE: `ownerZoe`'s id sorts first among UUIDs while `Zoe`'s
 * name sorts LAST among these names, and vice versa for `ownerAlvaro`. A
 * test asserting only "some order came back" would pass against the old
 * (id-based) implementation too — asserting the actual owner names in the
 * response, in this specific sequence, is what makes these tests fail
 * against the pre-existing `r.owner_user_id` sort.
 */
describe('Risk register — sort=owner orders by display name, pt-BR-correct (FR-087)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let listRisksUseCase: ListRisksUseCase;
  let actorId: string;
  let marker: string;

  /** Small UUID — sorts FIRST by `owner_user_id`, even though `Zoe`'s name
   * sorts LAST among this suite's owners. */
  const OWNER_ZOE_ID = '00000000-0000-0000-0000-0000000000f1';
  /** Large UUID — sorts LAST by `owner_user_id`, even though `Álvaro`'s
   * name sorts FIRST among this suite's owners (and, under plain byte/`C`
   * ordering, an accented name like `Álvaro` would ALSO sort after `Zoe` —
   * this id/name pairing catches both regressions at once). */
  const OWNER_ALVARO_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
  /** Mid-range UUID, used only for the tie/pagination test below. */
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
    // F-CV-2: all three are pure preconditions (this test's subject is
    // SORTING by owner name, never their own permissions).
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

    // One risk each for Zoe and Álvaro (the accent/UUID-disagreement
    // case), and TWO risks for Carlos, created in a known order, to prove
    // the `code` tiebreaker still applies among risks sharing one owner.
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
    // Álvaro's id sorts LAST but the name sorts FIRST; Zoe's id sorts
    // FIRST but the name sorts LAST. Under the old `r.owner_user_id` sort
    // this would come back Zoe, Carlos, Carlos, Álvaro — the REVERSE
    // ordering of owner names — so this assertion fails against it.
    expect(names).toEqual([ownerAlvaroName, ownerCarlosName, ownerCarlosName, ownerZoeName]);
    expect(ids[0]).toBe(riskIds['alvaro-1']);
    expect(ids[3]).toBe(riskIds['zoe-1']);
  });

  it('breaks ties on the same owner by `code`, ascending, without duplicates across pages', async () => {
    const page1 = await listByOwner('asc', 1, 1);
    // Carlos owns two of the four risks; with pageSize=1 the two Carlos
    // rows land on consecutive pages (positions 2 and 3 overall).
    const page2 = await listByOwner('asc', 2, 1);
    const page3 = await listByOwner('asc', 3, 1);

    expect(page2.names).toEqual([ownerCarlosName]);
    expect(page3.names).toEqual([ownerCarlosName]);
    // `code` is a strictly increasing per-year sequence (domain/risk-code.ts)
    // — creation order 'carlos-1' then 'carlos-2' means 'carlos-1' has the
    // lower code and must come first within the tie.
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

/**
 * Diagnostic guard, not a functional test: `RiskQueryService`'s
 * `SORT_COLUMNS.owner` (`apps/api/src/modules/risk/infrastructure/
 * risk-query.service.ts`) hardcodes `owner.full_name COLLATE
 * "pt-BR-x-icu"`. That collation is expected to exist on any PostgreSQL
 * built with ICU support — this machine's native PostgreSQL 18 and the
 * `postgres:17-alpine` image `docker-compose.test.yml`/CI use both should
 * qualify — but it cannot be verified against the CI/Docker image from this
 * machine (Docker is not installed here, see docs/local-environment.md
 * D-1). If that assumption is ever wrong, `GET /risks?sort=owner` would
 * fail with a bare `collation "pt-BR-x-icu" for encoding "UTF8" does not
 * exist` PostgreSQL error, with nothing pointing a reader at the cause.
 * This test turns that into an explicit, actionable failure instead.
 */
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
            "apps/api/src/modules/risk/infrastructure/risk-query.service.ts's " +
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
