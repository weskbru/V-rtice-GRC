/**
 * T023/005-audit-findings, User Story 1 — `AuditEngagement`'s domain
 * invariants and lifecycle transition table (data-model.md §1, FR-001 to
 * FR-004a, research.md D-3 as AMENDED by the analysis gate). Pure domain
 * logic: no I/O, no Prisma, no framework import — `AuditEngagementStatus`
 * is imported only as a TYPE from `@prisma/client`, the same accepted
 * pattern `control.entity.ts`/`framework-version-lifecycle.ts` document.
 *
 * ## Four states, four forward edges — `CANCELLED` is not optional
 *
 * `research.md` D-3 (written before the analysis gate) argued for exactly
 * three states, no `CANCELLED`, on the grounds that no FR asked for
 * cancellation. `spec.md` FR-004a overrides that conclusion — added at the
 * analysis gate, and named there as "a terceira vez": the exact
 * unreachable-state defect `FindingStatus` (Fase 1) shipped with and
 * `ControlStatus.DRAFT` (Fase 2) nearly shipped with. Without a discard
 * path, an engagement opened by mistake — or abandoned before it has scope
 * — can neither advance (`PLANNING -> IN_PROGRESS` requires scope, FR-003)
 * nor be removed (no delete operation exists anywhere in this platform's
 * design, SC-005): it would be stuck in `PLANNING` forever. This file
 * implements the amended, four-state design; `research.md` D-3/D-19's
 * "nenhum quarto estado" text is superseded by the spec's own correction
 * note and is not followed here.
 *
 * ```
 * PLANNING ──start──> IN_PROGRESS ──complete──> COMPLETED (terminal)
 *    │                     │
 *    └──────cancel─────────┴──cancel──> CANCELLED (terminal)
 * ```
 *
 * Four legal edges, each firing at most once per engagement:
 * `PLANNING -> IN_PROGRESS`, `IN_PROGRESS -> COMPLETED`,
 * `PLANNING -> CANCELLED`, `IN_PROGRESS -> CANCELLED`. `COMPLETED` and
 * `CANCELLED` are both terminal — no edge leaves either.
 *
 * No dedicated transition-log table (unlike `ControlLifecycleTransition`):
 * each edge is captured as a field change on the same `AUDIT_ENGAGEMENT`
 * audit entity type (research.md D-3's own "Control needed a dedicated
 * table because it has 4 states and 6 transition pairs, consulted by a
 * dedicated history endpoint no FR of this fase asks for" — four edges,
 * still linear enough not to earn that cost).
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { AuditEngagementStatus } from '@prisma/client';

/** Every legal `(from, to)` pair, keyed by `from` for O(1) lookup. */
const LEGAL_TRANSITIONS: Readonly<
  Record<AuditEngagementStatus, ReadonlySet<AuditEngagementStatus>>
> = {
  PLANNING: new Set<AuditEngagementStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<AuditEngagementStatus>(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set<AuditEngagementStatus>(),
  CANCELLED: new Set<AuditEngagementStatus>(),
};

/**
 * 009-indicators-reports, T022 — every `AuditEngagementStatus` NOT
 * terminal in `LEGAL_TRANSITIONS` above (`PLANNING`, `IN_PROGRESS`) —
 * "aberto" for `AUDIT_ENGAGEMENT_OPEN_COUNT` (research.md D-4). Derived
 * from the SAME transition table rather than a hand-picked second list, so
 * a future fifth status cannot silently drift from what "terminal" means
 * here — mirrors `grc/shared/domain/overdue.service.ts`'s own
 * `OVERDUE_ELIGIBLE_ACTION_STATUSES` in spirit (one array, every consumer
 * reads it, none restates it).
 */
export const OPEN_AUDIT_ENGAGEMENT_STATUSES: readonly AuditEngagementStatus[] = (
  Object.keys(LEGAL_TRANSITIONS) as AuditEngagementStatus[]
).filter((status) => LEGAL_TRANSITIONS[status].size > 0);

/** True when `from -> to` is one of the legal edges above. */
export function isLegalAuditEngagementTransition(
  from: AuditEngagementStatus,
  to: AuditEngagementStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

/** Throws `ValidationDomainError` (422) for any `(from, to)` pair not in
 * the table above. Used by `StartAuditEngagementUseCase`/
 * `CompleteAuditEngagementUseCase`/`CancelAuditEngagementUseCase`. */
export function assertLegalAuditEngagementTransition(
  from: AuditEngagementStatus,
  to: AuditEngagementStatus,
): void {
  if (!isLegalAuditEngagementTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.lifecycle.transitionNotAllowed, [
      { field: 'status', message: USER_MESSAGES.auditEngagements.lifecycle.transitionNotAllowed },
    ]);
  }
}

/**
 * `true` only while `PLANNING` — governs both `UpdateAuditEngagementUseCase`
 * (the engagement's own `objective`/`periodStart`/`periodEnd`/`orgUnitId`/
 * `leadAuditorUserId`) and every scope-link use case (research.md D-3: once
 * `IN_PROGRESS`, what is being examined and the terms of the exam do not
 * change under the auditee's feet — decision, not a literal FR, reported as
 * such in research.md D-3's own "consequência aceita"). Deliberately NOT
 * gated by `CANCELLED`/`COMPLETED` via a separate check here — those are
 * simply not `PLANNING`, so this single predicate already excludes them.
 */
export function isAuditEngagementEditable(status: AuditEngagementStatus): boolean {
  return status === 'PLANNING';
}

/** Throws `ValidationDomainError` (422) unless `status === 'PLANNING'`. */
export function assertAuditEngagementEditable(status: AuditEngagementStatus): void {
  if (!isAuditEngagementEditable(status)) {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.editableOnlyWhilePlanning,
      [
        {
          field: 'status',
          message: USER_MESSAGES.auditEngagements.lifecycle.editableOnlyWhilePlanning,
        },
      ],
    );
  }
}

