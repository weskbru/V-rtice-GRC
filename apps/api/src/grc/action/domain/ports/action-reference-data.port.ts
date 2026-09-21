/**
 * T048/002-shared-grc-foundation, US2 — port for validating the `User`
 * `Action` refers to directly (`responsibleUserId`). Mirrors
 * `grc/evidence/domain/ports/evidence-reference-data.port.ts` exactly — see
 * that file's header for why this is its own small port rather than a
 * shared cross-module lookup.
 *
 * Unlike `EvidenceReferenceDataPort`, there is no `findOrgUnit` here:
 * `Action.orgUnitId` is never caller-supplied (`CreateActionRequest` has no
 * `orgUnitId` field, contracts/grc-foundation.openapi.yaml) — it is derived
 * from the origin record's own organizational unit, resolved and validated
 * by `ActionOriginResolverPort` (`grc/shared/domain/ports/action-origin
 * -resolver.port.ts`), so a second, redundant org-unit existence check has
 * no caller-supplied id to check against.
 *
 * `grc/action/infrastructure/prisma-action-reference-data.repository.ts` is
 * the only implementation, wired in `action.module.ts`.
 */

export interface UserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class ActionReferenceDataPort {
  abstract findUser(id: string): Promise<UserLookup | undefined>;
}
