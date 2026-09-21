/**
 * T067/002-shared-grc-foundation, US3 — `Finding`'s domain invariants and
 * lifecycle transition table (data-model.md §5, FR-020 to FR-027). Pure
 * domain logic, matching `evidence.entity.ts`/`action.entity.ts`'s own
 * shape — see those files' headers for why throwing
 * `shared/errors/domain-error.ts` types directly from here is not a
 * boundary violation.
 *
 * `Finding` itself has no mutable-aggregate class in this codebase's style
 * — like `Evidence`/`Action`, the wire-shape record lives in the
 * repository port (`FindingRecord`,
 * `domain/ports/finding-repository.port.ts`) and this file owns the
 * INVARIANTS and the TRANSITION TABLE a use case must apply before
 * writing one.
 *
 * ## The transition table (data-model.md §5's diagram, transcribed exactly)
 *
 * ```
 * OPEN ──> IN_REMEDIATION ──> CLOSED ──> ARCHIVED
 *   │             │              │
 *   └─────────────┴──> CLOSED    └──> IN_REMEDIATION   (reabertura)
 * ```
 *
 * Five legal edges: `OPEN->IN_REMEDIATION`, `OPEN->CLOSED`,
 * `IN_REMEDIATION->CLOSED`, `CLOSED->ARCHIVED`, `CLOSED->IN_REMEDIATION`
 * (reopen). `ARCHIVED` is terminal.
 *
 * ## A debt this file once carried, closed by 005-audit-findings (T047/T048)
 *
 * `OPEN -> IN_REMEDIATION` is a legal edge in data-model.md's own diagram,
 * and until 005-audit-findings shipped, no operation ever reached it going
 * forward: `createFinding` always lands on `OPEN`; `updateFinding`
 * explicitly does not accept `status`; `closeFinding` only ever targets
 * `CLOSED`; the only operation that ever set `IN_REMEDIATION` was
 * `reopenFinding`, whose precondition is `CLOSED`. The edge stayed in the
 * table below through that whole stretch because it was a real,
 * data-model-sanctioned transition (and because rejecting it would have
 * been an undocumented NARROWING of the approved model, a bigger risk than
 * an edge no caller yet exercised) — the gap was reported here rather than
 * silently patched, exactly as CLAUDE.md §19.10 expects of an unexercised
 * extension point.
 *
 * **This is no longer true.** `StartFindingRemediationUseCase`
 * (`grc/finding/application/start-remediation.usecase.ts`, `POST
 * /findings/{findingId}/start-remediation`, gated by `finding:remediate`)
 * is the first, and only, caller in this codebase to request exactly this
 * transition — `assertLegalFindingTransition('OPEN', 'IN_REMEDIATION')`,
 * unmodified from the table below. SC-002 required proof "verificável pelo
 * teste que a exercita, não pela tabela de transições"; that proof is
 * `test/contract/findings.spec.ts`'s `POST
 * /findings/{findingId}/start-remediation` suite, which calls the
 * operation on an `OPEN` finding and asserts `IN_REMEDIATION` plus a
 * `finding.remediation_started` audit row — never a re-reading of
 * `LEGAL_TRANSITIONS` itself. The table below is UNCHANGED by this fix —
 * the gap was always in the missing OPERATION, never in the model
 * (research.md D-10 of 005-audit-findings).
 */