/**
 * FR-003 — starting (`PLANNING -> IN_PROGRESS`) requires at least one scope
 * link across the three scope tables, summed. `scopeLinkCount` is computed
 * by the caller (`StartAuditEngagementUseCase`, from
 * `AuditScopeRepositoryPort.countScopeLinks`) — this function only applies
 * the rule, never queries for it (mirrors `assertFindingCloseRequirementMet`'s
 * own "caller computes the fact, domain applies the rule" shape).
 */
export function assertAuditEngagementHasScope(scopeLinkCount: number): void {
  if (scopeLinkCount <= 0) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.lifecycle.startRequiresScope, [
      { field: 'status', message: USER_MESSAGES.auditEngagements.lifecycle.startRequiresScope },
    ]);
  }
}

/**
 * FR-004/FR-007 — `createFindingFromEngagement` is permitted only while the
 * engagement is `IN_PROGRESS`. `PLANNING` refuses because the exam has not
 * started; `COMPLETED`/`CANCELLED` refuse because it is over (FR-004: "um
 * engajamento concluído NÃO PODE receber achados novos" — the same rule
 * this function extends, without exception, to a cancelled one: an
 * engagement that never happened produces no findings either).
 */
export function assertAuditEngagementAcceptsFindings(status: AuditEngagementStatus): void {
  if (status !== 'IN_PROGRESS') {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.findingsRequireInProgress,
      [
        {
          field: 'status',
          message: USER_MESSAGES.auditEngagements.lifecycle.findingsRequireInProgress,
        },
      ],
    );
  }
}

/**
 * FR-004a — the discard path (`-> CANCELLED`) requires a non-empty written
 * justification, the same shape `assertReopenReasonProvided`
 * (`grc/finding`) and `evaluateHasJustification`
 * (`modules/controls/domain/control-lifecycle.ts`) already establish for an
 * equivalent "ending/discarding requires a reason" rule elsewhere in this
 * codebase.
 */
export function assertCancellationJustificationProvided(
  justification: string | null | undefined,
): void {
  if (!justification || justification.trim().length === 0) {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.cancellationJustificationRequired,
      [
        {
          field: 'justification',
          message: USER_MESSAGES.auditEngagements.lifecycle.cancellationJustificationRequired,
        },
      ],
    );
  }
}

/** `periodEnd` must be on or after `periodStart` (data-model.md §1) —
 * verified in the application, not a database `CHECK`: the same
 * "multi-column invariant resolved outside the database when there is no
 * concurrency to protect" pattern the rest of this schema already uses
 * (data-model.md §1's own note). Throws `ValidationDomainError` (422). */
export function assertPeriodEndNotBeforeStart(periodStart: Date, periodEnd: Date): void {
  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.periodEndBeforeStart, [
      { field: 'periodEnd', message: USER_MESSAGES.auditEngagements.periodEndBeforeStart },
    ]);
  }
}
