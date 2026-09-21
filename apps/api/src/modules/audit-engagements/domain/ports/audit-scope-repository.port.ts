/**
 * T024/005-audit-findings, User Story 1 — port for the three engagement
 * scope-link tables (data-model.md §2-§4, ADR-020 parts 1/2,
 * `contracts/audit.openapi.yaml`'s `/audits/{auditId}/scope*`). Three
 * distinct write methods (one per link kind — CLAUDE.md §19.3 forbids a
 * generic relationship mechanism), and one combined read (`listScope`) that
 * returns the union of all three, newest first — the same "distinct
 * write, unified read" shape the contract's own `AuditScopeEntry` schema
 * assumes.
 *
 * No `unlink*` method on any of the three — this fase has no removal
 * operation for engagement scope (research.md D-12): a mistaken entry is
 * corrected by adding the right one, never by removing the wrong one.
 *
 * `infrastructure/prisma-audit-scope.repository.ts` is the only
 * implementation.
 */
import type { AuditEngagementUserRefRecord } from './audit-engagement-repository.port';

export type AuditScopeTargetType = 'FRAMEWORK_VERSION' | 'REQUIREMENT' | 'CONTROL';

/** A minimal, precomputed label for the scoped target (ADR-020 part 4 —
 * never the referenced entity's own full domain shape). */
export interface AuditScopeTargetRefRecord {
  readonly id: string;
  readonly label: string;
}

export interface AuditScopeEntryRecord {
  readonly id: string;
  readonly targetType: AuditScopeTargetType;
  readonly target: AuditScopeTargetRefRecord;
  readonly linkedAt: Date;
  readonly linkedBy: AuditEngagementUserRefRecord;
}

export abstract class AuditScopeRepositoryPort {
  abstract createFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  abstract createRequirementLink(
    auditEngagementId: string,
    requirementId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  abstract createControlLink(
    auditEngagementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  /** `true` when this exact `(auditEngagementId, frameworkVersionId)` pair
   * already has a scope link — the pre-check ahead of the unique index's
   * own race-free `409` (data-model.md §2). */
  abstract hasFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
  ): Promise<boolean>;

  abstract hasRequirementLink(auditEngagementId: string, requirementId: string): Promise<boolean>;

  abstract hasControlLink(auditEngagementId: string, controlId: string): Promise<boolean>;

  /** The union of all three scope-link kinds for `auditEngagementId`,
   * newest first — `GET /audits/{id}/scope` (`listAuditScope`,
   * unpaginated per the contract, research.md/data-model.md's own
   * reasoning: bounded by what a human explicitly added). */
  abstract listScope(auditEngagementId: string): Promise<readonly AuditScopeEntryRecord[]>;

  /**
   * `COUNT(*)` across all three scope tables, summed (data-model.md §1's
   * own "invariante de negócio, não de coluna" for starting an
   * engagement, FR-003). A single round-trip (three sub-selects unioned),
   * not three separate queries the caller sums itself.
   */
  abstract countScopeLinks(auditEngagementId: string): Promise<number>;
}