import { ForbiddenDomainError, ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { FindingStatus } from '@prisma/client';

/** Every legal `(from, to)` pair, keyed by `from` for O(1) lookup. */
const LEGAL_TRANSITIONS: Readonly<Record<FindingStatus, ReadonlySet<FindingStatus>>> = {
  OPEN: new Set<FindingStatus>(['IN_REMEDIATION', 'CLOSED']),
  IN_REMEDIATION: new Set<FindingStatus>(['CLOSED']),
  CLOSED: new Set<FindingStatus>(['ARCHIVED', 'IN_REMEDIATION']),
  ARCHIVED: new Set<FindingStatus>(),
};

/**
 * 009-indicators-reports, T023 — `{ OPEN, IN_REMEDIATION }`, "aberto" for
 * `FINDING_OPEN_COUNT_BY_SEVERITY` (research.md D-4). Deliberately NOT
 * derived from `LEGAL_TRANSITIONS` above the way `Incident`/`Problem`'s own
 * `OPEN_*_STATUSES` are (`incident.entity.ts`/`problem-lifecycle.ts`): a
 * mechanical "has an outgoing edge" filter would wrongly include `CLOSED`
 * here, because `CLOSED -> IN_REMEDIATION` (reopen) is itself a legal edge
 * — `CLOSED` is Finding's own point of formal completion (FR-020 to
 * FR-027's own "closure with evidence"), reopenable but not "open" while
 * it stands. `ARCHIVED` is excluded as this lifecycle's true terminal
 * state.
 */
export const OPEN_FINDING_STATUSES: readonly FindingStatus[] = ['OPEN', 'IN_REMEDIATION'];

/** True when `from -> to` is one of the legal edges in the table above. */
export function isLegalFindingTransition(from: FindingStatus, to: FindingStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

/**
 * Throws `ValidationDomainError` (422) for any `(from, to)` pair not in
 * the table. Used by `CloseFindingUseCase`/`ReopenFindingUseCase`/
 * `ArchiveFindingUseCase` — each targets exactly one `to` status, so this
 * function also carries Invariant F4 ("only a CLOSED finding may be
 * archived"): `archiveFinding` calling `assertLegalFindingTransition(current,
 * 'ARCHIVED')` rejects every `current` except `CLOSED`, because `ARCHIVED`
 * is not in any OTHER status's target set above.
 */
export function assertLegalFindingTransition(from: FindingStatus, to: FindingStatus): void {
  if (!isLegalFindingTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.findings.transition.notAllowed, [
      { field: 'status', message: USER_MESSAGES.findings.transition.notAllowed },
    ]);
  }
}

/**
 * **Invariant F1** (domain-enforced, data-model.md §5, FR-026): closing
 * requires at least one linked, COMPLETED `Action` **or** a non-empty
 * `justification`. `hasCompletedLinkedAction` is computed by the caller
 * (`CloseFindingUseCase`, from `FindingRepositoryPort
 * .findCompletedLinkedActionResponsibles`'s own result) — this function
 * only applies the rule, never queries for it.
 */
export function assertFindingCloseRequirementMet(
  hasCompletedLinkedAction: boolean,
  justification: string | null | undefined,
): void {
  const hasJustification = typeof justification === 'string' && justification.trim().length > 0;
  if (!hasCompletedLinkedAction && !hasJustification) {
    throw new ValidationDomainError(USER_MESSAGES.findings.close.requirementNotMet, [
      { field: 'justification', message: USER_MESSAGES.findings.close.requirementNotMet },
    ]);
  }
}

/**
 * **Invariant F5** (domain-enforced, T050/005-audit-findings, FR-010,
 * research.md D-6): closing a finding requires at least one ACTIVE
 * `EvidenceLink` (`unlinkedAt IS NULL`, `subjectType = FINDING`,
 * `subjectId = <this finding>`) — **additive** to Invariant F1 above, never
 * a replacement for it. `CloseFindingUseCase` applies BOTH: F1 (a completed
 * linked action OR a justification) AND F5 (supporting evidence). Whether
 * an active link exists is computed by the caller
 * (`EvidenceLinkRepositoryPort.hasActiveLinkForSubject`, `grc/evidence`) —
 * this function only applies the rule, the same "caller queries, this file
 * only asserts" split F1 already establishes.
 *
 * The referenced `Evidence`'s own `status` is deliberately NOT part of this
 * check — an evidence archived after being linked still sustains a
 * closure (spec.md's own edge case: "só a ausência total de evidência
 * recusa"); only the total absence of an ACTIVE LINK refuses.
 *
 * ## Why this hardens Invariant F1 instead of replacing it
 *
 * FR-010 reads "DEVE exigir ao menos uma evidência... **somando-se** à
 * regra já vigente", not "no lugar da". Substituting F1 with F5 would be
 * exactly the undocumented NARROWING this file's own header warns against
 * for `OPEN -> IN_REMEDIATION` — here applied to closure instead of a
 * transition. **Consequence, reported rather than silently absorbed**: a
 * Phase 1 finding that used to close on justification alone, with zero
 * evidence, no longer can — `test/contract/findings.spec.ts`'s Phase 1
 * tests were updated to attach evidence before closing, each change citing
 * FR-010, and a new adversarial test proves the refusal this invariant
 * introduces (SC-003).
 */
export function assertFindingHasSupportingEvidence(hasActiveEvidenceLink: boolean): void {
  if (!hasActiveEvidenceLink) {
    throw new ValidationDomainError(USER_MESSAGES.findings.close.evidenceRequired, [
      { field: 'evidence', message: USER_MESSAGES.findings.close.evidenceRequired },
    ]);
  }
}

/**
 * **Invariant F2 — segregation of duties** (domain-enforced, data-model.md
 * §5, FR-025): `closedByUserId` may not be the `responsibleUserId` of any
 * `Action` linked to this finding that is currently `COMPLETED`. Spans two
 * tables (`Finding`/`Action`), so this cannot be a database `CHECK` —
 * exactly the same reasoning already backing `assertApproverDiffersFrom
 * Requester` (`modules/risk/domain/approval.ts`) for risk approvals,
 * applied here across a wider join than a single-table `CHECK` could ever
 * express. Refused with `ForbiddenDomainError` (403) — the caller can see
 * the finding; they lack the STANDING to close it, which is `403`'s exact
 * meaning (unlike `NotFoundDomainError`'s existence-hiding role), matching
 * `contracts/grc-foundation.openapi.yaml`'s own `closeFinding` 403
 * description.
 *
 * Deliberately keyed on COMPLETED actions only: a closer who is
 * responsible for a linked action that is still `OPEN`/`IN_PROGRESS`/
 * `CANCELLED` is not attesting their own completed remediation — the rule
 * is about self-attestation of finished work, not about mere involvement.
 */
export function assertCloserNotResponsibleForCompletedAction(
  closerUserId: string,
  completedActionResponsibleUserIds: readonly string[],
): void {
  if (completedActionResponsibleUserIds.includes(closerUserId)) {
    throw new ForbiddenDomainError(USER_MESSAGES.findings.close.segregationOfDuties);
  }
}

/**
 * Reopening (`CLOSED -> IN_REMEDIATION`) requires a non-empty `reason`
 * (contracts/grc-foundation.openapi.yaml's `ReopenFindingRequest`,
 * `required: [reason]` — enforced again here at the domain layer, the
 * same belt-and-suspenders shape `assertReopenReasonProvided` in
 * `grc/action/domain/action.entity.ts` establishes for Invariant A2).
 * `reason` is never a stored column on `Finding` (data-model.md §5) — it
 * reaches only the `finding.reopened` audit event's `newValues`.
 */
export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.findings.reopen.reasonRequired, [
      { field: 'reason', message: USER_MESSAGES.findings.reopen.reasonRequired },
    ]);
  }
}

