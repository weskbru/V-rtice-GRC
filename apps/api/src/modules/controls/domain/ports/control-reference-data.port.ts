/**
 * T020/003-controls-management — port for validating the records `Control`
 * refers to directly: the organizational unit it belongs to, and the user
 * proposed as its owner (FR-001, FR-008). Mirrors
 * `modules/risk/domain/ports/risk-reference-data.port.ts`'s
 * `OrgUnitLookup`/`UserLookup` shapes exactly (that file's own header
 * explains why this is each module's own small port rather than a shared
 * cross-module lookup) — narrowed to the two lookups Controls actually
 * needs: unlike Risk, a control has no category/type/origin reference-data
 * table to validate against (`nature`/`type`/`frequency` are closed
 * enums, D-7, validated at the DTO layer, not against a database row).
 *
 * `infrastructure/prisma-control-reference-data.repository.ts` is the only
 * implementation, wired by whichever composition root assembles this
 * module's providers (`controls.module.ts`).
 */

export interface ControlOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface ControlOwnerLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly email: string;
  /**
   * `undefined` when the user carries no primary organizational unit — such
   * a user is not confined to one and is therefore assignable anywhere
   * (`core/organizations/domain/assignment-line.ts`'s own rule), the exact
   * same convention `RiskReferenceDataPort.UserLookup` already documents.
   */
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class ControlReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ControlOrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<ControlOwnerLookup | undefined>;
}
