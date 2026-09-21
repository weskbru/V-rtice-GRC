/**
 * T049/004-compliance-management, User Story 3 (research.md D-11) — port
 * for `RequirementComplianceAuditMark`. Both methods are the ONLY
 * legitimate way to touch this table: nothing else in this module reads
 * it to answer "what is the current state" (that is always
 * `RequirementComplianceService`, recomputed from source data — D-8) and
 * nothing else writes it.
 */
import type { ComplianceAuditMarkObservation } from '../requirement-compliance-audit-mark.entity';
import type { RequirementComplianceState } from '@prisma/client';

export abstract class RequirementComplianceAuditMarkRepositoryPort {
  /**
   * Atomically records that `state` was observed for `requirementId` at
   * `observedAt`, and reports what actually happened (see
   * `ComplianceAuditMarkObservation`'s own doc comment for the three
   * outcomes and their race-freedom). Implemented as INSERT-if-absent
   * followed by a conditional `UPDATE ... WHERE last_audited_state IS
   * DISTINCT FROM $state` when a mark already exists — never a
   * read-then-write pair a concurrent caller could interleave with.
   */
  abstract recordObservation(
    requirementId: string,
    state: RequirementComplianceState,
    observedAt: Date,
  ): Promise<ComplianceAuditMarkObservation>;

  /**
   * The batched form of `recordObservation`, for a listing or summary
   * computing many requirements' state in one pass (research.md D-10) —
   * two bulk statements regardless of `entries.length`, never one
   * round-trip per row. An id absent from `entries` is untouched; every
   * id present in `entries` has exactly one outcome in the returned map.
   */
  abstract recordObservations(
    entries: readonly {
      readonly requirementId: string;
      readonly state: RequirementComplianceState;
    }[],
    observedAt: Date,
  ): Promise<ReadonlyMap<string, ComplianceAuditMarkObservation>>;
}