/**
 * `reopenFinding`'s OWN precondition — narrower than
 * `assertLegalFindingTransition(current, 'IN_REMEDIATION')` would allow.
 * The general table above accepts `OPEN -> IN_REMEDIATION` too (a real,
 * data-model-sanctioned edge — see this file's own header), but
 * "reopening" a finding that was never closed is not a coherent
 * operation: there is no earlier closure to reverse. `ReopenFindingUseCase`
 * therefore calls THIS function, not the general transition table —
 * reopening is legal from `CLOSED` alone. A finding that was never closed
 * answers `422` here (the adversarial case this task requires), not
 * because the table forbids the edge, but because reopening one
 * specifically means undoing a closure that must have happened.
 */
export function assertFindingCanBeReopened(status: FindingStatus): void {
  if (status !== 'CLOSED') {
    throw new ValidationDomainError(USER_MESSAGES.findings.transition.notAllowed, [
      { field: 'status', message: USER_MESSAGES.findings.transition.notAllowed },
    ]);
  }
}

/**
 * **Invariant F3** (enforced by omission, FR-024): completing every linked
 * action never transitions `Finding.status`. There is no function here
 * for that rule — the rule IS the absence of any code path from
 * `TransitionActionUseCase`/`MirrorActionStatusFromOriginUseCase` into
 * `FindingRepositoryPort`. Closure is always the explicit act
 * `CloseFindingUseCase` performs. Documented here so a future change that
 * adds such a path is a deliberate, reviewed decision, not an accidental
 * regression — a dedicated adversarial test
 * (`test/integration/finding-lifecycle.spec.ts`) proves this holds.
 */
export const INVARIANT_F3_NOTE =
  'Completing every linked Action never closes a Finding — see this constant’s own doc comment.';

/**
 * **Phase 6 correction.** `Evidence` already refuses edits once
 * `ARCHIVED` (`evidence.entity.ts#assertEvidenceEditable`); `Finding` had
 * no equivalent, so an archived finding could still be edited through
 * `updateFinding` — inconsistent between two capabilities of the same
 * kernel, and inconsistent with what "archived" means everywhere else in
 * this codebase (`Risk`'s own `assertBusinessContentEditable`,
 * `Evidence`'s own gate above).
 *
 * Mirrors `assertEvidenceEditable`'s shape and error semantics exactly:
 * `ValidationDomainError` (422), field `status`. `CLOSED` is deliberately
 * NOT gated — a closed finding stays editable, because post-closure
 * correction is legitimate and nothing in data-model.md §5 or FR-020–027
 * forbids it. Only `ARCHIVED`, the terminal state, freezes the record.
 */
export function assertFindingEditable(status: FindingStatus): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.findings.archivedNotEditable, [
      { field: 'status', message: USER_MESSAGES.findings.archivedNotEditable },
    ]);
  }
}
