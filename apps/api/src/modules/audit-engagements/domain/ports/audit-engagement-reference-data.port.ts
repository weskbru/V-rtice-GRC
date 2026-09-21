/**
 * T024/005-audit-findings — port for validating the records `AuditEngagement`
 * refers to directly: the organizational unit it belongs to, and the user
 * proposed as its lead auditor (FR-001). Mirrors
 * `modules/controls/domain/ports/control-reference-data.port.ts`'s
 * `ControlOrgUnitLookup`/`ControlOwnerLookup` shapes — narrowed to what
 * this module actually needs (no assignment-line/nature/type/frequency
 * reference data, unlike Controls).
 *
 * `infrastructure/prisma-audit-engagement-reference-data.repository.ts` is
 * the only implementation.
 */

export interface AuditEngagementOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface AuditEngagementActorLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly email: string;
}

export abstract class AuditEngagementReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<AuditEngagementOrgUnitLookup | undefined>;

  /** Resolves a user by id — used for both the acting caller (whose
   * `fullName` becomes `AuditRecorder.record(...)`'s required
   * `actorLabel`) and the proposed `leadAuditorUserId`. */
  abstract findUser(id: string): Promise<AuditEngagementActorLookup | undefined>;
}
