/**
 * 009-indicators-reports, Fase 3 (T018/T030/T031) — port for validating and
 * displaying the one external record `IndicatorDefinition` refers to: its
 * `ownerUserId`. Mirrors `modules/incidents/domain/ports/
 * incident-reference-data.port.ts` exactly — see that file's header for why
 * this is its own small port per module rather than a shared cross-module
 * lookup. `IndicatorDefinition` has no `orgUnitId` (research.md D-8), so
 * this port carries no `findOrgUnit`, unlike `IncidentReferenceDataPort`.
 *
 * `infrastructure/prisma-indicator-reference-data.repository.ts` is the
 * only implementation, wired in `indicators.module.ts`.
 */

export interface IndicatorUserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class IndicatorReferenceDataPort {
  abstract findUser(id: string): Promise<IndicatorUserLookup | undefined>;

  /** 009-indicators-reports, Fase 6 (T043) —
   * `IndicatorActionOriginAccessor`'s only way to give `Action.orgUnitId`
   * (NOT NULL, FK to `organizational_units`) a value when the origin,
   * `IndicatorDefinition`, has none of its own (research.md D-8): the
   * CURRENT `primaryOrgUnitId` of the definition's own `ownerUserId`
   * (the same "owner" research.md D-7's breach notification already
   * addresses), re-resolved on every call — never stamped once and
   * reused — the same "live, never a stale snapshot" answer every other
   * `ActionOriginAccessor` in this registry already gives for its own
   * kind of unit. `undefined` when the user does not exist or has no
   * primary organizational unit at all. */
  abstract findUserOrgUnitId(userId: string): Promise<string | undefined>;
}
