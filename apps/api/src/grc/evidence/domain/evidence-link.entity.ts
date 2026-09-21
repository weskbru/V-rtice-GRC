/**
 * T027/002-shared-grc-foundation, US1 — `EvidenceLink`'s domain invariants
 * (data-model.md §3, FR-007, FR-008). Pure domain logic, same shape as
 * `evidence.entity.ts` alongside it.
 *
 * **Invariant L1** (the same `(evidenceId, subjectType, subjectId)` triple
 * may not have two ACTIVE links at once) is enforced by the partial unique
 * index `evidence_links_evidence_id_subject_type_subject_id_active_key`
 * (`20260907090100_grc_foundation_baseline`) — the real, race-free
 * backstop — with a pre-check in `LinkEvidenceUseCase` (T033) giving a
 * clean, attributable `409` in the overwhelmingly common non-racing case,
 * the identical two-layer shape `LinkControlUseCase`
 * (`modules/risk/application/links/control-link.usecase.ts`) already
 * establishes for `RiskControlLink`.
 *
 * **Invariant L2** (`unlinkedAt`/`unlinkedByUserId` filled together or not
 * at all) has no dedicated assertion function here: unlike E1/E2 (derived
 * from caller-supplied input a use case must validate), L2 is a shape only
 * this module's OWN code ever produces — `UnlinkEvidenceUseCase` (T033) is
 * the only writer of either column, and it always sets both in the same
 * call. There is no code path that could set one without the other, so an
 * assertion would check a condition nothing in this codebase can violate
 * — the same reasoning `RiskControlLink`'s own `unlinkedAt`/
 * `unlinkedByUserId` pair needs no assertion of its own.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

const MAX_NOTE_LENGTH = 1000;

/** `LinkEvidenceRequest.note` (contracts/grc-foundation.openapi.yaml) is
 * also validated at the DTO boundary (`@MaxLength`); this mirrors that
 * bound at the domain layer so a future non-HTTP caller of
 * `LinkEvidenceUseCase` cannot bypass it. */
export function assertLinkNoteWithinBounds(note: string | null | undefined): void {
  if (note !== null && note !== undefined && note.length > MAX_NOTE_LENGTH) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.link.noteTooLong, [
      { field: 'note', message: USER_MESSAGES.evidence.link.noteTooLong },
    ]);
  }
}
