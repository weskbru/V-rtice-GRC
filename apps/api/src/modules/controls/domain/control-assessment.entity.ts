/**
 * T027/003-controls-management, User Story 2 — domain rules for
 * `ControlAssessment` (data-model.md §2, FR-009/FR-010/FR-011). Pure
 * domain: no I/O, no Prisma import beyond a type-only enum, no framework
 * import — mirrors `domain/control.entity.ts`'s own header.
 *
 * `ControlAssessment` is immutable by construction: there is no
 * `updateAssessment`/`deleteAssessment` function anywhere in this module,
 * and this file exports none — FR-010's "não pode sobrescrever, editar ou
 * remover" is enforced by the ABSENCE of a mutation path, not by a runtime
 * check. `test/unit/control-assessment.spec.ts` is what actually proves
 * the absence.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ControlStatus } from '@prisma/client';

/**
 * FR-011 — a verification records what was observed, never what has yet
 * to happen. `assessedOn` and `referenceDate` are both day-precision UTC
 * instants (mirrors `grc/shared/domain/iso-date.ts#parseIsoDate`'s own
 * midnight-UTC convention) — `referenceDate` is a required parameter, not
 * a hidden `new Date()` read, the same discipline
 * `ControlEffectivenessService`'s own header documents for exactly the
 * same reason: testability without manipulating the process clock.
 */
export function assertAssessedOnNotInFuture(assessedOn: Date, referenceDate: Date): void {
  if (assessedOn.getTime() > referenceDate.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.controls.assessment.assessedOnInFuture, [
      { field: 'assessedOn', message: USER_MESSAGES.controls.assessment.assessedOnInFuture },
    ]);
  }
}

/**
 * D-6/FR-006 — `createControlAssessment` requires the control to be
 * `ACTIVE`; `DRAFT`, `SUSPENDED` and `RETIRED` all refuse new
 * verifications (contracts/controls.openapi.yaml's own `createControlAssessment`
 * description: "a DRAFT, SUSPENDED or RETIRED control refuses new
 * assessments with 422").
 */
export function assertControlAcceptsNewAssessment(status: ControlStatus): void {
  if (status !== 'ACTIVE') {
    throw new ValidationDomainError(USER_MESSAGES.controls.assessment.controlNotActive, [
      { field: 'controlId', message: USER_MESSAGES.controls.assessment.controlNotActive },
    ]);
  }
}
