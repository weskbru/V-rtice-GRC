/**
 * Minimal, composable fixtures for integration tests (T031/T032 harness
 * deliverable: "the minimum rows other phases will need — a user, an org
 * unit"). Deliberately not a fake dataset: each function creates exactly
 * one row, using the real `PrismaService` (so it participates in the
 * caller's ambient transaction via `prisma.client`, exactly like
 * production code would), with sensible defaults and every field
 * overridable.
 *
 * Every fixture defaults its unique fields (`email`, `code`) to a fresh
 * `randomUUID()`-derived value, so tests never need a global reset between
 * them to avoid unique-constraint collisions — consistent with this
 * harness's "unique marker, not empty table" isolation strategy (see
 * support/database-roles.ts).
 */
import { randomUUID } from 'node:crypto';

import {
  OrgUnitStatus,
  UserStatus,
  type LocalCredential,
  type OrganizationalUnit,
  type Prisma,
  type RiskMethodology,
  type RiskMethodologyVersion,
  type User,
} from '@prisma/client';
import * as argon2 from 'argon2';

import type { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import type {
  LevelBandConfig,
  MatrixCellConfig,
  ScalePointConfig,
} from '../../../src/modules/risk/domain/methodology.schema';

export interface UserFixtureOverrides {
  readonly id?: string;
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string;
  readonly status?: UserStatus;
  readonly primaryOrgUnitId?: string;
}

export async function createUserFixture(
  prisma: PrismaService,
  overrides: UserFixtureOverrides = {},
): Promise<User> {
  const id = overrides.id ?? randomUUID();

  return prisma.client.user.create({
    data: {
      id,
      email: overrides.email ?? `fixture-user-${id}@example.test`,
      fullName: overrides.fullName ?? 'Fixture User',
      jobTitle: overrides.jobTitle ?? null,
      status: overrides.status ?? UserStatus.ACTIVE,
      primaryOrgUnitId: overrides.primaryOrgUnitId ?? null,
    },
  });
}

export interface OrganizationalUnitFixtureOverrides {
  readonly id?: string;
  readonly code?: string;
  readonly name?: string;
  readonly parentId?: string;
  readonly path?: string;
  readonly depth?: number;
  readonly status?: OrgUnitStatus;
}

/**
 * Creates a root-level organizational unit (no parent) by default. A
 * caller building a hierarchy passes `parentId`/`path`/`depth` explicitly
 * — this fixture does not attempt to maintain the materialized path
 * across a whole subtree (ADR-004's maintenance rule is application
 * logic, not test-fixture responsibility).
 */
export async function createOrgUnitFixture(
  prisma: PrismaService,
  overrides: OrganizationalUnitFixtureOverrides = {},
): Promise<OrganizationalUnit> {
  const id = overrides.id ?? randomUUID();
  const code = overrides.code ?? `fixture-org-${id}`;

  return prisma.client.organizationalUnit.create({
    data: {
      id,
      code,
      name: overrides.name ?? 'Fixture Organizational Unit',
      parentId: overrides.parentId ?? null,
      path: overrides.path ?? `/${id}/`,
      depth: overrides.depth ?? 0,
      status: overrides.status ?? OrgUnitStatus.ACTIVE,
    },
  });
}

/** The plaintext password every `createLocalUserFixture` call hashes by
 * default (T050-T055 test fixtures) — never a real secret, this is a
 * throwaway per-test-database value. Deliberately meets the seeded
 * password policy (min length 12, three character classes) so tests that
 * exercise policy-adjacent behavior are not tripped up by the fixture's own
 * password failing validation. */
export const FIXTURE_USER_PASSWORD = 'Fixture-Passw0rd!';

export interface LocalUserFixtureOverrides extends UserFixtureOverrides {
  readonly password?: string;
  readonly mustChangePassword?: boolean;
  readonly failedAttempts?: number;
  readonly lockedUntil?: Date | null;
}

export interface LocalUserFixture {
  readonly user: User;
  readonly credential: LocalCredential;
  readonly rawPassword: string;
}

/** Creates a `User` + `LocalCredential` pair with a real argon2id hash
 * (fixed, low cost parameters — fast enough for tests, no bearing on the
 * cost parameters the running application uses in `apps/api/.env`, since
 * the stored hash is self-describing) so login-flow tests can authenticate
 * against a real, verifiable credential rather than a stubbed hash. */
export async function createLocalUserFixture(
  prisma: PrismaService,
  overrides: LocalUserFixtureOverrides = {},
): Promise<LocalUserFixture> {
  const user = await createUserFixture(prisma, overrides);
  const rawPassword = overrides.password ?? FIXTURE_USER_PASSWORD;
  const passwordHash = await argon2.hash(rawPassword, { type: argon2.argon2id });

  const credential = await prisma.client.localCredential.create({
    data: {
      userId: user.id,
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: overrides.mustChangePassword ?? false,
      failedAttempts: overrides.failedAttempts ?? 0,
      lockedUntil: overrides.lockedUntil ?? null,
    },
  });

  return { user, credential, rawPassword };
}

const DEFAULT_SCALE: readonly ScalePointConfig[] = [1, 2, 3, 4, 5].map((value) => ({
  value,
  label: `P${String(value)}`,
}));

const DEFAULT_LEVEL_BANDS: readonly LevelBandConfig[] = [
  { level: 'LOW', minScore: 1, maxScore: 4 },
  { level: 'MEDIUM', minScore: 5, maxScore: 9 },
  { level: 'HIGH', minScore: 10, maxScore: 15 },
  { level: 'CRITICAL', minScore: 16, maxScore: 25 },
];

function levelForScore(score: number, bands: readonly LevelBandConfig[]) {
  const band = bands.find((b) => score >= b.minScore && score <= b.maxScore);
  if (!band) {
    throw new Error(`fixtures: no band covers score=${String(score)}`);
  }
  return band.level;
}

function buildDefaultMatrix(bands: readonly LevelBandConfig[]): readonly MatrixCellConfig[] {
  return DEFAULT_SCALE.flatMap((p) =>
    DEFAULT_SCALE.map((i) => ({
      probability: p.value,
      impact: i.value,
      score: p.value * i.value,
      level: levelForScore(p.value * i.value, bands),
    })),
  );
}

export interface MethodologyVersionFixtureOverrides {
  readonly probabilityScale?: readonly ScalePointConfig[];
  readonly impactScale?: readonly ScalePointConfig[];
  readonly matrix?: readonly MatrixCellConfig[];
  readonly levelBands?: readonly LevelBandConfig[];
  readonly effectiveFrom?: Date;
}

/**
 * T116/T117 (US4) — `RiskMethodology.isActive` is enforced by a GLOBAL
 * partial unique index (data-model.md §7: "exactly one active"), which is
 * NOT per-test-scoped the way a fixture's `email`/`code` uniqueness is —
 * this harness truncates `risk_methodologies` only ONCE, in
 * `global-setup.ts`, before the whole integration run starts (see
 * `database-roles.ts`'s own doc comment), so a second test file naively
 * creating a second `isActive: true` row would collide with whichever ran
 * first.
 *
 * This fixture is therefore idempotent for the METHODOLOGY itself — reusing
 * the existing active one if any test has already created it — and always
 * adds a fresh VERSION under it (append-only, so a fresh version per call
 * is exactly what production code does on every "publish" too). Each test
 * gets its own new version to assert against; none needs its own private
 * methodology.
 */
export async function createMethodologyVersionFixture(
  prisma: PrismaService,
  createdByUserId: string,
  overrides: MethodologyVersionFixtureOverrides = {},
): Promise<{ methodology: RiskMethodology; version: RiskMethodologyVersion }> {
  let methodology = await prisma.client.riskMethodology.findFirst({ where: { isActive: true } });
  methodology ??= await prisma.client.riskMethodology.create({
    data: { name: `fixture-methodology-${randomUUID()}`, isActive: true },
  });

  const latest = await prisma.client.riskMethodologyVersion.findFirst({
    where: { methodologyId: methodology.id },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

  const levelBands = overrides.levelBands ?? DEFAULT_LEVEL_BANDS;
  const version = await prisma.client.riskMethodologyVersion.create({
    data: {
      methodologyId: methodology.id,
      versionNumber: nextVersionNumber,
      // Same "genuinely required once checked against Prisma's stricter
      // JSON input type" cast as `methodology.seed.ts` — see that file's
      // comment for why `as unknown as object` (what `eslint`'s
      // type-aware rule suggests) does not actually satisfy `tsc`.
      probabilityScale: (overrides.probabilityScale ??
        DEFAULT_SCALE) as unknown as Prisma.InputJsonValue,
      impactScale: (overrides.impactScale ?? DEFAULT_SCALE) as unknown as Prisma.InputJsonValue,
      matrix: (overrides.matrix ??
        buildDefaultMatrix(levelBands)) as unknown as Prisma.InputJsonValue,
      levelBands: levelBands as unknown as Prisma.InputJsonValue,
      effectiveFrom: overrides.effectiveFrom ?? new Date(),
      createdByUserId,
    },
  });

  return { methodology, version };
}
