/**
 * T089/T090 — port for validating the records a `Risk` refers to
 * (FR-059 "validate all risk input on the server", FR-060 "maintain
 * referential integrity between a risk and the users, organizational units
 * and reference data it points to"). The create/update use cases depend on
 * this abstract class, never on `PrismaService` directly (ADR-011).
 *
 * T095a extends this same port with the three read-only list methods behind
 * `GET /risk-categories|risk-types|risk-origins`
 * (`contracts/platform.openapi.yaml`) rather than introducing a second port:
 * both the single-record lookups above and these listings read the exact
 * same three tables, and this module has exactly one Prisma-backed
 * implementation — a second port here would be the "abstração prematura"
 * CLAUDE.md §2 warns against, not a boundary anything currently needs.
 *
 * `modules/risk/infrastructure/prisma-risk-reference-data.repository.ts` is
 * the only implementation, wired in `risk.module.ts`.
 */

export interface OrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface UserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  /**
   * `undefined` when the user carries no primary organizational unit — such
   * a user is not confined to one and is therefore assignable in any unit
   * (`core/organizations/domain/assignment-line.ts`'s own rule, applied
   * identically on this write side and on `UserDirectoryPort.listDirectory`
   * on the read side).
   */
  readonly primaryOrgUnitId: string | undefined;
}

export interface ReferenceDataLookup {
  readonly id: string;
  readonly isActive: boolean;
}

/** One row of `GET /risk-categories|risk-types|risk-origins` — mirrors
 * `ReferenceDataItem` (`contracts/platform.openapi.yaml`). */
export interface ReferenceDataItemRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export abstract class RiskReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<OrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<UserLookup | undefined>;
  abstract findCategory(id: string): Promise<ReferenceDataLookup | undefined>;
  abstract findType(id: string): Promise<ReferenceDataLookup | undefined>;
  abstract findOrigin(id: string): Promise<ReferenceDataLookup | undefined>;

  /**
   * Every row (or, when `includeInactive` is `false`, only the active ones)
   * in display order (`sortOrder` ascending), for the three reference-data
   * listing endpoints. Deactivating one of these rows never deletes it
   * (ADR-008, FR-060), so `includeInactive` exists precisely so a screen
   * displaying a historical risk that references a since-deactivated
   * category can still resolve its name.
   */
  abstract listCategories(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
  abstract listTypes(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
  abstract listOrigins(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
}
