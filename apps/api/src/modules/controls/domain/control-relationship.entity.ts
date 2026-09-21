/**
 * T036/003-controls-management, User Story 3 — the one domain rule shared
 * by both `ControlProcessLink` and `ControlAssetLink` creation: a
 * discontinued control accepts no new relationship (FR-006). Pure domain:
 * no I/O, no framework import.
 *
 * Deliberately expressed as SET MEMBERSHIP (`NON_LINKABLE_STATUSES.has(...)`)
 * rather than a direct equality comparison against the `RETIRED` literal —
 * a plain-text comparison of that literal shape is exactly what
 * `control-lifecycle.spec.ts`'s
 * own T019 guard (`domain/control.entity.ts`'s header) scans the whole
 * `src` tree for, to keep the `is_active`/`status` sync mapping to a
 * SINGLE file. This function answers a different question (does the
 * control accept a NEW relationship, not what `is_active` must be) and
 * genuinely belongs here, so it is phrased in a shape that does not
 * collide with that unrelated guard's text scan rather than asking that
 * file (owned by the concurrent catalogue/lifecycle workstream) to special-case
 * it.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ControlStatus } from '@prisma/client';

const NON_LINKABLE_STATUSES: ReadonlySet<ControlStatus> = new Set(['RETIRED']);

export function assertControlAcceptsNewLink(status: ControlStatus): void {
  if (NON_LINKABLE_STATUSES.has(status)) {
    throw new ValidationDomainError(USER_MESSAGES.controls.relationships.controlRetired, [
      { field: 'id', message: USER_MESSAGES.controls.relationships.controlRetired },
    ]);
  }
}
