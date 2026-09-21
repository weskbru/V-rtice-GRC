/**
 * T026/002-shared-grc-foundation, US1 — `Evidence`'s domain invariants
 * (data-model.md §2, FR-001 to FR-006). Pure domain logic: no I/O, no
 * Prisma import beyond a TYPE-only reference, no framework import —
 * matching `modules/risk/domain/risk.entity.ts`'s own shape (see that
 * file's header for why throwing `shared/errors/domain-error.ts` types
 * directly from here is not a boundary violation: `shared/**` may be
 * imported by every layer, ADR-011/ADR-016).
 *
 * `Evidence` itself has no mutable-aggregate class in this codebase's
 * style — like `Risk`, the wire-shape record lives in the repository port
 * (`EvidenceRecord`, `domain/ports/evidence-repository.port.ts`) and this
 * file owns only the INVARIANTS a use case must check before writing one.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

/**
 * **Invariant E1 (revised during US1 implementation — see
 * `schema.prisma`'s own `Evidence` section header and
 * `specs/002-shared-grc-foundation/data-model.md` §2 for the full account
 * of why `fileId` does not participate here)**: at least one of
 * `externalUrl`/`observation` must be present. A file backing this
 * evidence reaches it through the separate `Attachment` mechanism
 * (`entityType: EVIDENCE`) and is deliberately NOT one of the two forms
 * this function checks — an evidence record is only ever queried through
 * ITS OWN fields, never by joining to `attachments`, so the substance
 * check must hold on `Evidence`'s own columns alone. The database CHECK
 * (`evidence_has_substance_check`,
 * `20260907091100_evidence_file_fk_correction`) is the last line; this is
 * the same rule enforced earlier, with an attributable field-level error
 * (FR-002).
 */
export function assertEvidenceHasSubstance(input: {
  readonly externalUrl?: string | null | undefined;
  readonly observation?: string | null | undefined;
}): void {
  const hasExternalUrl = typeof input.externalUrl === 'string' && input.externalUrl.length > 0;
  const hasObservation = typeof input.observation === 'string' && input.observation.length > 0;

  if (!hasExternalUrl && !hasObservation) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.hasSubstanceRequired, [
      { field: 'observation', message: USER_MESSAGES.evidence.hasSubstanceRequired },
    ]);
  }
}

/**
 * **Invariant E2**: `validUntil`, when present, must not be before
 * `collectedOn` (data-model.md §2). Both are `@db.Date` (no time
 * component); comparison is by UTC-midnight instant, matching every other
 * date-only comparison in this codebase (`grc/shared/domain/overdue
 * .service.ts`, `modules/risk/domain/risk-overdue.ts`).
 */
export function assertValidUntilNotBeforeCollectedOn(
  collectedOn: Date,
  validUntil: Date | null | undefined,
): void {
  if (!validUntil) {
    return;
  }
  if (validUntil.getTime() < collectedOn.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.validUntilBeforeCollectedOn, [
      { field: 'validUntil', message: USER_MESSAGES.evidence.validUntilBeforeCollectedOn },
    ]);
  }
}

/**
 * data-model.md §6 — "expired" is NEVER a stored column or status value;
 * it is computed on read from `validUntil`, the same shape
 * `grc/shared/domain/overdue.service.ts#isActionOverdue` establishes for
 * `Action`. `referenceDate` is a REQUIRED parameter with no default, for
 * the identical reason `isActionOverdue` gives: every call site must
 * decide, visibly, what "today" means.
 */
export function isEvidenceExpired(
  validUntil: Date | null | undefined,
  referenceDate: Date,
): boolean {
  if (!validUntil) {
    return false;
  }
  return validUntil.getTime() < referenceDate.getTime();
}

/** Statuses in which `Evidence`'s descriptive fields may still be edited
 * (FR-009 — archival is one-way; an archived record's business content is
 * frozen, exactly the same reasoning `assertBusinessContentEditable` gives
 * for a `CLOSED`/`ARCHIVED` `Risk`). */
export function assertEvidenceEditable(status: 'ACTIVE' | 'ARCHIVED'): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.evidence.archivedNotEditable, [
      { field: 'status', message: USER_MESSAGES.evidence.archivedNotEditable },
    ]);
  }
}

/**
 * Adversarial-test decision (spec.md does not say this explicitly, so it
 * is decided and documented here rather than left ambiguous): an
 * `ARCHIVED` evidence record MAY NOT be linked to a NEW subject. FR-009's
 * "arquivamento preserva vínculos históricos" protects links that already
 * exist; it says nothing about creating new ones, and the whole point of
 * archival — retiring a record from active use, the identical reasoning
 * `assertEvidenceEditable` above applies to metadata — would be defeated
 * if an archived record could still be freshly attached to a new claim
 * going forward. Unlinking an EXISTING link is deliberately NOT gated by
 * this function: withdrawing/correcting a link must remain possible
 * regardless of the evidence's own status, the same way `RiskControlLink`
 * unlinking has no status precondition of its own.
 */
export function assertEvidenceLinkable(status: 'ACTIVE' | 'ARCHIVED'): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.evidence.archivedNotLinkable, [
      { field: 'status', message: USER_MESSAGES.evidence.archivedNotLinkable },
    ]);
  }
}
