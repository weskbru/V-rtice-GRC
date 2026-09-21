/**
 * 008-incidents-problems, US1 — `Incident`'s domain invariants and
 * lifecycle transition table (data-model.md §1/§4, research.md D-4,
 * spec.md FR-001-FR-006). Pure domain logic, matching
 * `grc/action/domain/action.entity.ts`/`grc/finding/domain/finding.entity.ts`'s
 * own shape — see those files' headers for why throwing
 * `shared/errors/domain-error.ts` types directly from here is not a
 * boundary violation.
 *
 * `Incident` itself has no mutable-aggregate class in this codebase's
 * style — like `Action`/`Finding`, the wire-shape record lives in the
 * repository port (`IncidentRecord`,
 * `domain/ports/incident-repository.port.ts`) and this file owns the
 * INVARIANTS and the TRANSITION TABLE a use case must apply before
 * writing one.
 *
 * ## The transition table (data-model.md D-4's diagram, transcribed exactly)
 *
 * ```
 * OPEN ──> IN_PROGRESS ──> RESOLVED ──> CLOSED
 *   │            │              │
 *   │            │              └──> IN_PROGRESS   (reabertura, exige motivo)
 *   └────────────┴──────────────────> CANCELLED
 * ```
 *
 * Six legal edges, no more: `OPEN->IN_PROGRESS`, `OPEN->CANCELLED`,
 * `IN_PROGRESS->RESOLVED`, `IN_PROGRESS->CANCELLED`, `RESOLVED->CLOSED`,
 * `RESOLVED->IN_PROGRESS` (reopen). `CLOSED` and `CANCELLED` are both
 * terminal — declared as the ONLY single source of truth for legality;
 * `TransitionIncidentUseCase` is the ONLY caller of
 * {@link assertLegalIncidentTransition}, never a scattered conditional
 * inside that use case or the controller (coordinator, 2026-09-11: "as a
 * declared table, never as scattered conditionals").
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { IncidentStatus } from '@prisma/client';

/** Every legal `(from, to)` pair, keyed by `from` for O(1) lookup. */
const LEGAL_TRANSITIONS: Readonly<Record<IncidentStatus, ReadonlySet<IncidentStatus>>> = {
  OPEN: new Set<IncidentStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<IncidentStatus>(['RESOLVED', 'CANCELLED']),
  RESOLVED: new Set<IncidentStatus>(['CLOSED', 'IN_PROGRESS']),
  CLOSED: new Set<IncidentStatus>(),
  CANCELLED: new Set<IncidentStatus>(),
};

/**
 * 009-indicators-reports, T027 — every `IncidentStatus` with at least one
 * outgoing edge above (`OPEN`, `IN_PROGRESS`, `RESOLVED`) — "aberto" for
 * `INCIDENT_OPEN_COUNT_BY_SEVERITY` (research.md D-4). `RESOLVED` counts
 * as open: it is not this lifecycle's terminal state (`CLOSED` is;
 * `RESOLVED` can still move back to `IN_PROGRESS`) — formal closure, not
 * resolution, is what this indicator treats as "done". Derived from
 * `LEGAL_TRANSITIONS` itself, never a hand-picked second list.
 */
export const OPEN_INCIDENT_STATUSES: readonly IncidentStatus[] = (
  Object.keys(LEGAL_TRANSITIONS) as IncidentStatus[]
).filter((status) => LEGAL_TRANSITIONS[status].size > 0);

/** True when `from -> to` is one of the six edges in the table above. */
export function isLegalIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

/**
 * Throws `ValidationDomainError` (422) for any `(from, to)` pair not in
 * the table — `TransitionIncidentUseCase`'s own gate (spec.md FR-002). A
 * same-state "transition" (`from === to`) is also illegal: it is not one
 * of the six named edges, and would otherwise silently fire a semantic
 * event for a caller who changed nothing.
 */
export function assertLegalIncidentTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!isLegalIncidentTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.notAllowed, [
      { field: 'toStatus', message: USER_MESSAGES.incidents.transition.notAllowed },
    ]);
  }
}

/**
 * **Invariant I1** (domain-enforced, data-model.md §4): entering
 * `RESOLVED` requires a non-empty `resolutionSummary` (spec.md FR-004).
 */
export function assertResolutionSummaryProvided(summary: string | null | undefined): void {
  if (!summary || summary.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.resolutionSummaryRequired, [
      {
        field: 'resolutionSummary',
        message: USER_MESSAGES.incidents.transition.resolutionSummaryRequired,
      },
    ]);
  }
}

/**
 * **Invariant I2** (domain-enforced, data-model.md §4): entering
 * `CANCELLED` requires a non-empty `cancellationReason` (spec.md FR-004).
 */
export function assertCancellationReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.cancellationReasonRequired, [
      {
        field: 'cancellationReason',
        message: USER_MESSAGES.incidents.transition.cancellationReasonRequired,
      },
    ]);
  }
}

/**
 * Reopening (`RESOLVED -> IN_PROGRESS`) requires a non-empty
 * `reopenReason` (spec.md FR-003, contracts/incidents.openapi.yaml's
 * `TransitionIncidentRequest`) — the same belt-and-suspenders shape
 * `assertReopenReasonProvided` already establishes in
 * `grc/action/domain/action.entity.ts`/`grc/finding/domain/finding.entity.ts`.
 * `reopenReason` is never a stored column on `Incident` (data-model.md
 * §1) — it reaches only the transition's own audit event `newValues`.
 */
export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.reopenReasonRequired, [
      { field: 'reopenReason', message: USER_MESSAGES.incidents.transition.reopenReasonRequired },
    ]);
  }
}

/**
 * Maps a transition's `(from, to)` pair to the ONE semantic audit event
 * name it fires — never a generic `incident.updated` standing in for a
 * lifecycle change (coordinator, 2026-09-11: "a lifecycle transition gets
 * its own named event rather than a generic update"). `IN_PROGRESS` is
 * reachable by TWO different edges (`OPEN->IN_PROGRESS`, the start of
 * work; `RESOLVED->IN_PROGRESS`, a reopening) that are different business
 * facts, so — unlike `Action`'s own `actionTransitionEventName`, whose
 * target status alone is unambiguous — this function keys on the pair,
 * not the target alone.
 */
export function incidentTransitionEventName(
  from: IncidentStatus,
  to: IncidentStatus,
):
  | 'incident.started'
  | 'incident.resolved'
  | 'incident.cancelled'
  | 'incident.closed'
  | 'incident.reopened' {
  if (to === 'IN_PROGRESS') {
    return from === 'RESOLVED' ? 'incident.reopened' : 'incident.started';
  }
  switch (to) {
    case 'RESOLVED':
      return 'incident.resolved';
    case 'CANCELLED':
      return 'incident.cancelled';
    case 'CLOSED':
      return 'incident.closed';
    case 'OPEN':
      // Unreachable: no legal edge in LEGAL_TRANSITIONS targets `OPEN` —
      // `assertLegalIncidentTransition` always runs first and would have
      // already thrown for any `(from, 'OPEN')` pair.
      throw new ValidationDomainError(USER_MESSAGES.incidents.transition.notAllowed, [
        { field: 'toStatus', message: USER_MESSAGES.incidents.transition.notAllowed },
      ]);
  }
}
