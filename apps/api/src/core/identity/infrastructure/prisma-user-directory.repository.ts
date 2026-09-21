/**
 * `UserDirectoryPort` implementation (T059, T061, T066, T067). Uses
 * `prisma.client` (ambient-transaction-aware) throughout, so writes made
 * from `AuthOrchestrator`'s `runInTransaction` scope participate in it, and
 * reads made outside one (login lookups, profile reads) use the plain
 * connection.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { applyScopeToWhere } from '../../../shared/persistence/scope-filter';
import {
  UserDirectoryPort,
  type AdminUserRecord,
  type CreateUserRow,
  type DirectoryUserRecord,
  type ListAdminUsersInput,
  type ListAdminUsersResult,
  type ListDirectoryUsersInput,
  type ListDirectoryUsersResult,
  type LocalAuthenticationSubject,
  type LocalCredentialSummary,
  type PreviousProfileFields,
  type UpdateProfileFields,
  type UserIdentitySummary,
  type UserProfile,
} from '../domain/ports/user-directory.port';

import type { AuthenticationMethod, Prisma, UserStatus } from '@prisma/client';

@Injectable()
export class PrismaUserDirectoryRepository extends UserDirectoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAuthenticationSubject(email: string): Promise<LocalAuthenticationSubject | undefined> {
    const credential = await this.prisma.client.localCredential.findFirst({
      where: { user: { email } },
      include: { user: { select: { id: true, status: true, fullName: true, email: true } } },
    });
    if (!credential) {
      return undefined;
    }

    return {
      userId: credential.user.id,
      userStatus: credential.user.status,
      userFullName: credential.user.fullName,
      userEmail: credential.user.email,
      credentialId: credential.id,
      passwordHash: credential.passwordHash,
      failedAttempts: credential.failedAttempts,
      lockedUntil: credential.lockedUntil ?? undefined,
      mustChangePassword: credential.mustChangePassword,
    };
  }

  async findIdentitySummary(userId: string): Promise<UserIdentitySummary | undefined> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, fullName: true, primaryOrgUnitId: true },
    });
    if (!user) {
      return undefined;
    }
    return {
      id: user.id,
      status: user.status,
      fullName: user.fullName,
      primaryOrgUnitId: user.primaryOrgUnitId ?? undefined,
    };
  }

  async findProfileById(userId: string): Promise<UserProfile | undefined> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobTitle: true,
        status: true,
        lastLoginAt: true,
        primaryOrgUnit: { select: { id: true, code: true, name: true } },
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      jobTitle: user.jobTitle ?? undefined,
      status: user.status,
      primaryOrgUnit: user.primaryOrgUnit ?? undefined,
      roles: user.userRoles.map((userRole) => userRole.role),
      lastLoginAt: user.lastLoginAt ?? undefined,
    };
  }

  async findLocalCredentialByUserId(userId: string): Promise<LocalCredentialSummary | undefined> {
    const credential = await this.prisma.client.localCredential.findUnique({
      where: { userId },
      select: { id: true, passwordHash: true },
    });
    return credential
      ? { credentialId: credential.id, passwordHash: credential.passwordHash }
      : undefined;
  }

  async touchLastLoginAt(userId: string, at: Date): Promise<void> {
    await this.prisma.client.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async recordFailedAttempt(
    credentialId: string,
    input: { failedAttempts: number; lockedUntil: Date | undefined },
  ): Promise<void> {
    await this.prisma.client.localCredential.update({
      where: { id: credentialId },
      data: { failedAttempts: input.failedAttempts, lockedUntil: input.lockedUntil ?? null },
    });
  }

  async recordSuccessfulAuthentication(credentialId: string): Promise<void> {
    await this.prisma.client.localCredential.update({
      where: { id: credentialId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  async updatePassword(
    credentialId: string,
    input: { passwordHash: string; passwordChangedAt: Date; mustChangePassword: boolean },
  ): Promise<void> {
    await this.prisma.client.localCredential.update({
      where: { id: credentialId },
      data: {
        passwordHash: input.passwordHash,
        passwordChangedAt: input.passwordChangedAt,
        mustChangePassword: input.mustChangePassword,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async setStatus(userId: string, status: UserStatus): Promise<UserStatus | undefined> {
    const existing = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!existing) {
      return undefined;
    }
    await this.prisma.client.user.update({ where: { id: userId }, data: { status } });
    return existing.status;
  }

  async listDirectory(input: ListDirectoryUsersInput): Promise<ListDirectoryUsersResult> {
    // `email` is `@db.Citext` (case-insensitive by column type already);
    // `fullName` is a plain `String`, so it needs `mode: 'insensitive'`
    // explicitly to match the same case-insensitive search behavior.
    //
    // Carried in `AND`, never as a bare top-level `OR`: the assignment
    // branch below needs an `OR` of its own, and two `OR` keys cannot
    // coexist on one Prisma filter object — the second silently wins, which
    // would drop either the search or the unit predicate with no error.
    const searchClause: Prisma.UserWhereInput[] = input.q
      ? [
          {
            OR: [
              { fullName: { contains: input.q, mode: 'insensitive' } },
              { email: { contains: input.q } },
            ],
          },
        ]
      : [];

    /*
     * Two different questions, two different filters — never the browse
     * filter standing in for the assignment one (see
     * `ListDirectoryUsersInput.assignment`).
     *
     * The assignment branch deliberately admits `primaryOrgUnitId: null`.
     * `IN (...)` never matches NULL in SQL, so without this arm every user
     * recorded against no unit is invisible to every non-global caller —
     * which is how most of this installation's directory quietly became
     * unassignable while no rule anywhere said it should be.
     */
    const where: Prisma.UserWhereInput = input.assignment
      ? {
          status: 'ACTIVE',
          AND: searchClause,
          OR: [
            { primaryOrgUnitId: { in: [...input.assignment.unitIds] } },
            { primaryOrgUnitId: null },
          ],
        }
      : // Annotated, not inferred: `applyScopeToWhere` is generic over the
        // where-object it is handed, so an inline literal narrows `TWhere` to
        // just the keys written here and then rejects `'primaryOrgUnitId'` as
        // a scope field it cannot see.
        applyScopeToWhere<Prisma.UserWhereInput>(input.scope, 'primaryOrgUnitId', {
          status: 'ACTIVE',
          AND: searchClause,
        });

    // F-CV-2 (`risks-lifecycle-audit`): an ASSIGNMENT lookup returns EVERY
    // matching row, never paginated here. `ListDirectoryUsersUseCase` still
    // has to filter this set down to candidates who can actually SEE a
    // record in `orgUnitId` (`risk:view` + scope, resolved per-user — not
    // expressible as a `WHERE` clause against `User` alone) before the page
    // the caller asked for means anything; paginating at this layer first
    // would silently under-fill a page whenever an ineligible candidate
    // occupied one of its slots. The assignment line is a bounded tree
    // slice, not "browse the whole directory" (that request never sets
    // `assignment` and keeps this query's own DB-level pagination exactly
    // as before), so returning it whole is the correct trade, not a
    // performance shortcut taken lightly.
    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        orderBy: { fullName: 'asc' },
        ...(input.assignment
          ? {}
          : { skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
        select: {
          id: true,
          fullName: true,
          email: true,
          jobTitle: true,
          primaryOrgUnit: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    const items: DirectoryUserRecord[] = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      jobTitle: row.jobTitle ?? undefined,
      primaryOrgUnit: row.primaryOrgUnit ?? undefined,
    }));

    return { items, total };
  }

  // -- T176/US8 administration ---------------------------------------------

  async findByEmail(email: string): Promise<{ id: string } | undefined> {
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user ?? undefined;
  }

  async createUserWithCredential(input: CreateUserRow): Promise<AdminUserRecord> {
    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        jobTitle: input.jobTitle ?? null,
        primaryOrgUnitId: input.primaryOrgUnitId ?? null,
        localCredential: {
          create: {
            passwordHash: input.passwordHash,
            passwordChangedAt: new Date(),
            mustChangePassword: input.mustChangePassword,
          },
        },
      },
      select: ADMIN_USER_SELECT,
    });

    return this.toAdminUserRecord(user);
  }

  async updateProfile(
    userId: string,
    patch: UpdateProfileFields,
  ): Promise<PreviousProfileFields | undefined> {
    const existing = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, jobTitle: true, primaryOrgUnitId: true },
    });
    if (!existing) {
      return undefined;
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
        ...(patch.primaryOrgUnitId !== undefined
          ? { primaryOrgUnitId: patch.primaryOrgUnitId }
          : {}),
      },
    });

    return {
      email: existing.email,
      fullName: existing.fullName,
      jobTitle: existing.jobTitle ?? undefined,
      primaryOrgUnitId: existing.primaryOrgUnitId ?? undefined,
    };
  }

  async listAdmin(input: ListAdminUsersInput): Promise<ListAdminUsersResult> {
    const where: Prisma.UserWhereInput = {
      ...(input.q
        ? {
            OR: [
              { fullName: { contains: input.q, mode: 'insensitive' } },
              { email: { contains: input.q } },
            ],
          }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.orgUnitId ? { primaryOrgUnitId: input.orgUnitId } : {}),
      ...(input.roleId ? { userRoles: { some: { roleId: input.roleId } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        orderBy: { [input.sortField]: input.sortDirection },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return { items: rows.map((row) => this.toAdminUserRecord(row)), total };
  }

  async findAdminRecordById(userId: string): Promise<AdminUserRecord | undefined> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: ADMIN_USER_SELECT,
    });
    return user ? this.toAdminUserRecord(user) : undefined;
  }

  async findOrgUnitForValidation(
    orgUnitId: string,
  ): Promise<{ readonly id: string; readonly isActive: boolean } | undefined> {
    const orgUnit = await this.prisma.client.organizationalUnit.findUnique({
      where: { id: orgUnitId },
      select: { id: true, status: true },
    });
    return orgUnit ? { id: orgUnit.id, isActive: orgUnit.status === 'ACTIVE' } : undefined;
  }

  private toAdminUserRecord(row: AdminUserSelectResult): AdminUserRecord {
    const authenticationMethods: AuthenticationMethod[] = [
      ...(row.localCredential ? (['LOCAL'] as const) : []),
      ...row.externalIdentities.map((identity) => identity.method),
    ];

    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      jobTitle: row.jobTitle ?? undefined,
      status: row.status,
      primaryOrgUnit: row.primaryOrgUnit ?? undefined,
      roles: row.userRoles.map((userRole) => userRole.role),
      authenticationMethods,
      lastLoginAt: row.lastLoginAt ?? undefined,
      createdAt: row.createdAt,
    };
  }
}

/** Shared `select` shape for every admin read that returns an
 * `AdminUserRecord` (create/list/detail) — kept as one constant so the
 * three call sites can never quietly drift out of sync with each other or
 * with `toAdminUserRecord`'s expectations. */
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  jobTitle: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  primaryOrgUnit: { select: { id: true, code: true, name: true } },
  userRoles: { select: { role: { select: { id: true, name: true } } } },
  localCredential: { select: { id: true } },
  externalIdentities: { select: { method: true } },
} satisfies Prisma.UserSelect;

type AdminUserSelectResult = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;
