/**
 * T020/004-compliance-management — resolves the acting user's display name
 * for `AuditRecorder.record(...)`'s required `actorLabel`. Same shape and
 * same reasoning as `modules/controls/domain/ports/control-reference-data.port.ts`
 * and `modules/risk`'s own `RiskReferenceDataPort.findUser`: each module
 * keeps a minimal, independent copy of this one read rather than a shared
 * cross-module "actor lookup" capability, because `core/authorization`'s
 * own `ActorDirectoryPort` (the same read, one layer up) is not exported
 * by `AuthorizationModule` — it is scoped to that module's own
 * `RoleAdminService` — and reaching into `core/identity` from a business
 * module is the reverse-dependency `core/authorization`'s own port header
 * already documents as the reason IT keeps a private copy instead of
 * depending on identity.
 *
 * Unlike Controls' `ControlReferenceDataPort` (which also validates
 * `orgUnitId`/owner assignability — Framework/FrameworkVersion/Requirement
 * carry no organizational scope, research.md D-2), this port needs nothing
 * beyond the actor's own display name.
 */
export interface ComplianceActorRecord {
  readonly id: string;
  readonly fullName: string;
}

export abstract class ComplianceReferenceDataPort {
  /** `undefined` only if `userId` does not exist — defensive; every real
   * caller has already passed `SessionGuard`, so this should not happen in
   * practice, and every use case fails closed (`UnauthorizedDomainError`)
   * rather than fabricate a label if it does. */
  abstract findUser(userId: string): Promise<ComplianceActorRecord | undefined>;
}
